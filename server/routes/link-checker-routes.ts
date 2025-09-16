import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import { linkCheckRateLimit, verifyProtectedBookmarkAccess } from './shared';
import { userLinkCheckerService } from '../user-link-checker-service';

export function registerLinkCheckerRoutes(app: Express) {
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
}
