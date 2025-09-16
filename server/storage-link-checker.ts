import { bookmarks } from '@shared/schema';
import { db, eq, and, asc, sql } from './storage-base';

export class LinkCheckerStorage {
  constructor(private getBookmark: (userId: string, id: number) => Promise<any>) {}

  // Link checking methods implementation
  async checkBookmarkLink(
    userId: string,
    bookmarkId: number,
  ): Promise<{ linkStatus: string; httpStatus?: number; lastLinkCheckAt: Date }> {
    try {
      // Check if bookmark exists and belongs to user
      const bookmark = await this.getBookmark(userId, bookmarkId);
      if (!bookmark) {
        throw new Error('Bookmark not found');
      }

      // Check if bookmark is in backoff period (for manual checks)
      const currentFailCount = bookmark.linkFailCount || 0;
      if (currentFailCount > 0 && bookmark.lastLinkCheckAt) {
        const backoffMinutes = this.calculateBackoffMinutes(currentFailCount);
        const backoffEndTime = new Date(
          bookmark.lastLinkCheckAt.getTime() + backoffMinutes * 60 * 1000,
        );

        if (new Date() < backoffEndTime) {
          console.warn(
            `Bookmark ${bookmarkId} is in backoff period until ${backoffEndTime.toISOString()} (${currentFailCount} failures)`,
          );
          // Return current status without checking
          return {
            linkStatus: bookmark.linkStatus || 'unknown',
            httpStatus: bookmark.httpStatus || undefined,
            lastLinkCheckAt: bookmark.lastLinkCheckAt,
          };
        }
      }

      console.log(
        `Checking link for bookmark ${bookmarkId}: ${bookmark.url} (${currentFailCount} previous failures)`,
      );
      const result = await this.performLinkCheck(bookmark.url);

      // Calculate new fail count with exponential backoff logic
      let newFailCount: number;
      if (result.linkStatus === 'ok') {
        newFailCount = 0; // Reset on success
        console.log(`✓ Link check successful for bookmark ${bookmarkId}: ${result.httpStatus}`);
      } else {
        newFailCount = currentFailCount + 1;
        const nextCheckIn = this.calculateBackoffMinutes(newFailCount);
        console.warn(
          `✗ Link check failed for bookmark ${bookmarkId}: ${result.linkStatus} (${result.httpStatus || 'N/A'}). Next check in ${nextCheckIn} minutes (${newFailCount} total failures)`,
        );
      }

      // Update the bookmark with link check results
      await this.updateLinkStatus(bookmarkId, result.linkStatus, result.httpStatus, newFailCount);

      return {
        linkStatus: result.linkStatus,
        httpStatus: result.httpStatus,
        lastLinkCheckAt: new Date(),
      };
    } catch (error) {
      console.error(`Error checking link for bookmark ${bookmarkId}:`, error);

      // Increment fail count on error
      const bookmark = await this.getBookmark(userId, bookmarkId);
      const newFailCount = (bookmark?.linkFailCount || 0) + 1;
      console.warn(
        `Link check error for bookmark ${bookmarkId}, incrementing fail count to ${newFailCount}`,
      );

      // Update with error status and incremented fail count
      await this.updateLinkStatus(bookmarkId, 'broken', undefined, newFailCount);

      throw error;
    }
  }

  async bulkCheckBookmarkLinks(
    userId: string,
    bookmarkIds?: number[],
  ): Promise<{
    checkedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    try {
      let bookmarksToCheck;

      if (bookmarkIds && bookmarkIds.length > 0) {
        // Check specific bookmarks
        bookmarksToCheck = [];
        for (const id of bookmarkIds) {
          const bookmark = await this.getBookmark(userId, id);
          if (bookmark) {
            bookmarksToCheck.push({
              id: bookmark.id,
              url: bookmark.url,
              linkFailCount: bookmark.linkFailCount || 0,
            });
          }
        }
      } else {
        // Check all user's bookmarks - this would need to be injected
        // For now, we'll assume this is handled by the calling code
        bookmarksToCheck = [];
      }

      const checkedIds: number[] = [];
      const failed: { id: number; reason: string }[] = [];

      // Process bookmarks with concurrency control (max 5 at a time)
      const concurrencyLimit = 5;
      for (let i = 0; i < bookmarksToCheck.length; i += concurrencyLimit) {
        const batch = bookmarksToCheck.slice(i, i + concurrencyLimit);

        const batchPromises = batch.map(async (bookmark) => {
          try {
            const result = await this.performLinkCheck(bookmark.url);

            await this.updateLinkStatus(
              bookmark.id,
              result.linkStatus,
              result.httpStatus,
              result.linkStatus === 'ok' ? 0 : bookmark.linkFailCount + 1,
            );

            checkedIds.push(bookmark.id);
          } catch (error) {
            console.error(`Error checking link for bookmark ${bookmark.id}:`, error);
            failed.push({
              id: bookmark.id,
              reason: error instanceof Error ? error.message : 'Unknown error',
            });

            // Still update with error status
            await this.updateLinkStatus(
              bookmark.id,
              'broken',
              undefined,
              bookmark.linkFailCount + 1,
            );
          }
        });

        await Promise.allSettled(batchPromises);

        // Small delay between batches to be respectful
        if (i + concurrencyLimit < bookmarksToCheck.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return { checkedIds, failed };
    } catch (error) {
      console.error('Error in bulk link checking:', error);
      throw error;
    }
  }

  async updateLinkStatus(
    bookmarkId: number,
    linkStatus: string,
    httpStatus?: number,
    linkFailCount?: number,
  ): Promise<void> {
    try {
      const updateData: any = {
        linkStatus,
        lastLinkCheckAt: new Date(),
      };

      if (httpStatus !== undefined) {
        updateData.httpStatus = httpStatus;
      }

      if (linkFailCount !== undefined) {
        updateData.linkFailCount = linkFailCount;
      }

      await db.update(bookmarks).set(updateData).where(eq(bookmarks.id, bookmarkId));
    } catch (error) {
      console.error(`Error updating link status for bookmark ${bookmarkId}:`, error);
      throw error;
    }
  }

  async getBookmarksForLinkCheck(
    limit: number,
    userId?: string,
  ): Promise<
    { id: number; url: string; lastLinkCheckAt: Date | null; linkFailCount?: number | null }[]
  > {
    try {
      const conditions = [];

      if (userId) {
        conditions.push(eq(bookmarks.userId, userId));
      }

      // Get all bookmarks first, then filter by backoff logic in JavaScript
      // This avoids complex SQL with INTERVAL calculations that cause parameter binding issues
      const query = db
        .select({
          id: bookmarks.id,
          url: bookmarks.url,
          lastLinkCheckAt: bookmarks.lastLinkCheckAt,
          linkFailCount: bookmarks.linkFailCount,
        })
        .from(bookmarks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          // Prioritize by fail count (lower first), then by last check time
          asc(sql`COALESCE(${bookmarks.linkFailCount}, 0)`),
          sql`CASE WHEN ${bookmarks.lastLinkCheckAt} IS NULL THEN 0 ELSE 1 END`,
          asc(bookmarks.lastLinkCheckAt),
        )
        .limit(limit * 2); // Get more than needed since we'll filter in JS

      const allBookmarks = await query;

      // Filter by backoff logic in JavaScript
      const currentTime = new Date();
      const filteredBookmarks = allBookmarks.filter((bookmark) => {
        // Never been checked - always include
        if (!bookmark.lastLinkCheckAt) {
          return true;
        }

        // Check if enough time has passed based on exponential backoff
        const failCount = bookmark.linkFailCount || 0;
        const backoffMinutes = this.calculateBackoffMinutes(failCount);
        const backoffEndTime = new Date(
          bookmark.lastLinkCheckAt.getTime() + backoffMinutes * 60 * 1000,
        );

        return currentTime >= backoffEndTime;
      });

      return filteredBookmarks.slice(0, limit);
    } catch (error) {
      console.error('Error getting bookmarks for link check:', error);
      return [];
    }
  }

  // Calculate exponential backoff minutes based on fail count
  private calculateBackoffMinutes(failCount: number): number {
    // Base backoff: 30 minutes
    // Exponential backoff: 30min, 1hr, 2hr, 4hr, 8hr, 16hr, max 24hr
    const baseMinutes = 30;
    const maxMinutes = 24 * 60; // 24 hours
    const backoffMinutes = baseMinutes * Math.pow(2, Math.min(failCount, 5)); // Cap at 2^5 = 32x
    return Math.min(backoffMinutes, maxMinutes);
  }

  // Private method to perform the actual link checking
  private async performLinkCheck(
    url: string,
  ): Promise<{ linkStatus: string; httpStatus?: number }> {
    try {
      // Use the comprehensive SSRF-safe validation from the link checker service
      // This ensures consistent security across all link checking operations
      const validation = await this.validateUrlForSsrf(url);
      if (!validation.valid) {
        console.warn(`Link check blocked for security: ${validation.reason} - URL: ${url}`);
        return { linkStatus: 'broken', httpStatus: undefined };
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        let redirectCount = 0;
        let currentUrl = url;
        let response: Response;
        const maxRedirects = 5;
        const maxContentLength = 1024 * 1024 * 10; // 10MB limit

        // Custom fetch with redirect limit and content length checking
        const fetchWithLimits = async (fetchUrl: string, method: 'HEAD' | 'GET') => {
          const fetchResponse = await fetch(fetchUrl, {
            method,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0; +bookmark-checker)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              DNT: '1',
              Connection: 'close',
              'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
            redirect: 'manual', // Handle redirects manually for better control
          });

          // Check content length if available
          const contentLength = fetchResponse.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > maxContentLength) {
            throw new Error(`Content too large: ${contentLength} bytes`);
          }

          return fetchResponse;
        };

        // Try HEAD request first (faster), handle redirects manually
        response = await fetchWithLimits(currentUrl, 'HEAD');

        // Handle redirects manually with limits
        while (response.status >= 300 && response.status < 400 && redirectCount < maxRedirects) {
          const location = response.headers.get('location');
          if (!location) {
            break;
          }

          // Validate redirect URL for SSRF
          const redirectUrl = new URL(location, currentUrl).toString();
          const redirectValidation = await this.validateUrlForSsrf(redirectUrl);
          if (!redirectValidation.valid) {
            console.warn(
              `Redirect blocked for security: ${redirectValidation.reason} - Redirect URL: ${redirectUrl}`,
            );
            return { linkStatus: 'broken', httpStatus: response.status };
          }

          redirectCount++;
          currentUrl = redirectUrl;
          response = await fetchWithLimits(currentUrl, 'HEAD');
        }

        // If we hit redirect limit, return broken
        if (redirectCount >= maxRedirects && response.status >= 300 && response.status < 400) {
          console.warn(`Too many redirects (${redirectCount}) for URL: ${url}`);
          return { linkStatus: 'broken', httpStatus: response.status };
        }

        // If HEAD fails with 405 (Method Not Allowed), try GET
        if (response.status === 405) {
          response = await fetchWithLimits(currentUrl, 'GET');
        }

        clearTimeout(timeoutId);

        // Classify status
        const status = response.status;
        if (status >= 200 && status < 300) {
          return { linkStatus: 'ok', httpStatus: status };
        } else if (status >= 400) {
          return { linkStatus: 'broken', httpStatus: status };
        } else {
          // 3xx codes that we couldn't follow should be considered OK if valid
          return { linkStatus: 'ok', httpStatus: status };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            return { linkStatus: 'timeout', httpStatus: undefined };
          }

          // Log security-related errors differently
          if (fetchError.message.includes('Content too large')) {
            console.warn(`Content size limit exceeded for URL: ${url}`);
            return { linkStatus: 'broken', httpStatus: undefined };
          }
        }

        // Network errors, DNS failures, etc.
        console.warn(`Network error for URL ${url}:`, fetchError);
        return { linkStatus: 'broken', httpStatus: undefined };
      }
    } catch (error) {
      // Invalid URL format or validation error
      console.warn(`URL validation/parsing error for ${url}:`, error);
      return { linkStatus: 'broken', httpStatus: undefined };
    }
  }

  // Add the same comprehensive SSRF validation from link checker service
  private async validateUrlForSsrf(url: string): Promise<{ valid: boolean; reason?: string }> {
    const { URL } = await import('url');
    const dns = await import('dns');
    const { promisify } = await import('util');

    const dnsLookup = promisify(dns.lookup);

    const isPrivateIP = (ip: string): boolean => {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some((part) => isNaN(part) || part < 0 || part > 255)) {
        return true; // Invalid IP, consider it private for safety
      }

      // IPv4 private ranges
      if (parts[0] === 10) return true; // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
      if (parts[0] === 127) return true; // 127.0.0.0/8 (localhost)
      if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local)
      if (parts[0] === 224) return true; // 224.0.0.0/4 (multicast)
      if (parts[0] >= 240) return true; // 240.0.0.0/4 (reserved)

      return false;
    };

    const isPrivateIPv6 = (ip: string): boolean => {
      if (ip === '::1') return true;
      if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
      if (ip.startsWith('fe80:')) return true;
      if (ip.startsWith('::ffff:')) {
        const ipv4Part = ip.substring(7);
        return isPrivateIP(ipv4Part);
      }
      return false;
    };

    const isBlockedHostname = (hostname: string): boolean => {
      const blocked = [
        'localhost',
        '127.0.0.1',
        '::1',
        '0.0.0.0',
        'metadata.google.internal',
        '169.254.169.254',
        'metadata.azure.com',
        'metadata.packet.net',
      ];
      return blocked.includes(hostname.toLowerCase());
    };

    try {
      const parsedUrl = new URL(url);

      // Protocol validation
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          valid: false,
          reason: `Blocked protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.`,
        };
      }

      // Hostname validation
      const hostname = parsedUrl.hostname.toLowerCase();
      if (isBlockedHostname(hostname)) {
        console.warn(`SSRF attempt blocked: ${hostname} from URL ${url}`);
        return { valid: false, reason: `Blocked hostname: ${hostname}` };
      }

      // DNS lookup and IP validation
      try {
        const { address, family } = await dnsLookup(hostname);
        if (family === 4 && isPrivateIP(address)) {
          console.warn(`SSRF attempt blocked: Private IPv4 ${address} for hostname ${hostname}`);
          return { valid: false, reason: `Blocked private IPv4 address: ${address}` };
        }
        if (family === 6 && isPrivateIPv6(address)) {
          console.warn(`SSRF attempt blocked: Private IPv6 ${address} for hostname ${hostname}`);
          return { valid: false, reason: `Blocked private IPv6 address: ${address}` };
        }
      } catch (dnsError) {
        console.warn(`DNS lookup failed for ${hostname}:`, dnsError);
        return { valid: false, reason: 'DNS lookup failed - invalid or unreachable hostname' };
      }

      // Port validation
      const port = parsedUrl.port;
      if (port) {
        const portNum = parseInt(port, 10);
        const blockedPorts = [
          22, 23, 25, 53, 135, 139, 445, 993, 995, 1433, 3306, 3389, 5432, 5984, 6379, 8080, 9200,
          27017,
        ];
        if (blockedPorts.includes(portNum)) {
          console.warn(`SSRF attempt blocked: Dangerous port ${portNum} for URL ${url}`);
          return { valid: false, reason: `Blocked port: ${portNum}` };
        }
      }

      return { valid: true };
    } catch (error) {
      console.warn(`URL validation error for ${url}:`, error);
      return { valid: false, reason: 'Invalid URL format' };
    }
  }
}
