import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import {
  getUserId,
  verifyProtectedBookmarkAccess,
  getAiChargeDecision,
  tryConsumeAiUsage,
} from './shared';

export function registerAiRoutes(app: Express) {
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
          return res.status(403).json({
            message:
              'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.',
            remainingAiUsage: 0,
          });
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
          return res.status(403).json({
            message:
              'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.',
            remainingAiUsage: 0,
          });
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
        return res
          .status(200)
          .json({ description: bookmark.description || null, generated: false });
      }

      // Update only if currently empty or overwrite requested
      if (!bookmark.description || overwrite === true) {
        const updated = await storage.updateBookmark(userId, id, {
          description: suggestedDescription,
        });
        return res.json({
          description: updated.description,
          generated: true,
          updated: true,
          remainingAiUsage: usageRemaining,
        });
      }

      // Don't overwrite existing description by default
      return res.json({
        description: suggestedDescription,
        generated: true,
        updated: false,
        remainingAiUsage: usageRemaining,
      });
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
          return res.status(403).json({
            message:
              'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.',
            remainingAiUsage: 0,
          });
        }
        usageRemaining = usage.remaining;
      }

      // Generate suggested tags without saving to database
      const suggestedTags = await storage.generateAutoTags(
        url,
        name || '',
        description || undefined,
        {
          userId,
        },
      );

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
          return res.status(403).json({
            message:
              'AI usage limit reached. Please contact nt.apple.it@gmail.com to buy more credits.',
            remainingAiUsage: 0,
          });
        }
        usageRemaining = usage.remaining;
      }
      const suggestedTags = await storage.generateAutoTags(
        bookmark.url,
        bookmark.name,
        bookmark.description || undefined,
        { userId },
      );

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
          const suggestedTags = await storage.generateAutoTags(
            bookmark.url,
            bookmark.name,
            bookmark.description || undefined,
            { userId },
          );

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
}
