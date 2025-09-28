import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { setupAuth } from './auth';
import { userLinkCheckerService } from './user-link-checker-service';
import { storage } from './storage';

// Import all route modules
import { registerAuthRoutes } from './routes/auth-routes';
import { registerBookmarkRoutes } from './routes/bookmark-routes';
import { registerAiRoutes } from './routes/ai-routes';
import { registerCategoryRoutes } from './routes/category-routes';
import { registerStatsRoutes } from './routes/stats-routes';
import { registerPreferencesRoutes } from './routes/preferences-routes';
import { registerScreenshotRoutes } from './routes/screenshot-routes';
import { registerLinkCheckerRoutes } from './routes/link-checker-routes';
import { registerDomainTagsRoutes } from './routes/domain-tags-routes';
import { registerDocumentationRoutes } from './routes/documentation-routes';
import { registerBookmarkDiscoveryRoutes } from './routes/bookmark-discovery-routes';
import { registerAiFeedRoutes } from './routes/ai-feed-routes';
import { registerAIRewriteRoutes } from './routes/ai-rewrite-routes';
import { registerPushSubscriptionRoutes } from './routes/push-subscription-routes';

const CANONICAL_BASE_URL =
  process.env.CANONICAL_BASE_URL?.trim() || process.env.VITE_PUBLIC_BASE_URL?.trim();

const canonicalUrl = (() => {
  if (!CANONICAL_BASE_URL) return undefined;
  try {
    return new URL(CANONICAL_BASE_URL);
  } catch (error) {
    console.warn('Invalid canonical base URL:', CANONICAL_BASE_URL, error);
    return undefined;
  }
})();

const isProduction = process.env.NODE_ENV === 'production';

function normalizeHostForProtocol(host: string, protocol: string): string {
  const [hostname, port] = host.toLowerCase().split(':');
  const defaultPort = protocol === 'https' ? '443' : protocol === 'http' ? '80' : '';
  if (!port || port === defaultPort) {
    return hostname;
  }
  return `${hostname}:${port}`;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(':')[0]?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export async function registerRoutes(app: Express): Promise<Server> {
  if (isProduction && canonicalUrl) {
    const canonicalProtocol = canonicalUrl.protocol.replace(':', '');
    const normalizedCanonicalHost = normalizeHostForProtocol(canonicalUrl.host, canonicalProtocol);

    app.use((req, res, next) => {
      const hostHeader = req.headers.host;
      if (!hostHeader || isLoopbackHost(hostHeader)) {
        return next();
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      const requestProtocol = req.protocol;
      const normalizedRequestHost = normalizeHostForProtocol(hostHeader, requestProtocol);

      const protocolMismatch = canonicalProtocol && requestProtocol !== canonicalProtocol;
      const hostMismatch = normalizedRequestHost !== normalizedCanonicalHost;

      if (protocolMismatch || hostMismatch) {
        const redirectUrl = `${canonicalUrl.protocol}//${canonicalUrl.host}${req.originalUrl || req.url}`;
        res.redirect(301, redirectUrl);
        return;
      }

      next();
    });
  }

  // Setup authentication first - this adds passport middleware and session support
  setupAuth(app);

  // Middleware: apply session timeout based on user preferences each request (rolling)
  app.use(async (req: any, _res, next) => {
    try {
      if (req.isAuthenticated && req.isAuthenticated()) {
        const prefs = await storage.getUserPreferences(req.user.id);
        const minutes = Math.max(1, prefs?.sessionTimeoutMinutes ?? 30);
        // Update cookie maxAge; express-session with rolling: true will refresh expiry
        req.session.cookie.maxAge = minutes * 60 * 1000;
        // Per-user link check scheduling
        if (prefs?.linkCheckEnabled) {
          userLinkCheckerService.setUserConfig(
            req.user.id,
            true,
            Math.max(1, prefs.linkCheckIntervalMinutes ?? 30),
            prefs.linkCheckBatchSize ?? 25,
          );
        } else {
          userLinkCheckerService.setUserConfig(req.user.id, false, 30, 25);
        }
      }
    } catch (e) {
      // Non-fatal
    }
    next();
  });

  // Register all route modules
  registerAuthRoutes(app);
  registerBookmarkDiscoveryRoutes(app); // Must be before bookmark routes to avoid conflicts
  registerBookmarkRoutes(app);
  registerAiRoutes(app);
  registerAiFeedRoutes(app);
  registerAIRewriteRoutes(app);
  registerCategoryRoutes(app);
  registerStatsRoutes(app);
  registerPreferencesRoutes(app);
  registerPushSubscriptionRoutes(app);
  registerScreenshotRoutes(app);
  registerLinkCheckerRoutes(app);
  registerDomainTagsRoutes(app);
  registerDocumentationRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
