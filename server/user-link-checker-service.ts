import { storage } from './storage';
import { linkCheckerService } from './link-checker-service';

type UserTimer = {
  intervalMs: number;
  timer: NodeJS.Timeout | null;
  isRunning: boolean;
  isChecking: boolean;
  batchSize: number;
  lastRunAt: Date | null;
};

class UserLinkCheckerService {
  private users: Map<string, UserTimer> = new Map();

  setUserConfig(userId: string, enabled: boolean, intervalMinutes: number, batchSize: number) {
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000; // enforce min 1 minute
    const bs = Math.max(1, batchSize || 25);
    const existing = this.users.get(userId);
    if (existing) {
      // Stop existing timer
      if (existing.timer) clearInterval(existing.timer);
      existing.timer = null;
      existing.intervalMs = intervalMs;
      existing.batchSize = bs;
      existing.isRunning = false;
      // keep lastRunAt
    } else {
      this.users.set(userId, {
        intervalMs,
        timer: null,
        isRunning: false,
        isChecking: false,
        batchSize: bs,
        lastRunAt: null,
      });
    }
    if (enabled) {
      this.startForUser(userId);
    }
  }

  startForUser(userId: string) {
    const ctx = this.users.get(userId);
    if (!ctx) return;
    if (ctx.isRunning && ctx.timer) return;
    const run = async () => {
      if (ctx.isChecking) return;
      ctx.isChecking = true;
      try {
        ctx.lastRunAt = new Date();
        const bookmarks = await storage.getBookmarksForLinkCheck(ctx.batchSize, userId);
        const concurrency = 5;
        for (let i = 0; i < bookmarks.length; i += concurrency) {
          const batch = bookmarks.slice(i, i + concurrency);
          await Promise.allSettled(
            batch.map(async (b) => {
              const result = await linkCheckerService.performSingleLinkCheck(b.url);
              await storage.updateLinkStatus(
                b.id,
                result.linkStatus,
                result.httpStatus,
                result.linkStatus === 'ok' ? 0 : undefined,
              );
            }),
          );
          if (i + concurrency < bookmarks.length) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (e) {
        // non-fatal
      } finally {
        ctx.isChecking = false;
      }
    };
    // fire immediately then schedule
    run();
    ctx.timer = setInterval(run, ctx.intervalMs);
    ctx.isRunning = true;
  }

  stopForUser(userId: string) {
    const ctx = this.users.get(userId);
    if (!ctx) return;
    if (ctx.timer) clearInterval(ctx.timer);
    ctx.timer = null;
    ctx.isRunning = false;
  }

  getUserStatus(userId: string) {
    const ctx = this.users.get(userId);
    if (!ctx) return { isRunning: false };
    const nextRunAt = ctx.isRunning
      ? new Date((ctx.lastRunAt?.getTime() || Date.now()) + ctx.intervalMs)
      : undefined;
    return {
      isRunning: ctx.isRunning,
      isChecking: ctx.isChecking,
      intervalMinutes: Math.round(ctx.intervalMs / 1000 / 60),
      batchSize: ctx.batchSize,
      lastRunAt: ctx.lastRunAt || null,
      nextRunAt,
    };
  }

  async runNow(userId: string, batchSize?: number) {
    let ctx = this.users.get(userId);
    if (!ctx) {
      // Create a temp context without timer
      ctx = {
        intervalMs: 30 * 60 * 1000,
        timer: null,
        isRunning: false,
        isChecking: false,
        batchSize: Math.max(1, batchSize || 25),
        lastRunAt: null,
      };
      this.users.set(userId, ctx);
    }
    if (ctx.isChecking) return;
    ctx.isChecking = true;
    try {
      ctx.lastRunAt = new Date();
      const bookmarks = await storage.getBookmarksForLinkCheck(
        Math.max(1, batchSize || ctx.batchSize),
        userId,
      );
      const concurrency = 5;
      for (let i = 0; i < bookmarks.length; i += concurrency) {
        const batch = bookmarks.slice(i, i + concurrency);
        await Promise.allSettled(
          batch.map(async (b) => {
            const result = await linkCheckerService.performSingleLinkCheck(b.url);
            await storage.updateLinkStatus(
              b.id,
              result.linkStatus,
              result.httpStatus,
              result.linkStatus === 'ok' ? 0 : undefined,
            );
          }),
        );
        if (i + concurrency < bookmarks.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch {
      // non-fatal
    } finally {
      ctx.isChecking = false;
    }
  }
}

export const userLinkCheckerService = new UserLinkCheckerService();
