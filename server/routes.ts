import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookmarkSchema, insertCategorySchema, insertUserPreferencesSchema } from "@shared/schema";
import { z } from "zod";
import rateLimit from "express-rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limiting middleware for passcode verification
  // Per-IP rate limiting (5 attempts per 15 minutes per IP)
  const passcodeVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      message: "Too many passcode verification attempts. Please try again in 15 minutes.",
      retryAfter: 900 // seconds
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Use default IP-based key generation (handles IPv6 properly)
    skip: (req) => {
      // Skip rate limiting if bookmark ID is invalid
      const bookmarkId = parseInt(req.params.id);
      return isNaN(bookmarkId);
    },
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP ${req.ip} on passcode verification`);
      res.status(429).json({
        message: "Too many passcode verification attempts. Please try again later.",
        retryAfter: 900
      });
    }
  });

  // Helper function to verify passcode for protected bookmark operations
  const verifyProtectedBookmarkAccess = async (bookmarkId: number, providedPasscode: string | undefined, req: any): Promise<{ success: boolean; error?: { status: number; message: string } }> => {
    // Get the bookmark to check if it's protected
    const bookmark = await storage.getBookmark(bookmarkId);
    if (!bookmark) {
      return { success: false, error: { status: 404, message: "Bookmark not found" } };
    }

    // If bookmark is not protected, allow access
    if (!bookmark.hasPasscode) {
      return { success: true };
    }

    // If bookmark is protected, require passcode
    if (!providedPasscode || typeof providedPasscode !== 'string') {
      return { 
        success: false, 
        error: { 
          status: 401, 
          message: "Passcode required for protected bookmark" 
        } 
      };
    }

    // Validate passcode format
    if (providedPasscode.length < 4 || providedPasscode.length > 64) {
      return { 
        success: false, 
        error: { 
          status: 400, 
          message: "Invalid passcode format" 
        } 
      };
    }

    // Verify the passcode
    const isValid = await storage.verifyBookmarkPasscode(bookmarkId, providedPasscode);
    
    // Log failed attempts for monitoring
    if (!isValid) {
      console.warn(`Failed passcode attempt for protected bookmark ${bookmarkId} from IP ${req.ip}`);
      return { 
        success: false, 
        error: { 
          status: 401, 
          message: "Invalid passcode" 
        } 
      };
    }

    return { success: true };
  };

  // Rate limiting middleware for bookmark operations (PATCH/DELETE)
  const bookmarkOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
      message: "Too many bookmark operations. Please try again later.",
      retryAfter: 900 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP ${req.ip} on bookmark operations`);
      res.status(429).json({
        message: "Too many bookmark operations. Please try again later.",
        retryAfter: 900
      });
    }
  });

  // Bookmark routes
  app.get("/api/bookmarks", async (req, res) => {
    try {
      const search = req.query.search as string;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const isFavorite = req.query.isFavorite === "true" ? true : undefined;
      const tags = req.query.tags ? (req.query.tags as string).split(",") : undefined;
      const sortBy = (req.query.sortBy as "name" | "createdAt" | "isFavorite") || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const bookmarks = await storage.getBookmarks({
        search,
        categoryId,
        isFavorite,
        tags,
        sortBy,
        sortOrder,
      });

      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  app.get("/api/bookmarks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bookmark = await storage.getBookmark(id);
      
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      res.json(bookmark);
    } catch (error) {
      console.error("Error fetching bookmark:", error);
      res.status(500).json({ message: "Failed to fetch bookmark" });
    }
  });

  app.post("/api/bookmarks", async (req, res) => {
    try {
      const data = insertBookmarkSchema.parse(req.body);
      const bookmark = await storage.createBookmark(data);
      res.status(201).json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bookmark data", errors: error.errors });
      }
      console.error("Error creating bookmark:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.patch("/api/bookmarks/:id", bookmarkOperationLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bookmark ID" });
      }
      
      // Parse and validate the data first
      const data = insertBookmarkSchema.partial().parse(req.body);
      
      // Extract passcode from request body for security verification
      const { passcode } = req.body;
      
      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(id, passcode, req);
      if (!accessResult.success) {
        return res.status(accessResult.error!.status).json({ message: accessResult.error!.message });
      }
      
      // Proceed with update if access is granted
      const bookmark = await storage.updateBookmark(id, data);
      res.json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bookmark data", errors: error.errors });
      }
      console.error("Error updating bookmark:", error);
      res.status(500).json({ message: "Failed to update bookmark" });
    }
  });

  app.delete("/api/bookmarks/:id", bookmarkOperationLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bookmark ID" });
      }
      
      // Extract passcode from request body for security verification
      const { passcode } = req.body;
      
      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(id, passcode, req);
      if (!accessResult.success) {
        return res.status(accessResult.error!.status).json({ message: accessResult.error!.message });
      }
      
      // Proceed with deletion if access is granted
      await storage.deleteBookmark(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  // Passcode verification endpoint with rate limiting
  app.post("/api/bookmarks/:id/verify-passcode", passcodeVerificationLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bookmark ID" });
      }
      
      const { passcode } = req.body;
      
      // Validate passcode input
      if (!passcode || typeof passcode !== 'string') {
        return res.status(400).json({ message: "Passcode is required and must be a string" });
      }
      
      if (passcode.length < 4 || passcode.length > 64) {
        return res.status(400).json({ message: "Invalid passcode format" });
      }
      
      // Check if bookmark exists first (avoid revealing existence through timing)
      const bookmark = await storage.getBookmark(id);
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      const isValid = await storage.verifyBookmarkPasscode(id, passcode);
      
      // Log failed attempts for monitoring
      if (!isValid) {
        console.warn(`Failed passcode attempt for bookmark ${id} from IP ${req.ip}`);
      }
      
      res.json({ valid: isValid });
    } catch (error) {
      console.error("Error verifying passcode:", error);
      res.status(500).json({ message: "Failed to verify passcode" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const withCounts = req.query.withCounts === "true";
      const categories = withCounts 
        ? await storage.getCategoriesWithCounts()
        : await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getBookmarkStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User Preferences routes
  app.get("/api/preferences", async (req, res) => {
    try {
      const preferences = await storage.getUserPreferences();
      if (!preferences) {
        // Return default preferences if none exist
        return res.json({
          theme: "light",
          viewMode: "grid"
        });
      }
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.patch("/api/preferences", async (req, res) => {
    try {
      const data = insertUserPreferencesSchema.partial().parse(req.body);
      const preferences = await storage.updateUserPreferences(data);
      res.json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid preferences data", errors: error.errors });
      }
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
