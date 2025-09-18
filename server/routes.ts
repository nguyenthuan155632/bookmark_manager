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

export async function registerRoutes(app: Express): Promise<Server> {
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
  registerCategoryRoutes(app);
  registerStatsRoutes(app);
  registerPreferencesRoutes(app);
  registerScreenshotRoutes(app);
  registerLinkCheckerRoutes(app);
  registerDomainTagsRoutes(app);
  registerDocumentationRoutes(app);
  
  const httpServer = createServer(app);
  return httpServer;
}
