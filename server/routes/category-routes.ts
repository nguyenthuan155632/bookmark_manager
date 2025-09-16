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

  app.patch('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const data = insertCategorySchema.partial().parse(req.body);
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
}
