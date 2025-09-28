import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import { insertUserPreferencesSchema } from '@shared/schema';
import { getUserId } from './shared';
import { userLinkCheckerService } from '../user-link-checker-service';

export function registerPreferencesRoutes(app: Express) {
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
          defaultAiLanguage: 'auto',
          timezone: 'UTC',
        });
      }
      res.json({ ...preferences, timezone: preferences.timezone || 'UTC' });
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
      const interval = Math.max(
        1,
        (data as any).linkCheckIntervalMinutes ?? preferences.linkCheckIntervalMinutes ?? 30,
      );
      const batch = (data as any).linkCheckBatchSize ?? preferences.linkCheckBatchSize ?? 25;
      if (
        enabled !== undefined ||
        (data as any).linkCheckIntervalMinutes !== undefined ||
        (data as any).linkCheckBatchSize !== undefined
      ) {
        userLinkCheckerService.setUserConfig(
          userId,
          !!(enabled ?? preferences.linkCheckEnabled),
          interval,
          batch,
        );
      }
      res.json({ ...preferences, timezone: preferences.timezone || 'UTC' });
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
}
