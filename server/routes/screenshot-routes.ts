import type { Express } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import { verifyProtectedBookmarkAccess } from './shared';

export function registerScreenshotRoutes(app: Express) {
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
}
