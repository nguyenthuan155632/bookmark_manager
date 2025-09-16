import type { Express } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { eq, desc, asc, and, or, ilike, sql } from '../storage-base';
import { requireAuth, requireAdmin } from '../auth';

// Validation schemas
const insertDomainTagSchema = z.object({
  domain: z.string().min(1).max(255),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateDomainTagSchema = insertDomainTagSchema.partial().omit({ domain: true });

const searchDomainTagsSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['domain', 'category', 'createdAt', 'updatedAt']).default('domain'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export function registerDomainTagsRoutes(app: Express) {
  // Get all domain tags with optional filtering and search
  app.get('/api/domain-tags', requireAuth, async (req, res) => {
    try {
      const query = searchDomainTagsSchema.parse({
        search: req.query.search,
        category: req.query.category,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      });

      // Build conditions
      const conditions = [];

      if (query.search) {
        conditions.push(
          or(
            ilike(domainTags.domain, `%${query.search}%`),
            ilike(domainTags.description, `%${query.search}%`),
            sql`${domainTags.tags}::text ILIKE ${`%${query.search}%`}`,
          ),
        );
      }

      if (query.category) {
        conditions.push(eq(domainTags.category, query.category));
      }

      if (query.isActive !== undefined) {
        conditions.push(eq(domainTags.isActive, query.isActive));
      }

      // Build query with sorting and pagination
      const sortColumn = domainTags[query.sortBy];
      const sortOrder = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      const results = await db
        .select()
        .from(domainTags)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sortOrder, desc(domainTags.id))
        .limit(query.limit)
        .offset(query.offset);

      // Get total count for pagination
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(domainTags)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const [{ count }] = await countQuery;

      res.json({
        data: results,
        pagination: {
          total: count,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < count,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid query parameters', errors: error.errors });
      }
      console.error('Error fetching domain tags:', error);
      res.status(500).json({ message: 'Failed to fetch domain tags' });
    }
  });

  // Get domain tags by category
  app.get('/api/domain-tags/categories', requireAuth, async (req, res) => {
    try {
      const categories = await db
        .select({
          category: domainTags.category,
          count: sql<number>`count(*)`,
        })
        .from(domainTags)
        .where(
          and(
            eq(domainTags.isActive, true),
            sql`${domainTags.category} IS NOT NULL AND ${domainTags.category} != ''`,
          ),
        )
        .groupBy(domainTags.category)
        .orderBy(asc(domainTags.category));

      res.json(categories);
    } catch (error) {
      console.error('Error fetching domain tag categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Get domain suggestions for a URL (must be before /:id route)
  app.get('/api/domain-tags/suggest', requireAuth, async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'URL parameter is required' });
      }

      let domain: string;
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.toLowerCase();
      } catch {
        return res.status(400).json({ message: 'Invalid URL format' });
      }

      // Find exact domain match
      const [exactMatch] = await db
        .select()
        .from(domainTags)
        .where(and(eq(domainTags.domain, domain), eq(domainTags.isActive, true)));

      if (exactMatch) {
        return res.json({
          domain: exactMatch.domain,
          tags: exactMatch.tags,
          category: exactMatch.category,
          description: exactMatch.description,
          matchType: 'exact',
        });
      }

      // Find partial domain matches
      const partialMatches = await db
        .select()
        .from(domainTags)
        .where(and(sql`${domainTags.domain} LIKE ${`%${domain}%`}`, eq(domainTags.isActive, true)))
        .limit(5);

      res.json({
        domain,
        suggestions: partialMatches.map((match) => ({
          domain: match.domain,
          tags: match.tags,
          category: match.category,
          description: match.description,
          matchType: 'partial',
        })),
      });
    } catch (error) {
      console.error('Error getting domain suggestions:', error);
      res.status(500).json({ message: 'Failed to get domain suggestions' });
    }
  });

  // Get a specific domain tag
  app.get('/api/domain-tags/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid domain tag ID' });
      }

      const [domainTag] = await db.select().from(domainTags).where(eq(domainTags.id, id));

      if (!domainTag) {
        return res.status(404).json({ message: 'Domain tag not found' });
      }

      res.json(domainTag);
    } catch (error) {
      console.error('Error fetching domain tag:', error);
      res.status(500).json({ message: 'Failed to fetch domain tag' });
    }
  });

  // Create a new domain tag
  app.post('/api/domain-tags', requireAuth, async (req, res) => {
    try {
      const data = insertDomainTagSchema.parse(req.body);

      // Check if domain already exists
      const [existing] = await db
        .select()
        .from(domainTags)
        .where(eq(domainTags.domain, data.domain));

      if (existing) {
        return res.status(409).json({ message: 'Domain tag already exists' });
      }

      const [newDomainTag] = await db
        .insert(domainTags)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(newDomainTag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid domain tag data', errors: error.errors });
      }
      console.error('Error creating domain tag:', error);
      res.status(500).json({ message: 'Failed to create domain tag' });
    }
  });

  // Update a domain tag (Admin only)
  app.patch('/api/domain-tags/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid domain tag ID' });
      }

      const data = updateDomainTagSchema.parse(req.body);

      const [updatedDomainTag] = await db
        .update(domainTags)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(domainTags.id, id))
        .returning();

      if (!updatedDomainTag) {
        return res.status(404).json({ message: 'Domain tag not found' });
      }

      res.json(updatedDomainTag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid domain tag data', errors: error.errors });
      }
      console.error('Error updating domain tag:', error);
      res.status(500).json({ message: 'Failed to update domain tag' });
    }
  });

  // Delete a domain tag (Admin only)
  app.delete('/api/domain-tags/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid domain tag ID' });
      }

      const [deletedDomainTag] = await db
        .delete(domainTags)
        .where(eq(domainTags.id, id))
        .returning();

      if (!deletedDomainTag) {
        return res.status(404).json({ message: 'Domain tag not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting domain tag:', error);
      res.status(500).json({ message: 'Failed to delete domain tag' });
    }
  });

  // Bulk operations (Admin only)
  app.post('/api/domain-tags/bulk', requireAdmin, async (req, res) => {
    try {
      const { action, ids, data } = req.body;

      if (!action || !ids || !Array.isArray(ids)) {
        return res.status(400).json({ message: 'Invalid bulk operation data' });
      }

      let result;
      switch (action) {
        case 'activate':
          result = await db
            .update(domainTags)
            .set({ isActive: true, updatedAt: new Date() })
            .where(sql`${domainTags.id} = ANY(${ids})`)
            .returning();
          break;

        case 'deactivate':
          result = await db
            .update(domainTags)
            .set({ isActive: false, updatedAt: new Date() })
            .where(sql`${domainTags.id} = ANY(${ids})`)
            .returning();
          break;

        case 'update': {
          if (!data) {
            return res.status(400).json({ message: 'Update data required' });
          }
          const updateData = updateDomainTagSchema.parse(data);
          result = await db
            .update(domainTags)
            .set({ ...updateData, updatedAt: new Date() })
            .where(sql`${domainTags.id} = ANY(${ids})`)
            .returning();
          break;
        }

        case 'delete':
          result = await db
            .delete(domainTags)
            .where(sql`${domainTags.id} = ANY(${ids})`)
            .returning();
          break;

        default:
          return res.status(400).json({ message: 'Invalid action' });
      }

      res.json({
        message: `Bulk ${action} completed`,
        affected: result.length,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid bulk operation data', errors: error.errors });
      }
      console.error('Error in bulk operation:', error);
      res.status(500).json({ message: 'Failed to perform bulk operation' });
    }
  });
}
