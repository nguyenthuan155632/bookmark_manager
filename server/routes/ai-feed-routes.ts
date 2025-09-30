import {
  aiCrawlerSettings,
  aiFeedArticles,
  aiFeedSources,
  userPreferences,
  type InsertAiCrawlerSettings,
  type InsertAiFeedSource,
} from '@shared/schema.js';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Express } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { db } from '../db';
import { getUserId } from './shared';

export function registerAiFeedRoutes(app: Express) {
  // Get crawler settings for current user
  app.get('/api/ai-feeds/settings', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settings = await db
        .select()
        .from(aiCrawlerSettings)
        .where(eq(aiCrawlerSettings.userId, userId));

      let crawlerSettings;
      if (settings.length === 0) {
        // Create default settings if none exist
        const newSettings: InsertAiCrawlerSettings = {
          userId,
          maxFeedsPerSource: 5,
          isEnabled: true,
          crawlScheduleMode: 'every_hours',
          crawlScheduleValue: '6',
        };
        await db.insert(aiCrawlerSettings).values(newSettings);
        crawlerSettings = [newSettings];
      } else {
        crawlerSettings = settings;
      }

      // Get user preferences for language settings
      const preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));

      res.json({
        settings: crawlerSettings,
        preferences: preferences[0] || null,
      });
    } catch (error) {
      console.error('Error fetching AI feed settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  // Update crawler settings
  app.put('/api/ai-feeds/settings', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const updateSettingsSchema = z.object({
        maxFeedsPerSource: z.number().int().min(1).max(50).optional(),
        isEnabled: z.boolean().optional(),
        crawlScheduleMode: z.enum(['every_hours', 'daily']).optional(),
        crawlScheduleValue: z.string().max(16).optional(),
      });

      const updates = updateSettingsSchema.parse(req.body);

      const result = await db
        .update(aiCrawlerSettings)
        .set(updates)
        .where(eq(aiCrawlerSettings.userId, userId))
        .returning();

      res.json({ settings: result[0] });
    } catch (error) {
      console.error('Error updating AI feed settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Get all feed sources for current user
  app.get('/api/ai-feeds/sources', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sources = await db
        .select()
        .from(aiFeedSources)
        .where(eq(aiFeedSources.userId, userId))
        .orderBy(desc(aiFeedSources.createdAt));

      res.json({ sources });
    } catch (error) {
      console.error('Error fetching AI feed sources:', error);
      res.status(500).json({ message: 'Failed to fetch sources' });
    }
  });

  // Add new feed source
  app.post('/api/ai-feeds/sources', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const insertSourceSchema = z.object({
        url: z.string().url('Please provide a valid URL'),
        isActive: z.boolean().default(true),
        crawlScheduleMode: z.enum(['inherit', 'every_hours', 'daily']).default('inherit'),
        crawlScheduleValue: z.string().max(16).optional(),
      });

      const { url, isActive, crawlScheduleMode, crawlScheduleValue } = insertSourceSchema.parse(
        req.body,
      );
      const newSource: InsertAiFeedSource = {
        url,
        userId,
        isActive,
        crawlScheduleMode,
        crawlScheduleValue: crawlScheduleValue || (crawlScheduleMode === 'every_hours' ? '6' : ''),
      };

      const result = await db.insert(aiFeedSources).values(newSource).returning();
      res.status(201).json({ source: result[0] });
    } catch (error) {
      console.error('Error adding AI feed source:', error);
      res.status(500).json({ message: 'Failed to add source' });
    }
  });

  // Update feed source
  app.put('/api/ai-feeds/sources/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sourceId = parseInt(req.params.id);

      const updateSourceSchema = z.object({
        url: z.string().url('Please provide a valid URL').optional(),
        isActive: z.boolean().optional(),
        crawlScheduleMode: z.enum(['inherit', 'every_hours', 'daily']).optional(),
        crawlScheduleValue: z.string().max(16).optional(),
      });

      const updates = updateSourceSchema.parse(req.body);

      const updatePayload: Record<string, unknown> = { ...updates };
      if (updates.crawlScheduleMode === 'inherit') {
        updatePayload.crawlScheduleValue = '';
      } else if (updates.crawlScheduleMode && !updates.crawlScheduleValue) {
        updatePayload.crawlScheduleValue =
          updates.crawlScheduleMode === 'every_hours' ? '6' : '07:00';
      }

      const result = await db
        .update(aiFeedSources)
        .set(updatePayload)
        .where(and(eq(aiFeedSources.id, sourceId), eq(aiFeedSources.userId, userId)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: 'Source not found' });
      }

      res.json({ source: result[0] });
    } catch (error) {
      console.error('Error updating AI feed source:', error);
      res.status(500).json({ message: 'Failed to update source' });
    }
  });

  // Delete feed source
  app.delete('/api/ai-feeds/sources/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sourceId = parseInt(req.params.id);

      const result = await db
        .delete(aiFeedSources)
        .where(and(eq(aiFeedSources.id, sourceId), eq(aiFeedSources.userId, userId)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: 'Source not found' });
      }

      res.json({ message: 'Source deleted successfully' });
    } catch (error) {
      console.error('Error deleting AI feed source:', error);
      res.status(500).json({ message: 'Failed to delete source' });
    }
  });

  // Get articles for current user
  app.get('/api/ai-feeds/articles', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sourceIdQuery = req.query.sourceId as string | undefined;
      const parsedSourceId = sourceIdQuery ? Number.parseInt(sourceIdQuery, 10) : undefined;
      const sourceFilter = parsedSourceId && Number.isFinite(parsedSourceId) && parsedSourceId > 0
        ? parsedSourceId
        : undefined;

      const rawSearchQuery = typeof req.query.search === 'string' ? req.query.search : '';
      const searchQuery = rawSearchQuery.trim().slice(0, 100);

      let whereClause = and(eq(aiFeedSources.userId, userId), eq(aiFeedArticles.isDeleted, false));

      if (sourceFilter) {
        whereClause = and(whereClause, eq(aiFeedArticles.sourceId, sourceFilter));
      }

      if (searchQuery.length > 0) {
        const likePattern = `%${searchQuery}%`;
        const searchCondition = or(
          ilike(aiFeedArticles.title, likePattern),
          ilike(aiFeedArticles.summary, likePattern),
          ilike(aiFeedArticles.notificationContent, likePattern),
        );
        whereClause = and(whereClause, searchCondition);
      }

      const articles = await db
        .select({
          id: aiFeedArticles.id,
          sourceId: aiFeedArticles.sourceId,
          title: aiFeedArticles.title,
          summary: aiFeedArticles.summary,
          url: aiFeedArticles.url,
          imageUrl: aiFeedArticles.imageUrl,
          notificationContent: aiFeedArticles.notificationContent,
          notificationSent: aiFeedArticles.notificationSent,
          publishedAt: aiFeedArticles.publishedAt,
          createdAt: aiFeedArticles.createdAt,
          shareId: aiFeedArticles.shareId,
          isShared: aiFeedArticles.isShared,
          sourceUrl: aiFeedSources.url,
        })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(whereClause)
        .orderBy(desc(aiFeedArticles.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db
        .select({ count: sql`count(*)` })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(whereClause);

      res.json({
        articles,
        pagination: {
          page,
          limit,
          total: parseInt(totalCount[0].count as string),
          totalPages: Math.ceil(parseInt(totalCount[0].count as string) / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching AI feed articles:', error);
      res.status(500).json({ message: 'Failed to fetch articles' });
    }
  });

  // Manually trigger feed processing
  app.post('/api/ai-feeds/sources/:id/trigger', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sourceId = parseInt(req.params.id);

      const source = await db
        .select()
        .from(aiFeedSources)
        .where(and(eq(aiFeedSources.id, sourceId), eq(aiFeedSources.userId, userId)));

      if (source.length === 0) {
        return res.status(404).json({ message: 'Source not found' });
      }

      console.log(`🚀 Manually triggering feed processing for source: ${source[0].url}`);

      // Create a job in the queue (high priority for manual triggers)
      const { jobQueueService } = await import('../services/job-queue-service.js');
      const job = await jobQueueService.createJob(sourceId, userId, 10); // Priority 10 for manual triggers

      // Update source status to indicate it's queued
      await db
        .update(aiFeedSources)
        .set({ status: 'pending' })
        .where(eq(aiFeedSources.id, sourceId));

      res.json({
        message: 'Feed processing queued successfully',
        jobId: job.id,
        estimatedWaitTime: 'Job will be processed within 30 seconds',
      });
    } catch (error) {
      console.error('Error triggering feed processing:', error);
      res.status(500).json({ message: 'Failed to queue processing' });
    }
  });

  // Get feed processing status
  app.get('/api/ai-feeds/status', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      const sources = await db
        .select({
          id: aiFeedSources.id,
          url: aiFeedSources.url,
          status: aiFeedSources.status,
          lastRunAt: aiFeedSources.lastRunAt,
          isActive: aiFeedSources.isActive,
          crawlScheduleMode: aiFeedSources.crawlScheduleMode,
          crawlScheduleValue: aiFeedSources.crawlScheduleValue,
        })
        .from(aiFeedSources)
        .where(eq(aiFeedSources.userId, userId));

      const totalArticles = await db
        .select({ count: sql`count(*)` })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(eq(aiFeedSources.userId, userId));

      const unreadArticles = await db
        .select({ count: sql`count(*)` })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(and(eq(aiFeedSources.userId, userId), eq(aiFeedArticles.notificationSent, false)));

      // Get job queue stats
      const { jobQueueService } = await import('../services/job-queue-service.js');
      const jobStats = await jobQueueService.getJobStats(userId);

      res.json({
        sources,
        stats: {
          totalArticles: parseInt(totalArticles[0].count as string),
          unreadArticles: parseInt(unreadArticles[0].count as string),
          jobQueue: jobStats,
        },
      });
    } catch (error) {
      console.error('Error fetching AI feed status:', error);
      res.status(500).json({ message: 'Failed to fetch status' });
    }
  });

  // Get user's job queue
  app.get('/api/ai-feeds/jobs', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { jobQueueService } = await import('../services/job-queue-service.js');
      const jobs = await jobQueueService.getUserJobs(userId);

      res.json({ jobs });
    } catch (error) {
      console.error('Error fetching user jobs:', error);
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  // Manually trigger job processing
  app.post('/api/ai-feeds/jobs/process', requireAuth, async (req, res) => {
    try {
      const { jobQueueService } = await import('../services/job-queue-service.js');
      await jobQueueService.triggerProcessing();

      res.json({ message: 'Job processing triggered manually' });
    } catch (error) {
      console.error('Error triggering job processing:', error);
      res.status(500).json({ message: 'Failed to trigger job processing' });
    }
  });

  // Share an article
  app.post('/api/ai-feeds/articles/:id/share', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const articleId = parseInt(req.params.id);

      // Verify the article belongs to the current user
      const article = await db
        .select({
          id: aiFeedArticles.id,
          title: aiFeedArticles.title,
          sourceId: aiFeedArticles.sourceId,
        })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(
          and(
            eq(aiFeedArticles.id, articleId),
            eq(aiFeedSources.userId, userId),
            eq(aiFeedArticles.isDeleted, false),
          ),
        );

      if (article.length === 0) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Generate a unique share ID
      const shareId = Math.random().toString(36).substring(2, 15);

      // Update the article with share information
      const result = await db
        .update(aiFeedArticles)
        .set({
          shareId,
          isShared: true,
        })
        .where(eq(aiFeedArticles.id, articleId))
        .returning();

      res.json({
        article: result[0],
        shareUrl: `/shared-article/${shareId}`,
      });
    } catch (error) {
      console.error('Error sharing article:', error);
      res.status(500).json({ message: 'Failed to share article' });
    }
  });

  // Get shared article (public endpoint)
  app.get('/api/shared-article/:shareId', async (req, res) => {
    try {
      const { shareId } = req.params;

      const article = await db
        .select({
          id: aiFeedArticles.id,
          title: aiFeedArticles.title,
          summary: aiFeedArticles.summary,
          formattedContent: aiFeedArticles.formattedContent,
          originalContent: aiFeedArticles.originalContent,
          url: aiFeedArticles.url,
          imageUrl: aiFeedArticles.imageUrl,
          publishedAt: aiFeedArticles.publishedAt,
          createdAt: aiFeedArticles.createdAt,
          sourceUrl: aiFeedSources.url,
        })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(
          and(
            eq(aiFeedArticles.shareId, shareId),
            eq(aiFeedArticles.isShared, true),
            eq(aiFeedArticles.isDeleted, false),
          ),
        );

      if (article.length === 0) {
        return res.status(404).json({ message: 'Article not found or is no longer shared' });
      }

      res.json({ article: article[0] });
    } catch (error) {
      console.error('Error fetching shared article:', error);
      res.status(500).json({ message: 'Failed to fetch article' });
    }
  });

  // Delete an article
  app.delete('/api/ai-feeds/articles/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const articleId = parseInt(req.params.id, 10);

      // Verify the article belongs to the current user
      const article = await db
        .select()
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(
          and(
            eq(aiFeedArticles.id, articleId),
            eq(aiFeedSources.userId, userId),
            eq(aiFeedArticles.isDeleted, false),
          ),
        );

      if (article.length === 0) {
        return res.status(404).json({ message: 'Article not found' });
      }

      await db
        .update(aiFeedArticles)
        .set({
          isDeleted: true,
          isShared: false,
          shareId: null,
        })
        .where(eq(aiFeedArticles.id, articleId));

      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('Error deleting article:', error);
      res.status(500).json({ message: 'Failed to delete article' });
    }
  });

  // Unshare an article
  app.delete('/api/ai-feeds/articles/:id/share', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const articleId = parseInt(req.params.id);

      // Verify the article belongs to the current user
      const article = await db
        .select()
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(
          and(
            eq(aiFeedArticles.id, articleId),
            eq(aiFeedSources.userId, userId),
            eq(aiFeedArticles.isDeleted, false),
          ),
        );

      if (article.length === 0) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Remove share information
      await db
        .update(aiFeedArticles)
        .set({
          shareId: null,
          isShared: false,
        })
        .where(and(eq(aiFeedArticles.id, articleId), eq(aiFeedArticles.isDeleted, false)))
        .returning();

      res.json({ message: 'Article unshared successfully' });
    } catch (error) {
      console.error('Error unsharing article:', error);
      res.status(500).json({ message: 'Failed to unshare article' });
    }
  });
}
