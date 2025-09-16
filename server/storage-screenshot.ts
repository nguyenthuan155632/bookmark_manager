import {
  bookmarks,
  type Bookmark,
} from '@shared/schema';
import { db, eq, and } from './storage-base';

export class ScreenshotStorage {
  constructor(private getBookmark: (userId: string, id: number) => Promise<any>) { }

  // Screenshot methods implementation
  async triggerScreenshot(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; message: string }> {
    try {
      // Check if bookmark exists and belongs to user
      const bookmark = await this.getBookmark(userId, bookmarkId);
      if (!bookmark) {
        return { status: 'error', message: 'Bookmark not found' };
      }

      // Check if screenshot is already being generated
      if (bookmark.screenshotStatus === 'pending') {
        return { status: 'pending', message: 'Screenshot generation already in progress' };
      }

      // Update status to pending
      await db
        .update(bookmarks)
        .set({
          screenshotStatus: 'pending',
          screenshotUpdatedAt: new Date(),
        })
        .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));

      // Start screenshot generation asynchronously
      this.generateScreenshotAsync(bookmarkId, bookmark.url);

      // Failsafe: ensure we don't stay pending forever
      const pendingTimeoutMs = Number.parseInt(
        process.env.SCREENSHOT_PENDING_TIMEOUT_MS || '30000',
        10,
      );
      setTimeout(async () => {
        try {
          const [row] = await db
            .select({ status: bookmarks.screenshotStatus, at: bookmarks.screenshotUpdatedAt })
            .from(bookmarks)
            .where(eq(bookmarks.id, bookmarkId));
          if (row?.status === 'pending') {
            await this.updateScreenshotStatus(bookmarkId, 'idle');
          }
        } catch (e) {
          console.warn('Pending screenshot failsafe check failed:', e);
        }
      }, Math.max(5000, pendingTimeoutMs));

      return { status: 'pending', message: 'Screenshot generation started' };
    } catch (error) {
      console.error('Error triggering screenshot:', error);
      return { status: 'error', message: 'Failed to trigger screenshot generation' };
    }
  }

  async updateScreenshotStatus(bookmarkId: number, status: string, url?: string): Promise<void> {
    try {
      const updateData: any = {
        screenshotStatus: status,
        screenshotUpdatedAt: new Date(),
      };

      if (url) {
        updateData.screenshotUrl = url;
      }

      await db.update(bookmarks).set(updateData).where(eq(bookmarks.id, bookmarkId));
    } catch (error) {
      console.error('Error updating screenshot status:', error);
      throw error;
    }
  }

  async getScreenshotStatus(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; screenshotUrl?: string; updatedAt?: Date } | undefined> {
    try {
      const [result] = await db
        .select({
          screenshotStatus: bookmarks.screenshotStatus,
          screenshotUrl: bookmarks.screenshotUrl,
          screenshotUpdatedAt: bookmarks.screenshotUpdatedAt,
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));

      if (!result) {
        return undefined;
      }

      return {
        status: result.screenshotStatus || 'idle',
        screenshotUrl: result.screenshotUrl || undefined,
        updatedAt: result.screenshotUpdatedAt || undefined,
      };
    } catch (error) {
      console.error('Error getting screenshot status:', error);
      return undefined;
    }
  }

  // Private method to generate screenshot asynchronously
  private async generateScreenshotAsync(bookmarkId: number, url: string): Promise<void> {
    try {
      // Validate URL to prevent SSRF attacks
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        await this.updateScreenshotStatus(bookmarkId, 'failed');
        return;
      }

      // Use Thum.io API (higher quality capture)
      // See: https://www.thum.io/documentation/api/url
      // Build option sets (some options may not be supported on free plans)
      const thumWidth = Number.parseInt(process.env.THUMIO_WIDTH || '800', 10);
      const thumVpW = Number.parseInt(process.env.THUMIO_VP_WIDTH || '1024', 10);
      const thumVpH = Number.parseInt(process.env.THUMIO_VP_HEIGHT || '640', 10);
      const fullOptions = [
        'wait/10', // allow time for dynamic pages; keep modest to avoid 400s
        `width/${thumWidth}`,
        `viewportWidth/${thumVpW}`,
        `viewportHeight/${thumVpH}`,
        'noanimate',
        'noscroll',
      ].join('/');
      const minimalOptions = [
        `width/${thumWidth}`,
        'noanimate',
        'noscroll',
      ].join('/');
      const thumToken = process.env.THUMIO_TOKEN?.trim();

      // Build candidate URLs in order of preference
      const candidates: string[] = [];
      if (thumToken) {
        // Authenticated PNG request
        candidates.push(`https://image.thum.io/get/auth/${thumToken}/png/${fullOptions}/${url}`);
        candidates.push(`https://image.thum.io/get/auth/${thumToken}/png/${minimalOptions}/${url}`);
      }
      // Unauthenticated PNG requests (fallback if token missing/invalid)
      candidates.push(`https://image.thum.io/get/png/${fullOptions}/${url}`);
      candidates.push(`https://image.thum.io/get/png/${minimalOptions}/${url}`);

      // Only Thum.io is used. No third‑party fallbacks.

      // Try fetching the image (HEAD may be blocked by some CDNs)
      const tryFetchImage = async (probeUrl: string, timeoutMs = 20000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(probeUrl, { method: 'GET', signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            // eslint-disable-next-line no-useless-escape
            const safeUrl = probeUrl.replace(/(\/auth\/)([^\/]+)(\/)/, '$1*****$3');
            console.warn(`Screenshot probe failed: ${res.status} ${res.statusText} for ${safeUrl}`);
            return false;
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.toLowerCase().startsWith('image/')) return false;
          await this.updateScreenshotStatus(bookmarkId, 'ready', probeUrl);
          return true;
        } catch (e) {
          clearTimeout(timeoutId);
          return false;
        }
      };

      let ok = false;
      for (const candidate of candidates) {
        ok = await tryFetchImage(candidate, 20000);
        if (ok) break;
      }
      if (!ok) {
        throw new Error('Screenshot service unavailable');
      }
    } catch (error) {
      console.warn(
        `Screenshot generation failed for bookmark ${bookmarkId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Fallback to a simple placeholder image service
      try {
        const fallbackUrl = `https://placehold.co/600x400?text=Screenshot+Unavailable`;
        await this.updateScreenshotStatus(bookmarkId, 'ready', fallbackUrl);
      } catch (fallbackError) {
        console.error(`Fallback screenshot failed for bookmark ${bookmarkId}:`, fallbackError);
        await this.updateScreenshotStatus(bookmarkId, 'failed');
      }
    }
  }
}
