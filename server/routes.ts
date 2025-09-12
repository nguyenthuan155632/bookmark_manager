import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookmarkSchema, insertCategorySchema, insertUserPreferencesSchema } from "@shared/schema";
import { requireAuth, setupAuth } from "./auth";
import { z } from "zod";

// Bulk operation schemas
const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one bookmark ID is required"),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional()
});

const bulkMoveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one bookmark ID is required"),
  categoryId: z.number().int().positive().nullable(),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional()
});

// Vensera user ID for temporary fallback access
const VENSERA_USER_ID = 'c73053f2-ec15-438c-8af0-3bf8c7954454';

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first - this adds passport middleware and session support
  setupAuth(app);

  // Helper function to get userId from request or fallback to vensera
  const getUserId = (req: any): string => {
    return req.isAuthenticated() ? req.user.id : VENSERA_USER_ID;
  };

  // Helper function to verify passcode for protected bookmark operations
  const verifyProtectedBookmarkAccess = async (userId: string, bookmarkId: number, providedPasscode: string | undefined, req: any): Promise<{ success: boolean; error?: { status: number; message: string } }> => {
    // Get the bookmark to check if it's protected
    const bookmark = await storage.getBookmark(userId, bookmarkId);
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
    const isValid = await storage.verifyBookmarkPasscode(userId, bookmarkId, providedPasscode);
    
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


  // Bookmark routes
  app.get("/api/bookmarks", async (req, res) => {
    try {
      const userId = getUserId(req);
      const search = req.query.search as string;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const isFavorite = req.query.isFavorite === "true" ? true : undefined;
      const tags = req.query.tags ? (req.query.tags as string).split(",") : undefined;
      const sortBy = (req.query.sortBy as "name" | "createdAt" | "isFavorite") || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const bookmarks = await storage.getBookmarks(userId, {
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
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bookmark = await storage.getBookmark(userId, id);
      
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      res.json(bookmark);
    } catch (error) {
      console.error("Error fetching bookmark:", error);
      res.status(500).json({ message: "Failed to fetch bookmark" });
    }
  });

  app.post("/api/bookmarks", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertBookmarkSchema.parse(req.body);
      const bookmark = await storage.createBookmark(userId, data);
      res.status(201).json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bookmark data", errors: error.errors });
      }
      console.error("Error creating bookmark:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.patch("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
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
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res.status(accessResult.error!.status).json({ message: accessResult.error!.message });
      }
      
      // Proceed with update if access is granted
      const bookmark = await storage.updateBookmark(userId, id, data);
      res.json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bookmark data", errors: error.errors });
      }
      console.error("Error updating bookmark:", error);
      res.status(500).json({ message: "Failed to update bookmark" });
    }
  });

  app.delete("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      
      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bookmark ID" });
      }
      
      // Extract passcode from request body for security verification
      const { passcode } = req.body;
      
      // Verify access for protected bookmarks
      const accessResult = await verifyProtectedBookmarkAccess(userId, id, passcode, req);
      if (!accessResult.success) {
        return res.status(accessResult.error!.status).json({ message: accessResult.error!.message });
      }
      
      // Proceed with deletion if access is granted
      await storage.deleteBookmark(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  // Passcode verification endpoint
  app.post("/api/bookmarks/:id/verify-passcode", async (req, res) => {
    try {
      const userId = getUserId(req);
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
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      const isValid = await storage.verifyBookmarkPasscode(userId, id, passcode);
      
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

  // Bookmark sharing endpoints
  app.patch("/api/bookmarks/:id/share", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      
      // Validate bookmark ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bookmark ID" });
      }
      
      // Validate request body using Zod
      const shareSchema = z.object({
        isShared: z.boolean()
      });
      
      const { isShared } = shareSchema.parse(req.body);
      
      // Get the bookmark first to check if it's protected
      const bookmark = await storage.getBookmark(userId, id);
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      // Prevent sharing of protected bookmarks
      if (bookmark.hasPasscode && isShared) {
        return res.status(403).json({ message: "Protected bookmarks cannot be shared" });
      }
      
      // Update bookmark sharing status
      const updatedBookmark = await storage.setBookmarkSharing(userId, id, isShared);
      res.json(updatedBookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error updating bookmark sharing:", error);
      res.status(500).json({ message: "Failed to update bookmark sharing" });
    }
  });

  // Public shared bookmark access (no authentication required)
  app.get("/api/shared/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      
      if (!shareId) {
        return res.status(400).json({ message: "Share ID is required" });
      }
      
      const sharedBookmark = await storage.getSharedBookmark(shareId);
      
      if (!sharedBookmark) {
        return res.status(404).json({ message: "Shared bookmark not found" });
      }
      
      res.json(sharedBookmark);
    } catch (error) {
      console.error("Error fetching shared bookmark:", error);
      res.status(500).json({ message: "Failed to fetch shared bookmark" });
    }
  });

  // Bulk operations for bookmarks
  app.post("/api/bookmarks/bulk/delete", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const { ids, passcodes } = bulkDeleteSchema.parse(req.body);
      
      // Perform bulk deletion
      const result = await storage.bulkDeleteBookmarks(userId, ids, passcodes);
      
      // Return results
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      console.error("Error in bulk delete bookmarks:", error);
      res.status(500).json({ message: "Failed to delete bookmarks" });
    }
  });

  app.patch("/api/bookmarks/bulk/move", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const { ids, categoryId, passcodes } = bulkMoveSchema.parse(req.body);
      
      // Perform bulk move
      const result = await storage.bulkMoveBookmarks(userId, ids, categoryId, passcodes);
      
      // Return results
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      console.error("Error in bulk move bookmarks:", error);
      res.status(500).json({ message: "Failed to move bookmarks" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const userId = getUserId(req);
      const withCounts = req.query.withCounts === "true";
      const categories = withCounts 
        ? await storage.getCategoriesWithCounts(userId)
        : await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(userId, id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(userId, data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const data = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(userId, id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      await storage.deleteCategory(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getBookmarkStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User Preferences routes
  app.get("/api/preferences", async (req, res) => {
    try {
      const userId = getUserId(req);
      const preferences = await storage.getUserPreferences(userId);
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

  app.patch("/api/preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id; // Use authenticated user ID only
      const data = insertUserPreferencesSchema.partial().parse(req.body);
      const preferences = await storage.updateUserPreferences(userId, data);
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
