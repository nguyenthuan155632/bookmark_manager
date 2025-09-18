import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import { insertCategorySchema } from '@shared/schema';
import { getUserId } from './shared';

export function registerCategoryRoutes(app: Express) {
  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const userId = getUserId(req);
      const withCounts = req.query.withCounts === 'true';
      const categories = withCounts
        ? await storage.getCategoriesWithCounts(userId)
        : await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.get('/api/categories/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(userId, id);

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ message: 'Failed to fetch category' });
    }
  });

  app.post('/api/categories', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(userId, data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error creating category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  // Update multiple categories sort order (must come before /:id route)
  app.patch('/api/categories/sort-order', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { sortOrders } = req.body;

      if (!Array.isArray(sortOrders)) {
        return res.status(400).json({ message: 'sortOrders must be an array' });
      }

      // Validate each sort order entry
      for (const item of sortOrders) {
        if (typeof item.id !== 'number' || typeof item.sortOrder !== 'number') {
          return res
            .status(400)
            .json({ message: 'Each sort order entry must have id and sortOrder as numbers' });
        }
        if (isNaN(item.id) || isNaN(item.sortOrder)) {
          return res.status(400).json({ message: 'id and sortOrder must be valid numbers' });
        }
        if (item.id <= 0) {
          return res.status(400).json({ message: 'id must be a positive number' });
        }
      }

      const categories = await storage.updateCategoriesSortOrder(userId, sortOrders);
      res.json(categories);
    } catch (error) {
      console.error('Error updating categories sort order:', error);
      res.status(500).json({ message: 'Failed to update categories sort order' });
    }
  });

  app.patch('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const data = insertCategorySchema.partial().parse(req.body);

      // Check if data is empty
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      const category = await storage.updateCategory(userId, id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error updating category:', error);
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);

      // Ensure category exists and belongs to user
      const cat = await storage.getCategory(userId, id);
      if (!cat) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Determine strategy (optional): 'unlink' | 'delete'
      const strategy = (req.query.strategy as string | undefined)?.toLowerCase();

      // Get bookmarks in this category to decide behavior
      const bookmarksInCategory = await storage.getBookmarks(userId, { categoryId: id });
      const count = bookmarksInCategory.length;

      if (count === 0) {
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      if (!strategy) {
        return res.status(409).json({
          message: 'Category contains bookmarks. Specify strategy query param.',
          required: {
            strategy: ['unlink', 'delete'],
          },
          count,
        });
      }

      if (strategy === 'unlink') {
        // Unlink all bookmarks from this category, then delete category
        await storage.unlinkCategoryBookmarks(userId, id);
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      if (strategy === 'delete') {
        // Hard delete all bookmarks in this category (ignores passcodes)
        await storage.deleteBookmarksByCategory(userId, id);
        await storage.deleteCategory(userId, id);
        return res.status(204).send();
      }

      return res.status(400).json({ message: 'Invalid strategy. Use unlink or delete.' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // Update category sort order
  app.patch('/api/categories/:id/sort-order', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const { sortOrder } = req.body;

      if (typeof sortOrder !== 'number') {
        return res.status(400).json({ message: 'sortOrder must be a number' });
      }

      const category = await storage.updateCategorySortOrder(userId, id, sortOrder);
      res.json(category);
    } catch (error) {
      console.error('Error updating category sort order:', error);
      res.status(500).json({ message: 'Failed to update category sort order' });
    }
  });
}
