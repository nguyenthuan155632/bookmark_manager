import type { Express } from 'express';
import { storage } from '../storage';
import { getUserId } from './shared';

export function registerStatsRoutes(app: Express) {
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
}
