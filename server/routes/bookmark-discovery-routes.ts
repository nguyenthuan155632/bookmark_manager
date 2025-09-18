import { Router, type Express } from 'express';
import { db } from '../db';
import { bookmarks, categories } from '@shared/schema';
import { sql, eq, and, desc, isNull, isNotNull, or } from 'drizzle-orm';

// Generate bookmarks schema for SEO
const generateBookmarksSchema = (bookmarks: any[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Shared Bookmarks Collection',
  description: 'A curated collection of publicly shared bookmarks from Memorize Vault',
  numberOfItems: bookmarks.length,
  itemListElement: bookmarks.map((bookmark, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Bookmark',
      name: bookmark.name,
      description: bookmark.description || '',
      url: bookmark.url,
      dateCreated: bookmark.createdAt,
      dateModified: bookmark.updatedAt,
      ...(bookmark.category && {
        about: {
          '@type': 'Thing',
          name: bookmark.category.name,
        },
      }),
      ...(bookmark.screenshotUrl && {
        image: bookmark.screenshotUrl,
      }),
      ...(bookmark.tags && bookmark.tags.length > 0 && {
        keywords: bookmark.tags,
      }),
    },
  })),
});

const router = Router();



// Get public bookmark index (non-authenticated, for SEO)
router.get('/discovery', async (req, res) => {
  try {
    // Get public bookmark data for SEO (limit to avoid excessive data exposure)
    const publicBookmarks = await db
      .select({
        id: bookmarks.id,
        name: bookmarks.name,
        description: bookmarks.description,
        url: bookmarks.url,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        screenshotUrl: bookmarks.screenshotUrl,
        isFavorite: bookmarks.isFavorite,
        tags: bookmarks.tags,
        category: {
          name: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
        }
      })
      .from(bookmarks)
      .leftJoin(categories, eq(bookmarks.categoryId, categories.id))
      .where(
        and(
          eq(bookmarks.isShared, true), // Only shared bookmarks
          isNull(bookmarks.passcodeHash) // No passcode protection
        )
      )
      .limit(50) // Limit for performance and privacy
      .orderBy(desc(bookmarks.createdAt));

    // Get categories with shared bookmarks
    const publicCategories = await db
      .select({
        name: categories.name,
        bookmarkCount: sql<number>`count(${bookmarks.id})`
      })
      .from(categories)
      .leftJoin(bookmarks, eq(categories.id, bookmarks.categoryId))
      .where(
        or(
          and(
            eq(bookmarks.isShared, true),
            isNull(bookmarks.passcodeHash)
          ),
          isNull(bookmarks.id) // Include categories with no matching bookmarks
        )
      )
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`count(${bookmarks.id})`));

    
    // Generate SEO-friendly response
    const seoData = {
      title: 'Discover Bookmarks - Memorize Vault',
      description: 'Explore a curated collection of shared bookmarks from the Memorize Vault community. Discover valuable resources, tools, and knowledge.',
      bookmarks: publicBookmarks,
      categories: publicCategories,
      totalBookmarks: publicBookmarks.length,
      totalCategories: publicCategories.length,
      structuredData: generateBookmarksSchema(publicBookmarks)
    };

    res.json(seoData);
  } catch (error) {
    console.error('Error fetching public bookmark discovery data:', error);
    res.status(500).json({
      error: 'Failed to fetch discovery data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get public bookmarks by category
router.get('/discovery/category/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Find category by slug
    const category = await db
      .select()
      .from(categories)
      .where(eq(sql`LOWER(REPLACE(${categories.name}, ' ', '-'))`, slug.toLowerCase()))
      .limit(1);

    if (!category.length) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryBookmarks = await db
      .select({
        id: bookmarks.id,
        name: bookmarks.name,
        description: bookmarks.description,
        url: bookmarks.url,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        screenshotUrl: bookmarks.screenshotUrl,
        isFavorite: bookmarks.isFavorite,
        tags: bookmarks.tags,
        category: {
          name: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
        }
      })
      .from(bookmarks)
      .leftJoin(categories, eq(bookmarks.categoryId, categories.id))
      .where(
        and(
          eq(bookmarks.isShared, true),
          isNull(bookmarks.passcodeHash),
          eq(bookmarks.categoryId, category[0].id)
        )
      )
      .limit(30)
      .orderBy(desc(bookmarks.createdAt));

    const seoData = {
      title: `${category[0].name} Bookmarks - Memorize Vault`,
      description: `Explore ${categoryBookmarks.length} shared bookmarks in ${category[0].name} category. Discover curated resources and tools.`,
      category: category[0],
      bookmarks: categoryBookmarks,
      totalBookmarks: categoryBookmarks.length,
      structuredData: generateBookmarksSchema(categoryBookmarks)
    };

    res.json(seoData);
  } catch (error) {
    console.error('Error fetching category discovery data:', error);
    res.status(500).json({ error: 'Failed to fetch category data' });
  }
});

export function registerBookmarkDiscoveryRoutes(app: Express) {
  app.use('/api/bookmarks', router);
}