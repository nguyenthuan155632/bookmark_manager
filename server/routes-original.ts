import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { storage } from './storage';
import {
  insertBookmarkSchema,
  insertCategorySchema,
  insertUserPreferencesSchema,
} from '@shared/schema';
import { requireAuth, setupAuth, comparePasswords } from './auth';
import { userLinkCheckerService } from './user-link-checker-service';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Bulk operation schemas
const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one bookmark ID is required'),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
});

const bulkMoveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one bookmark ID is required'),
  categoryId: z.number().int().positive().nullable(),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
});

// Vensera user ID for temporary fallback access
const VENSERA_USER_ID = 'c73053f2-ec15-438c-8af0-3bf8c7954454';

// Rate limiting for general link checking endpoints
const linkCheckRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 requests per hour
  message: { message: 'Too many link check requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for authenticated requests, IP for others
  keyGenerator: (req: any) => {
    return req.isAuthenticated() ? req.user.id : ipKeyGenerator(req);
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first - this adds passport middleware and session support
  setupAuth(app);

  // CORS for extension endpoints only (no credentials; allows Authorization + JSON)
  app.use('/api/ext', (req: any, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Helper function to get userId from request or fallback to vensera
  const getUserId = (req: any): string => {
    return req.isAuthenticated() ? req.user.id : VENSERA_USER_ID;
  };

  // Helper: consume one AI credit and return remaining; returns error if exhausted
  const tryConsumeAiUsage = async (
    userId: string,
  ): Promise<{ ok: true; remaining: number | null } | { ok: false; remaining: number | null }> => {
    try {
      const prefs = await storage.getUserPreferences(userId);
      // If unlimited (null) or missing record, allow without decrement
      if (!prefs || prefs.aiUsageLimit == null) {
        return { ok: true, remaining: null };
      }
      const current = prefs.aiUsageLimit;
      if (current <= 0) {
        return { ok: false, remaining: 0 };
      }
      await storage.updateUserPreferences(userId, { aiUsageLimit: current - 1 });
      return { ok: true, remaining: current - 1 };
    } catch {
      // If preferences table not ready or other error, don't block; treat as allowed without decrement
      return { ok: true, remaining: null };
    }
  };

  // Helper: determine if AI should be charged based on prefs and type
  const getAiChargeDecision = async (
    userId: string,
    type: 'tags' | 'desc',
  ): Promise<{ shouldCharge: boolean; remaining: number | null }> => {
    try {
      const prefs = await storage.getUserPreferences(userId);
      const hasKey = !!process.env.OPENROUTER_API_KEY?.trim();
      if (!hasKey) return { shouldCharge: false, remaining: prefs?.aiUsageLimit ?? null };
      if (type === 'tags') {
        const enabled = prefs?.aiTaggingEnabled === true;
        return { shouldCharge: enabled, remaining: prefs?.aiUsageLimit ?? null };
      } else {
        const enabled = prefs?.aiDescriptionEnabled === true;
        return { shouldCharge: enabled, remaining: prefs?.aiUsageLimit ?? null };
      }
    } catch {
      return { shouldCharge: false, remaining: null };
    }
  };

  // Middleware: apply session timeout based on user preferences each request (rolling)
  app.use(async (req: any, _res, next) => {
    try {
      if (req.isAuthenticated && req.isAuthenticated()) {
        const prefs = await storage.getUserPreferences(req.user.id);
        const minutes = Math.max(1, prefs?.sessionTimeoutMinutes ?? 30);
        // Update cookie maxAge; express-session with rolling: true will refresh expiry
        req.session.cookie.maxAge = minutes * 60 * 1000;
        // Per-user link check scheduling
        if (prefs?.linkCheckEnabled) {
          userLinkCheckerService.setUserConfig(
            req.user.id,
            true,
            Math.max(1, prefs.linkCheckIntervalMinutes ?? 30),
            prefs.linkCheckBatchSize ?? 25,
          );
        } else {
          userLinkCheckerService.setUserConfig(req.user.id, false, 30, 25);
        }
      }
    } catch (e) {
      // Non-fatal
    }
    next();
  });

  // Helper: parse Bearer token and resolve user (for extension APIs)
  const getUserFromBearer = async (req: any): Promise<Express.User | undefined> => {
    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string') return undefined;
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return undefined;
    const token = parts[1];
    if (!token) return undefined;
    const user = await storage.getUserByApiToken(token);
    if (user) await storage.touchApiToken(token);
    return user as any;
  };

  // Extension login: returns a persistent API token
  app.post('/api/ext/login', async (req, res) => {
    try {
      const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
      const { username, password } = schema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const { token } = await storage.createApiToken(user.id);
      return res.json({ token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid login data', errors: error.errors });
      }
      console.error('Extension login failed:', error);
      return res.status(500).json({ message: 'Failed to login' });
    }
  });

  // Extension create bookmark endpoint supporting optional AI
  app.post('/api/ext/bookmarks', async (req, res) => {
    try {
      const user = await getUserFromBearer(req);
      if (!user) return res.status(401).json({ message: 'Authentication required' });
      const userId = (user as any).id as string;

      // Accept tags as array or comma-separated string
      const payload = { ...req.body };
      if (typeof payload.tags === 'string') {
        payload.tags = payload.tags
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
      }

      const baseSchema = insertBookmarkSchema
        .pick({ name: true, url: true, description: true, tags: true, isFavorite: true, passcode: true })
        .extend({
          autoGenerateTags: z.boolean().optional(),
          autoGenerateDescription: z.boolean().optional(),
          overwriteDescription: z.boolean().optional(),
        });
      const data = baseSchema.parse(payload);

      let name = data.name;
      let url = data.url;
      let description = data.description || null;
      let tags = Array.isArray(data.tags) ? data.tags : [];
      const isFavorite = data.isFavorite ?? false;
      const passcode = (data as any).passcode as string | null | undefined;
      const wantTags = (data as any).autoGenerateTags === true;
      const wantDesc = (data as any).autoGenerateDescription === true;
      const overwriteDesc = (data as any).overwriteDescription === true;

      // Optional AI: description first
      if (wantDesc) {
        const decision = await getAiChargeDecision(userId, 'desc');
        let allowed = true;
        if (decision.shouldCharge) {
          const usage = await tryConsumeAiUsage(userId);
          if (!usage.ok) {
            allowed = false;
          }
        }
        if (allowed) {
          const suggested = await storage.generateAutoDescription(url, name, description || undefined, { userId });
          if (suggested && (overwriteDesc || !description)) {
            description = suggested;
          }
        }
      }

      // Optional AI: tags
      if (wantTags) {
        const decision = await getAiChargeDecision(userId, 'tags');
        let allowed = true;
        if (decision.shouldCharge) {
          const usage = await tryConsumeAiUsage(userId);
          if (!usage.ok) {
            allowed = false;
          }
        }
        if (allowed) {
          const suggestedTags = await storage.generateAutoTags(url, name, description || undefined, { userId });
          const set = new Set([...(tags || []), ...suggestedTags]);
          tags = Array.from(set);
        }
      }

      const created = await storage.createBookmark(userId, {
        name,
        url,
        description,
        tags,
        isFavorite,
        passcode: passcode ?? undefined,
      } as any);

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bookmark data', errors: error.errors });
      }
      console.error('Extension create bookmark failed:', error);
      return res.status(500).json({ message: 'Failed to create bookmark' });
    }
  });

  // Helper function to verify passcode for protected bookmark operations
  const verifyProtectedBookmarkAccess = async (
    userId: string,
    bookmarkId: number,
    providedPasscode: string | undefined,
    req: any,
  ): Promise<{ success: boolean; error?: { status: number; message: string } }> => {
    // Get the bookmark to check if it's protected
    const bookmark = await storage.getBookmark(userId, bookmarkId);
    if (!bookmark) {
      return { success: false, error: { status: 404, message: 'Bookmark not found' } };
    }

    // If bookmark is not protected, allow access
    if (!bookmark.hasPasscode) {
      return { success: true };
    }

    // If bookmark is protected, require passcode or owner's account password
    if (!providedPasscode || typeof providedPasscode !== 'string') {
      return {
        success: false,
        error: {
          status: 401,
          message: 'Passcode required for protected bookmark',
        },
      };
    }

    // Validate passcode format
    if (providedPasscode.length < 4 || providedPasscode.length > 64) {
      return {
        success: false,
        error: {
          status: 400,
          message: 'Invalid passcode format',
        },
      };
    }

    // Verify the passcode (bookmark-specific)
    const isValidPasscode = await storage.verifyBookmarkPasscode(
      userId,
      bookmarkId,
      providedPasscode,
    );

    // If passcode did not match, allow owner's account password as an alternative
    let isValid = isValidPasscode;
    if (!isValidPasscode && req.isAuthenticated && req.isAuthenticated()) {
      try {
        // Only the owner reaches this code path since getBookmark used userId scoping
        const ok = await comparePasswords(providedPasscode, (req.user as any).password);
        if (ok) isValid = true;
      } catch {
        // ignore
      }
    }

    // Log failed attempts for monitoring
    if (!isValid) {
      console.warn(
        `Failed passcode attempt for protected bookmark ${bookmarkId} from IP ${req.ip}`,
      );
      return {
        success: false,
        error: {
          status: 401,
          message: 'Invalid passcode',
        },
      };
    }

    return { success: true };
  };

  // Bookmark routes
  app.get('/api/bookmarks', async (req, res) => {
    try {
      const userId = getUserId(req);
      const search = req.query.search as string;
      const categoryIdParam = (req.query.categoryId as string | undefined)?.toLowerCase();
      let categoryId: number | null | undefined = undefined;
      if (
        categoryIdParam === 'uncategorized' ||
        categoryIdParam === 'unspecified' ||
        categoryIdParam === 'none' ||
        categoryIdParam === 'null'
      ) {
        categoryId = null;
      } else if (categoryIdParam) {
        const parsed = parseInt(categoryIdParam);
        categoryId = isNaN(parsed) ? undefined : parsed;
      }
      const isFavorite = req.query.isFavorite === 'true' ? true : undefined;
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
      const linkStatus = req.query.linkStatus as string;
      const sortBy = (req.query.sortBy as 'name' | 'createdAt' | 'isFavorite') || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

      const bookmarks = await storage.getBookmarks(userId, {
        search,
        categoryId,
        isFavorite,
        tags,
        linkStatus,
        sortBy,
        sortOrder,
        limit: typeof limit === 'number' && !Number.isNaN(limit) ? limit : undefined,
        offset: typeof offset === 'number' && !Number.isNaN(offset) ? offset : undefined,
      });

      res.json(bookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      res.status(500).json({ message: 'Failed to fetch bookmarks' });
    }
  });

  // Export bookmarks (place before :id route to avoid param conflict)
  app.get('/api/bookmarks/export', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const format = (req.query.format as string) || 'json';
      // Optional category filter
      const categoryIdParam = (req.query.categoryId as string | undefined)?.toLowerCase();
      let categoryId: number | null | undefined = undefined;
      if (
        categoryIdParam === 'uncategorized' ||
        categoryIdParam === 'unspecified' ||
        categoryIdParam === 'none' ||
        categoryIdParam === 'null'
      ) {
        categoryId = null;
      } else if (categoryIdParam) {
        const parsed = parseInt(categoryIdParam);
        categoryId = isNaN(parsed) ? undefined : parsed;
      }

      const all = await storage.getBookmarks(userId, { categoryId });
      if (format === 'csv') {
        const header = ['name', 'url', 'description', 'tags', 'isFavorite', 'category'].join(',');
        const rows = all.map((b) => {
          const tags = (b.tags || []).join('|');
          const cat = b.category?.name || '';
          const esc = (v: string) => '"' + (v || '').replace(/"/g, '""') + '"';
          return [esc(b.name), esc(b.url), esc(b.description || ''), esc(tags), b.isFavorite ? '1' : '0', esc(cat)].join(',');
        });
        const csv = [header, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.csv"');
        return res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.json"');
        return res.json(
          all.map((b) => ({
            name: b.name,
            url: b.url,
            description: b.description,
            tags: b.tags,
            isFavorite: b.isFavorite,
            category: b.category?.name || null,
          })),
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
      res.status(500).json({ message: 'Failed to export bookmarks' });
    }
  });

  app.get('/api/bookmarks/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bookmark = await storage.getBookmark(userId, id);

      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      res.json(bookmark);
    } catch (error) {
      console.error('Error fetching bookmark:', error);
      res.status(500).json({ message: 'Failed to fetch bookmark' });
    }
  });

  app.post('/api/bookmarks', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertBookmarkSchema.parse(req.body);
      const bookmark = await storage.createBookmark(userId, data);
      res.status(201).json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bookmark data', errors: error.errors });
      }
      console.error('Error creating bookmark:', error);
      res.status(500).json({ message: 'Failed to create bookmark' });
    }
  });

  // Duplicate a bookmark, preserving attributes (except share link); passcode or password may be required
  app.post('/api/bookmarks/:id/duplicate', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Validate body
      const schema = z.object({ passcode: z.string().optional() });
      const { passcode } = schema.parse(req.body || {});

      // Verify access to protected bookmark
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      const duplicated = await storage.duplicateBookmark(userId, id);
      res.status(201).json(duplicated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Error duplicating bookmark:', error);
      res.status(500).json({ message: 'Failed to duplicate bookmark' });
    }
  });

  app.patch('/api/bookmarks/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Determine intent from raw body to avoid schema side-effects
      const rawKeys = Object.keys(req.body || {}).filter((k) => (req.body as any)[k] !== undefined);
      const onlyFavoriteToggle = rawKeys.length === 1 && rawKeys[0] === 'isFavorite';

      // Parse and validate the data after the passcode decision
      const data = insertBookmarkSchema.partial().parse(req.body);

      if (!onlyFavoriteToggle) {
        // Extract passcode from request body for security verification
        // Allow a separate verifyPasscode field when removing passcode (passcode: null)
        const providedPasscode = (req.body as any)?.verifyPasscode ?? (req.body as any)?.passcode;

        // Verify access for protected bookmarks for other fields
        const accessResult = await verifyProtectedBookmarkAccess(
          userId,
          id,
          providedPasscode,
          req,
        );
        if (!accessResult.success) {
          return res
            .status(accessResult.error!.status)
            .json({ message: accessResult.error!.message });
        }
      }

      // Proceed with update
      const bookmark = await storage.updateBookmark(userId, id, data);
      res.json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bookmark data', errors: error.errors });
      }
      console.error('Error updating bookmark:', error);
      res.status(500).json({ message: 'Failed to update bookmark' });
    }
  });

  app.delete('/api/bookmarks/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Extract passcode from request body for security verification
      const { passcode } = req.body;

      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      // Proceed with deletion if access is granted
      await storage.deleteBookmark(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      res.status(500).json({ message: 'Failed to delete bookmark' });
    }
  });

  // Passcode verification endpoint
  app.post('/api/bookmarks/:id/verify-passcode', async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      const { passcode } = req.body;

      // Validate passcode input
      if (!passcode || typeof passcode !== 'string') {
        return res.status(400).json({ message: 'Passcode is required and must be a string' });
      }

      if (passcode.length < 4 || passcode.length > 64) {
        return res.status(400).json({ message: 'Invalid passcode format' });
      }

      // Check if bookmark exists first (avoid revealing existence through timing)
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      // First check bookmark-specific passcode
      let isValid = await storage.verifyBookmarkPasscode(userId, id, passcode);

      // If that fails, allow owner's account password when authenticated
      if (!isValid && req.isAuthenticated && req.isAuthenticated()) {
        try {
          const ok = await comparePasswords(passcode, (req.user as any).password);
          if (ok) isValid = true;
        } catch {
          //
        }
      }

      // Log failed attempts for monitoring
      if (!isValid) {
        console.warn(`Failed passcode attempt for bookmark ${id} from IP ${req.ip}`);
      }

      res.json({ valid: isValid });
    } catch (error) {
      console.error('Error verifying passcode:', error);
      res.status(500).json({ message: 'Failed to verify passcode' });
    }
  });

  // Auto-tagging endpoints
  // Auto-description endpoints
  app.post('/api/bookmarks/preview-auto-description', async (req, res) => {
    try {
      const previewSchema = z.object({
        url: z.string().url('Please provide a valid URL'),
        name: z.string().optional(),
        description: z.string().optional(),
      });
      const { url, name, description } = previewSchema.parse(req.body);
      const userId = getUserId(req);
      const decision = await getAiChargeDecision(userId, 'desc');
      let usageRemaining: number | null = decision.remaining;
      if (decision.shouldCharge) {
        const usage = await tryConsumeAiUsage(userId);
        if (!usage.ok) {
          return res.status(403).json({ message: 'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.', remainingAiUsage: 0 });
        }
        usageRemaining = usage.remaining;
      }

      const suggestedDescription = await storage.generateAutoDescription(
        url,
        name || '',
        description || undefined,
        { userId },
      );
      res.json({ suggestedDescription, remainingAiUsage: usageRemaining });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Error generating preview auto description:', error);
      res.status(500).json({ message: 'Failed to generate description' });
    }
  });

  app.post('/api/bookmarks/:id/auto-description', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }
      const schema = z.object({
        passcode: z.string().optional(),
        overwrite: z.boolean().optional(),
      });
      const { passcode, overwrite } = schema.parse(req.body);

      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      const decision = await getAiChargeDecision(userId, 'desc');
      let usageRemaining: number | null = decision.remaining;
      if (decision.shouldCharge) {
        const usage = await tryConsumeAiUsage(userId);
        if (!usage.ok) {
          return res.status(403).json({ message: 'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.', remainingAiUsage: 0 });
        }
        usageRemaining = usage.remaining;
      }

      const suggestedDescription = await storage.generateAutoDescription(
        bookmark.url,
        bookmark.name,
        bookmark.description || undefined,
        { userId },
      );

      if (!suggestedDescription) {
        return res.status(200).json({ description: bookmark.description || null, generated: false });
      }

      // Update only if currently empty or overwrite requested
      if (!bookmark.description || overwrite === true) {
        const updated = await storage.updateBookmark(userId, id, { description: suggestedDescription });
        return res.json({ description: updated.description, generated: true, updated: true, remainingAiUsage: usageRemaining });
      }

      // Don't overwrite existing description by default
      return res.json({ description: suggestedDescription, generated: true, updated: false, remainingAiUsage: usageRemaining });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Error generating auto description:', error);
      res.status(500).json({ message: 'Failed to generate description' });
    }
  });

  // Auto-tagging endpoints
  app.post('/api/bookmarks/preview-auto-tags', async (req, res) => {
    try {
      // Validate request body
      const previewSchema = z.object({
        url: z.string().url('Please provide a valid URL'),
        name: z.string().optional(),
        description: z.string().optional(),
      });

      const { url, name, description } = previewSchema.parse(req.body);
      const userId = getUserId(req);
      const decision = await getAiChargeDecision(userId, 'tags');
      let usageRemaining: number | null = decision.remaining;
      if (decision.shouldCharge) {
        const usage = await tryConsumeAiUsage(userId);
        if (!usage.ok) {
          return res.status(403).json({ message: 'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.', remainingAiUsage: 0 });
        }
        usageRemaining = usage.remaining;
      }

      // Generate suggested tags without saving to database
      const suggestedTags = await storage.generateAutoTags(url, name || '', description || undefined, {
        userId,
      });

      res.json({ suggestedTags, remainingAiUsage: usageRemaining });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error generating preview auto tags:', error);
      res.status(500).json({ message: 'Failed to generate tag suggestions' });
    }
  });

  app.post('/api/bookmarks/:id/auto-tags', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Extract passcode from request body for security verification
      const { passcode } = req.body;

      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      // Get the bookmark to analyze
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      // Conditionally consume usage and generate suggested tags based on URL, name, and description
      const decision = await getAiChargeDecision(userId, 'tags');
      let usageRemaining: number | null = decision.remaining;
      if (decision.shouldCharge) {
        const usage = await tryConsumeAiUsage(userId);
        if (!usage.ok) {
          return res.status(403).json({ message: 'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.', remainingAiUsage: 0 });
        }
        usageRemaining = usage.remaining;
      }
      const suggestedTags = await storage.generateAutoTags(bookmark.url, bookmark.name, bookmark.description || undefined, { userId });

      // Update the bookmark with suggested tags
      await storage.updateBookmarkSuggestedTags(userId, id, suggestedTags);

      res.json({ suggestedTags, remainingAiUsage: usageRemaining });
    } catch (error) {
      console.error('Error generating auto tags:', error);
      res.status(500).json({ message: 'Failed to generate auto tags' });
    }
  });

  app.post('/api/bookmarks/bulk/auto-tags', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Validate request body
      const bulkAutoTagSchema = z.object({
        ids: z
          .array(z.number().int().positive())
          .min(1, 'At least one bookmark ID is required')
          .max(50, 'Maximum 50 bookmarks allowed per batch'),
        passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
      });

      const { ids, passcodes } = bulkAutoTagSchema.parse(req.body);

      const results: { id: number; suggestedTags: string[] }[] = [];
      const failed: { id: number; reason: string }[] = [];

      // Process each bookmark
      for (const id of ids) {
        try {
          // Verify access for protected bookmarks
          const providedPasscode = passcodes ? passcodes[id.toString()] : undefined;
          const accessResult = await verifyProtectedBookmarkAccess(
            userId,
            id,
            providedPasscode,
            req,
          );
          if (!accessResult.success) {
            failed.push({ id, reason: accessResult.error!.message });
            continue;
          }

          // Get the bookmark to analyze
          const bookmark = await storage.getBookmark(userId, id);
          if (!bookmark) {
            failed.push({ id, reason: 'Bookmark not found' });
            continue;
          }

          // Generate suggested tags based on URL, name, and description
          const suggestedTags = await storage.generateAutoTags(bookmark.url, bookmark.name, bookmark.description || undefined, { userId });

          // Update the bookmark with suggested tags
          await storage.updateBookmarkSuggestedTags(userId, id, suggestedTags);

          results.push({ id, suggestedTags });
        } catch (error) {
          console.error(`Error processing bookmark ${id}:`, error);
          failed.push({ id, reason: 'Processing failed' });
        }
      }

      res.json({ results, failed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error in bulk auto-tagging:', error);
      res.status(500).json({ message: 'Failed to process bulk auto-tagging' });
    }
  });

  app.patch('/api/bookmarks/:id/tags/accept', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Validate request body
      const acceptTagsSchema = z.object({
        tags: z.array(z.string().trim().min(1)).min(1, 'At least one tag is required'),
        passcode: z.string().min(4).max(64).optional(),
      });

      const { tags, passcode } = acceptTagsSchema.parse(req.body);

      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      // Check if bookmark exists
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      // Accept the suggested tags
      const updatedBookmark = await storage.acceptSuggestedTags(userId, id, tags);

      res.json(updatedBookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error accepting suggested tags:', error);
      res.status(500).json({ message: 'Failed to accept suggested tags' });
    }
  });

  // Bookmark sharing endpoints
  app.patch('/api/bookmarks/:id/share', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Validate request body using Zod
      const shareSchema = z.object({
        isShared: z.boolean(),
      });

      const { isShared } = shareSchema.parse(req.body);

      // Get the bookmark first to check if it exists
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      // Update bookmark sharing status
      const updatedBookmark = await storage.setBookmarkSharing(userId, id, isShared);
      res.json(updatedBookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Error updating bookmark sharing:', error);
      res.status(500).json({ message: 'Failed to update bookmark sharing' });
    }
  });

  // Public shared bookmark access (no authentication required)
  app.get('/api/shared/:shareId', async (req, res) => {
    try {
      const shareId = req.params.shareId;

      if (!shareId) {
        return res.status(400).json({ message: 'Share ID is required' });
      }

      const sharedBookmark = await storage.getSharedBookmark(shareId);

      if (!sharedBookmark) {
        return res.status(404).json({ message: 'Shared bookmark not found' });
      }

      res.json(sharedBookmark);
    } catch (error) {
      console.error('Error fetching shared bookmark:', error);
      res.status(500).json({ message: 'Failed to fetch shared bookmark' });
    }
  });

  // Verify passcode for shared bookmark and return full details if valid
  app.post('/api/shared/:shareId/verify-passcode', async (req, res) => {
    try {
      const { shareId } = req.params as any;
      const schema = z.object({ passcode: z.string().min(4).max(64) });
      const { passcode } = schema.parse(req.body || {});

      const isValid = await storage.verifySharedPasscode(shareId, passcode);
      if (!isValid) {
        return res.status(401).json({ valid: false });
      }

      const full = await storage.getSharedBookmark(shareId, { full: true });
      if (!full) return res.status(404).json({ message: 'Shared bookmark not found' });
      return res.json({ valid: true, bookmark: full });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      console.error('Error verifying shared passcode:', error);
      res.status(500).json({ message: 'Failed to verify passcode' });
    }
  });

  // Bulk operations for bookmarks
  app.post('/api/bookmarks/bulk/delete', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Validate request body
      const { ids, passcodes } = bulkDeleteSchema.parse(req.body);

      // If a provided secret equals the owner's password, treat it as authorized and delete directly
      const remainingIds: number[] = [];
      const remainingPasscodes: Record<string, string> = { ...(passcodes || {}) };
      const directDeleteIds: number[] = [];

      if (passcodes && Object.keys(passcodes).length > 0) {
        for (const id of ids) {
          const provided = passcodes[id.toString()];
          if (!provided) {
            remainingIds.push(id);
            continue;
          }
          try {
            const ok = await comparePasswords(provided, (req.user as any).password);
            if (ok) {
              directDeleteIds.push(id);
              delete remainingPasscodes[id.toString()];
            } else {
              remainingIds.push(id);
            }
          } catch {
            remainingIds.push(id);
          }
        }
      } else {
        remainingIds.push(...ids);
      }

      const deletedIds: number[] = [];
      const failed: { id: number; reason: string }[] = [];

      // Perform direct deletes for those validated via account password
      for (const id of directDeleteIds) {
        try {
          await storage.deleteBookmark(userId, id);
          deletedIds.push(id);
        } catch (e) {
          failed.push({ id, reason: 'Failed to delete bookmark' });
        }
      }

      // Use existing bulk path for the rest (supports real passcodes and unprotected items)
      if (remainingIds.length > 0) {
        const result = await storage.bulkDeleteBookmarks(userId, remainingIds, remainingPasscodes);
        deletedIds.push(...result.deletedIds);
        failed.push(...result.failed);
      }

      res.json({ deletedIds, failed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error in bulk delete bookmarks:', error);
      res.status(500).json({ message: 'Failed to delete bookmarks' });
    }
  });

  app.patch('/api/bookmarks/bulk/move', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Validate request body
      const { ids, categoryId, passcodes } = bulkMoveSchema.parse(req.body);

      // If a provided secret equals the owner's password, treat it as authorized and move directly
      const remainingIds: number[] = [];
      const remainingPasscodes: Record<string, string> = { ...(passcodes || {}) };
      const directMoveIds: number[] = [];

      if (passcodes && Object.keys(passcodes).length > 0) {
        for (const id of ids) {
          const provided = passcodes[id.toString()];
          if (!provided) {
            remainingIds.push(id);
            continue;
          }
          try {
            const ok = await comparePasswords(provided, (req.user as any).password);
            if (ok) {
              directMoveIds.push(id);
              delete remainingPasscodes[id.toString()];
            } else {
              remainingIds.push(id);
            }
          } catch {
            remainingIds.push(id);
          }
        }
      } else {
        remainingIds.push(...ids);
      }

      const movedIds: number[] = [];
      const failed: { id: number; reason: string }[] = [];

      // Perform direct moves for those validated via account password
      for (const id of directMoveIds) {
        try {
          await storage.updateBookmark(userId, id, { categoryId } as any);
          movedIds.push(id);
        } catch (e) {
          failed.push({ id, reason: 'Failed to move bookmark' });
        }
      }

      // Use existing bulk path for the rest (supports real passcodes and unprotected items)
      if (remainingIds.length > 0) {
        const result = await storage.bulkMoveBookmarks(userId, remainingIds, categoryId, remainingPasscodes);
        movedIds.push(...result.movedIds);
        failed.push(...result.failed);
      }

      res.json({ movedIds, failed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error in bulk move bookmarks:', error);
      res.status(500).json({ message: 'Failed to move bookmarks' });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const userId = getUserId(req);
      const withCounts = req.query.withCounts === 'true';
      const categories = withCounts
        ? await storage.getCategoriesWithCounts(userId)
        : await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.get('/api/categories/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(userId, id);

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ message: 'Failed to fetch category' });
    }
  });

  app.post('/api/categories', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(userId, data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error creating category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  app.patch('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const data = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(userId, id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error updating category:', error);
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Ensure category exists and belongs to user
      const cat = await storage.getCategory(userId, id);
      if (!cat) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Determine strategy (optional): 'unlink' | 'delete'
      const strategy = (req.query.strategy as string | undefined)?.toLowerCase();

      // Get bookmarks in this category to decide behavior
      const bookmarksInCategory = await storage.getBookmarks(userId, { categoryId: id });
      const count = bookmarksInCategory.length;

      if (count === 0) {
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      if (!strategy) {
        return res
          .status(409)
          .json({
            message: 'Category contains bookmarks. Specify strategy query param.',
            required: {
              strategy: ['unlink', 'delete'],
            },
            count,
          });
      }

      if (strategy === 'unlink') {
        // Unlink all bookmarks from this category, then delete category
        await storage.unlinkCategoryBookmarks(userId, id);
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      if (strategy === 'delete') {
        // Hard delete all bookmarks in this category (ignores passcodes)
        await storage.deleteBookmarksByCategory(userId, id);
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      return res.status(400).json({ message: 'Invalid strategy. Use unlink or delete.' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // Stats route
  app.get('/api/stats', async (req, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getBookmarkStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // (moved) Export bookmarks route defined earlier to avoid /:id conflict

  // Import bookmarks (JSON array only)
  app.post('/api/bookmarks/import', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const payload = req.body;
      const categoryIdParam = (req.query.categoryId as string | undefined)?.toLowerCase();
      let targetCategoryId: number | null | undefined = undefined;
      if (
        categoryIdParam === 'uncategorized' ||
        categoryIdParam === 'unspecified' ||
        categoryIdParam === 'none' ||
        categoryIdParam === 'null'
      ) {
        targetCategoryId = null;
      } else if (categoryIdParam) {
        const parsed = parseInt(categoryIdParam);
        targetCategoryId = isNaN(parsed) ? undefined : parsed;
      }
      if (!Array.isArray(payload)) {
        return res.status(400).json({ message: 'Expected an array of bookmarks' });
      }
      let created = 0;
      const existingCats = await storage.getCategories(userId);
      for (const item of payload) {
        if (!item || typeof item !== 'object') continue;
        const name = (item.name || '').toString();
        const url = (item.url || '').toString();
        if (!name || !url) continue;
        let categoryId: number | null | undefined = targetCategoryId;
        if (item.category != null && item.category !== '') {
          const found = existingCats.find(
            (c) => c.name.toLowerCase() === String(item.category).toLowerCase(),
          );
          if (found) categoryId = found.id;
          else if (categoryId === undefined) categoryId = undefined;
        }
        await storage.createBookmark(userId, {
          name,
          url,
          description: item.description || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          isFavorite: !!item.isFavorite,
          categoryId: categoryId === null ? null : categoryId,
          userId, // ignored by server but typed in schema
        } as any);
        created++;
      }
      res.json({ created });
    } catch (error) {
      console.error('Import failed:', error);
      res.status(500).json({ message: 'Failed to import bookmarks' });
    }
  });

  // User Preferences routes
  app.get('/api/preferences', async (req, res) => {
    try {
      const userId = getUserId(req);
      const preferences = await storage.getUserPreferences(userId);
      if (!preferences) {
        // Return default preferences if none exist
        return res.json({
          theme: 'light',
          viewMode: 'grid',
          aiUsageLimit: 50,
        });
      }
      res.json(preferences);
    } catch (error: any) {
      console.error('Error fetching preferences:', error);
      if (error?.code === '42703') {
        // Column missing — return defaults so UI remains functional
        return res.status(200).json({ theme: 'light', viewMode: 'grid', migrationRequired: true });
      }
      res.status(500).json({ message: 'Failed to fetch preferences' });
    }
  });

  app.patch('/api/preferences', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id; // Use authenticated user ID only
      const data = insertUserPreferencesSchema.partial().parse(req.body);
      const preferences = await storage.updateUserPreferences(userId, data);

      // Apply session timeout immediately if provided
      if (typeof (data as any).sessionTimeoutMinutes === 'number') {
        const minutes = Math.max(1, (data as any).sessionTimeoutMinutes);
        if (minutes > 0) {
          req.session.cookie.maxAge = minutes * 60 * 1000;
        }
      }

      // Apply per-user schedule with min 10 minutes
      const enabled = (data as any).linkCheckEnabled;
      const interval = Math.max(1, (data as any).linkCheckIntervalMinutes ?? preferences.linkCheckIntervalMinutes ?? 30);
      const batch = (data as any).linkCheckBatchSize ?? preferences.linkCheckBatchSize ?? 25;
      if (enabled !== undefined || (data as any).linkCheckIntervalMinutes !== undefined || (data as any).linkCheckBatchSize !== undefined) {
        userLinkCheckerService.setUserConfig(userId, !!(enabled ?? preferences.linkCheckEnabled), interval, batch);
      }
      res.json(preferences);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid preferences data', errors: error.errors });
      }
      console.error('Error updating preferences:', error);
      if (error?.code === '42703') {
        return res.status(400).json({
          message: 'Database schema out of date. Please run migrations (npm run db:push).',
        });
      }
      res.status(500).json({ message: 'Failed to update preferences' });
    }
  });

  // Screenshot routes
  app.post('/api/bookmarks/:id/screenshot', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Extract passcode from request body for security verification
      const { passcode } = req.body;

      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      // Trigger screenshot generation
      const result = await storage.triggerScreenshot(userId, id);

      if (result.status === 'error') {
        return res.status(400).json(result);
      }

      // Return 202 Accepted for async operation
      res.status(202).json(result);
    } catch (error) {
      console.error('Error triggering screenshot:', error);
      res.status(500).json({ message: 'Failed to trigger screenshot generation' });
    }
  });

  app.get('/api/bookmarks/:id/screenshot/status', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Get screenshot status
      const status = await storage.getScreenshotStatus(userId, id);

      if (!status) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }

      res.json(status);
    } catch (error) {
      console.error('Error getting screenshot status:', error);
      res.status(500).json({ message: 'Failed to get screenshot status' });
    }
  });

  // Link checking endpoints
  app.post('/api/bookmarks/:id/check-link', linkCheckRateLimit, requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmark ID' });
      }

      // Extract passcode from request body for security verification
      const { passcode } = req.body;

      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res
          .status(accessResult.error!.status)
          .json({ message: accessResult.error!.message });
      }

      // Perform the link check
      const result = await storage.checkBookmarkLink(userId, id);
      res.json(result);
    } catch (error) {
      console.error('Error checking bookmark link:', error);
      res.status(500).json({ message: 'Failed to check bookmark link' });
    }
  });

  app.post('/api/bookmarks/bulk/check-links', linkCheckRateLimit, requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Validate request body
      const bulkCheckLinkSchema = z.object({
        ids: z.array(z.number().int().positive()).optional().default([]),
        passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
      });

      const { ids, passcodes } = bulkCheckLinkSchema.parse(req.body);

      // Limit to prevent abuse (max 50 bookmarks per request)
      if (ids.length > 50) {
        return res.status(400).json({
          message: 'Maximum 50 bookmarks allowed per bulk check request',
        });
      }

      // If specific IDs provided, verify passcode access for protected bookmarks
      if (ids.length > 0) {
        const accessErrors: { id: number; reason: string }[] = [];

        for (const id of ids) {
          const providedPasscode = passcodes ? passcodes[id.toString()] : undefined;
          const accessResult = await verifyProtectedBookmarkAccess(
            userId,
            id,
            providedPasscode,
            req,
          );
          if (!accessResult.success) {
            accessErrors.push({ id, reason: accessResult.error!.message });
          }
        }

        // If any access errors, return them
        if (accessErrors.length > 0) {
          return res.status(403).json({
            message: 'Access denied for some bookmarks',
            accessErrors,
          });
        }
      }

      // Perform bulk link checking
      const result = await storage.bulkCheckBookmarkLinks(userId, ids.length > 0 ? ids : undefined);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: error.errors,
        });
      }
      console.error('Error in bulk link checking:', error);
      res.status(500).json({ message: 'Failed to perform bulk link checking' });
    }
  });

  // Per-user link checker status endpoint
  app.get('/api/user/link-checker/status', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const prefs = await storage.getUserPreferences(userId);
      const status = userLinkCheckerService.getUserStatus(userId);
      res.json({
        enabled: !!prefs?.linkCheckEnabled,
        intervalMinutes: prefs?.linkCheckIntervalMinutes ?? 30,
        batchSize: prefs?.linkCheckBatchSize ?? 25,
        ...status,
      });
    } catch (error) {
      console.error('Error getting user link checker status:', error);
      res.status(500).json({ message: 'Failed to get user link checker status' });
    }
  });

  // Trigger per-user run now
  app.post('/api/user/link-checker/run-now', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const prefs = await storage.getUserPreferences(userId);
      const batch = prefs?.linkCheckBatchSize ?? 25;
      await userLinkCheckerService.runNow(userId, batch);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error running user link checker now:', error);
      res.status(500).json({ message: 'Failed to run link checker' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
