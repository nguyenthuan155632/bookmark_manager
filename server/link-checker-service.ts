import { storage } from "./storage";
import { URL } from 'url';
import * as dns from 'dns';
import { promisify } from 'util';

// DNS lookup promisified
const dnsLookup = promisify(dns.lookup);

// Private IP range checks
const isPrivateIP = (ip: string): boolean => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
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

// IPv6 private range checks
const isPrivateIPv6 = (ip: string): boolean => {
  // IPv6 localhost
  if (ip === '::1') return true;
  
  // IPv6 private ranges (simplified check)
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7
  if (ip.startsWith('fe80:')) return true; // fe80::/10 (link-local)
  if (ip.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 addresses
    const ipv4Part = ip.substring(7);
    return isPrivateIP(ipv4Part);
  }
  
  return false;
};

// Hostname blocklist
const isBlockedHostname = (hostname: string): boolean => {
  const blocked = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'metadata.google.internal', // Google Cloud metadata
    '169.254.169.254', // AWS/Azure metadata
    'metadata.azure.com',
    'metadata.packet.net'
  ];
  
  return blocked.includes(hostname.toLowerCase());
};

export class LinkCheckerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isCheckInProgress = false;
  private lastRunAt: Date | null = null;
  private readonly CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly BATCH_SIZE = 25; // Check 25 bookmarks per batch
  private readonly MAX_CONCURRENT_CHECKS = 5; // Max concurrent link checks
  private readonly MAX_CONTENT_LENGTH = 1024 * 1024 * 10; // 10MB limit
  private readonly MAX_REDIRECTS = 5; // Maximum redirects to follow
  private readonly REQUEST_TIMEOUT = 10000; // 10 second timeout

  constructor() {
    console.log('Link Checker Service initialized');
  }

  /**
   * Start the periodic link checking service
   */
  start(): void {
    if (this.isRunning) {
      console.log('Link Checker Service is already running');
      return;
    }

    console.log('Starting Link Checker Service...');
    this.isRunning = true;

    // Run an initial check after 1 minute (to allow server to fully start)
    setTimeout(() => {
      this.performPeriodicCheck();
    }, 60 * 1000);

    // Set up the recurring interval
    this.intervalId = setInterval(() => {
      this.performPeriodicCheck();
    }, this.CHECK_INTERVAL);

    console.log(`Link Checker Service started with ${this.CHECK_INTERVAL / 1000 / 60} minute intervals`);
  }

  /**
   * Stop the periodic link checking service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Link Checker Service is not running');
      return;
    }

    console.log('Stopping Link Checker Service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Link Checker Service stopped');
  }

  /**
   * Get the current status of the service
   */
  getStatus(): { 
    isRunning: boolean; 
    isCheckInProgress: boolean;
    lastRunAt: Date | null;
    nextCheckIn?: number;
    nextRunAt?: Date;
  } {
    const nextRunAt = this.lastRunAt 
      ? new Date(this.lastRunAt.getTime() + this.CHECK_INTERVAL)
      : undefined;
      
    return {
      isRunning: this.isRunning,
      isCheckInProgress: this.isCheckInProgress,
      lastRunAt: this.lastRunAt,
      nextCheckIn: this.isRunning ? this.CHECK_INTERVAL : undefined,
      nextRunAt: this.isRunning ? nextRunAt : undefined,
    };
  }

  /**
   * Manually trigger a link check cycle (for testing/admin purposes)
   */
  async triggerManualCheck(): Promise<{ message: string; results?: any }> {
    try {
      console.log('Manual link check triggered');
      const results = await this.performPeriodicCheck();
      return {
        message: 'Manual link check completed',
        results,
      };
    } catch (error) {
      console.error('Manual link check failed:', error);
      return {
        message: 'Manual link check failed',
        results: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Perform the actual periodic link checking
   */
  private async performPeriodicCheck(): Promise<any> {
    if (!this.isRunning) {
      console.log('Link checker service is stopped, skipping check');
      return { skipped: true, reason: 'Service not running' };
    }

    // Prevent overlapping runs
    if (this.isCheckInProgress) {
      console.log('Link check already in progress, skipping this cycle');
      return { skipped: true, reason: 'Check already in progress' };
    }

    console.log('Starting periodic link check...');
    this.isCheckInProgress = true;
    this.lastRunAt = new Date();
    const startTime = Date.now();

    try {
      // Get bookmarks that need checking (prioritize older/unchecked)
      const bookmarksToCheck = await storage.getBookmarksForLinkCheck(this.BATCH_SIZE);
      
      if (bookmarksToCheck.length === 0) {
        console.log('No bookmarks need checking at this time');
        return { checked: 0, message: 'No bookmarks need checking' };
      }

      console.log(`Found ${bookmarksToCheck.length} bookmarks to check`);

      const results = {
        total: bookmarksToCheck.length,
        checked: 0,
        ok: 0,
        broken: 0,
        timeout: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process bookmarks in smaller concurrent batches
      for (let i = 0; i < bookmarksToCheck.length; i += this.MAX_CONCURRENT_CHECKS) {
        const batch = bookmarksToCheck.slice(i, i + this.MAX_CONCURRENT_CHECKS);
        
        const batchPromises = batch.map(async (bookmark) => {
          try {
            // Simulate checking as if done by system user (no specific userId)
            // We'll call the internal performLinkCheck method directly
            const result = await this.performSingleLinkCheck(bookmark.url);
            
            // Update the bookmark's link status
            await storage.updateLinkStatus(
              bookmark.id,
              result.linkStatus,
              result.httpStatus,
              result.linkStatus === 'ok' ? 0 : undefined // Reset fail count on success
            );

            results.checked++;
            switch (result.linkStatus) {
              case 'ok':
                results.ok++;
                break;
              case 'broken':
                results.broken++;
                break;
              case 'timeout':
                results.timeout++;
                break;
            }

            console.log(`✓ Checked bookmark ${bookmark.id}: ${result.linkStatus} (${result.httpStatus || 'N/A'})`);
          } catch (error) {
            console.error(`✗ Failed to check bookmark ${bookmark.id}:`, error);
            results.failed++;
            results.errors.push(`Bookmark ${bookmark.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Update with error status
            try {
              await storage.updateLinkStatus(bookmark.id, 'broken', undefined, undefined);
            } catch (updateError) {
              console.error(`Failed to update error status for bookmark ${bookmark.id}:`, updateError);
            }
          }
        });

        // Wait for this batch to complete
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to be respectful to external servers
        if (i + this.MAX_CONCURRENT_CHECKS < bookmarksToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Periodic link check completed in ${duration}ms`);
      console.log(`Results: ${results.checked} checked, ${results.ok} ok, ${results.broken} broken, ${results.timeout} timeout, ${results.failed} failed`);

      return results;
    } catch (error) {
      console.error('Error during periodic link check:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime 
      };
    } finally {
      // Always reset the in-progress flag
      this.isCheckInProgress = false;
    }
  }

  /**
   * Perform comprehensive SSRF-safe URL validation
   */
  private async validateUrlForSsrf(url: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const parsedUrl = new URL(url);
      
      // 1. Protocol validation - only allow http/https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { 
          valid: false, 
          reason: `Blocked protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.` 
        };
      }

      // 2. Hostname validation
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Block dangerous hostnames
      if (isBlockedHostname(hostname)) {
        console.warn(`SSRF attempt blocked: ${hostname} from URL ${url}`);
        return { 
          valid: false, 
          reason: `Blocked hostname: ${hostname}` 
        };
      }

      // 3. IP address validation via DNS lookup
      try {
        const { address, family } = await dnsLookup(hostname);
        
        // Check IPv4 private ranges
        if (family === 4 && isPrivateIP(address)) {
          console.warn(`SSRF attempt blocked: Private IPv4 ${address} for hostname ${hostname}`);
          return { 
            valid: false, 
            reason: `Blocked private IPv4 address: ${address}` 
          };
        }
        
        // Check IPv6 private ranges
        if (family === 6 && isPrivateIPv6(address)) {
          console.warn(`SSRF attempt blocked: Private IPv6 ${address} for hostname ${hostname}`);
          return { 
            valid: false, 
            reason: `Blocked private IPv6 address: ${address}` 
          };
        }
      } catch (dnsError) {
        // DNS lookup failed - could be invalid domain or network issue
        console.warn(`DNS lookup failed for ${hostname}:`, dnsError);
        return { 
          valid: false, 
          reason: 'DNS lookup failed - invalid or unreachable hostname' 
        };
      }

      // 4. Port validation - block common internal service ports
      const port = parsedUrl.port;
      if (port) {
        const portNum = parseInt(port, 10);
        const blockedPorts = [
          22,   // SSH
          23,   // Telnet
          25,   // SMTP
          53,   // DNS
          135,  // RPC
          139,  // NetBIOS
          445,  // SMB
          993,  // IMAPS
          995,  // POP3S
          1433, // SQL Server
          3306, // MySQL
          3389, // RDP
          5432, // PostgreSQL
          5984, // CouchDB
          6379, // Redis
          8080, // Alternative HTTP (often internal)
          9200, // Elasticsearch
          27017 // MongoDB
        ];
        
        if (blockedPorts.includes(portNum)) {
          console.warn(`SSRF attempt blocked: Dangerous port ${portNum} for URL ${url}`);
          return { 
            valid: false, 
            reason: `Blocked port: ${portNum}` 
          };
        }
      }

      return { valid: true };
    } catch (error) {
      console.warn(`URL validation error for ${url}:`, error);
      return { 
        valid: false, 
        reason: 'Invalid URL format' 
      };
    }
  }

  /**
   * Perform a single link check with comprehensive SSRF protection
   */
  private async performSingleLinkCheck(url: string): Promise<{ linkStatus: string; httpStatus?: number }> {
    try {
      // 1. Comprehensive SSRF validation
      const validation = await this.validateUrlForSsrf(url);
      if (!validation.valid) {
        console.warn(`Link check blocked for security: ${validation.reason} - URL: ${url}`);
        return { linkStatus: 'broken', httpStatus: undefined };
      }

      // 2. Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      try {
        let redirectCount = 0;
        let currentUrl = url;
        let response: Response;

        // 3. Custom fetch with redirect limit and content length checking
        const fetchWithLimits = async (fetchUrl: string, method: 'HEAD' | 'GET') => {
          const fetchResponse = await fetch(fetchUrl, {
            method,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0; +bookmark-checker)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'close',
              'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
            redirect: 'manual', // Handle redirects manually for better control
          });
          
          // Check content length if available
          const contentLength = fetchResponse.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > this.MAX_CONTENT_LENGTH) {
            throw new Error(`Content too large: ${contentLength} bytes`);
          }
          
          return fetchResponse;
        };

        // 4. Try HEAD request first (faster), handle redirects manually
        response = await fetchWithLimits(currentUrl, 'HEAD');
        
        // Handle redirects manually with limits
        while (response.status >= 300 && response.status < 400 && redirectCount < this.MAX_REDIRECTS) {
          const location = response.headers.get('location');
          if (!location) {
            break;
          }
          
          // Validate redirect URL for SSRF
          const redirectUrl = new URL(location, currentUrl).toString();
          const redirectValidation = await this.validateUrlForSsrf(redirectUrl);
          if (!redirectValidation.valid) {
            console.warn(`Redirect blocked for security: ${redirectValidation.reason} - Redirect URL: ${redirectUrl}`);
            return { linkStatus: 'broken', httpStatus: response.status };
          }
          
          redirectCount++;
          currentUrl = redirectUrl;
          response = await fetchWithLimits(currentUrl, 'HEAD');
        }
        
        // If we hit redirect limit, return broken
        if (redirectCount >= this.MAX_REDIRECTS && response.status >= 300 && response.status < 400) {
          console.warn(`Too many redirects (${redirectCount}) for URL: ${url}`);
          return { linkStatus: 'broken', httpStatus: response.status };
        }

        // 5. If HEAD fails with 405 (Method Not Allowed), try GET
        if (response.status === 405) {
          response = await fetchWithLimits(currentUrl, 'GET');
        }

        clearTimeout(timeoutId);

        // 6. Classify status
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
}

// Create and export a singleton instance
export const linkCheckerService = new LinkCheckerService();