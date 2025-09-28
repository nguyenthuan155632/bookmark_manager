import { aiFeedArticles, aiFeedSources, pushSubscriptions } from '@shared/schema.js';
import { and, desc, eq } from 'drizzle-orm';
import type { Express } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { pushNotificationService } from '../services/push-notification-service.js';

export function registerPushSubscriptionRoutes(app: Express): void {
  app.post('/api/push-subscriptions', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id as string;
      const subscription = req.body as {
        endpoint?: string;
        keys?: { auth?: string; p256dh?: string };
      };

      await pushNotificationService.registerSubscription(userId, {
        endpoint: subscription?.endpoint || '',
        keys: {
          auth: subscription?.keys?.auth || '',
          p256dh: subscription?.keys?.p256dh || '',
        },
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Failed to register push subscription', error);
      res.status(400).json({ message: 'Invalid subscription payload' });
    }
  });

  app.delete('/api/push-subscriptions', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id as string;
      const endpoint = req.body?.endpoint as string | undefined;
      if (!endpoint) {
        res.status(400).json({ message: 'Endpoint is required' });
        return;
      }

      await pushNotificationService.unregisterSubscription(userId, endpoint);
      res.json({ ok: true });
    } catch (error) {
      console.error('Failed to unregister push subscription', error);
      res.status(500).json({ message: 'Failed to unregister subscription' });
    }
  });

  app.get('/api/push-subscriptions/status', requireAuth, async (req, res) => {
    const userId = (req as any).user.id as string;
    const subscribed = await pushNotificationService.getSubscriptionStatus(userId);
    res.json({ subscribed, supported: pushNotificationService.isConfigured });
  });

  app.get('/api/push/articles/latest', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id as string;
      const endpoint = req.query.endpoint as string | undefined;

      if (!endpoint) {
        res.status(400).json({ message: 'Endpoint query parameter is required' });
        return;
      }

      const subscription = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
        .limit(1);

      if (!subscription.length) {
        res.status(404).json({ message: 'Subscription not found' });
        return;
      }

      const latestArticle = await db
        .select({
          id: aiFeedArticles.id,
          title: aiFeedArticles.title,
          notificationContent: aiFeedArticles.notificationContent,
          summary: aiFeedArticles.summary,
          url: aiFeedArticles.url,
        })
        .from(aiFeedArticles)
        .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
        .where(eq(aiFeedSources.userId, userId))
        .orderBy(desc(aiFeedArticles.createdAt))
        .limit(1);

      if (!latestArticle.length) {
        res.status(404).json({ message: 'No articles available' });
        return;
      }

      const article = latestArticle[0];
      const body =
        article.notificationContent ||
        article.summary?.slice(0, 180) ||
        'A new AI processed article is ready for you.';

      res.json({
        title: article.title,
        body,
        url: article.url,
      });
    } catch (error) {
      console.error('Failed to load latest push article', error);
      res.status(500).json({ message: 'Failed to load latest article' });
    }
  });
}
