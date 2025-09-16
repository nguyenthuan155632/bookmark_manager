import {
  bookmarks,
  categories,
} from '@shared/schema';
import { db, eq, and, sql } from './storage-base';

export class StatsStorage {
  // Stats methods
  async getBookmarkStats(userId: string): Promise<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
    linkStats?: {
      total: number;
      working: number;
      broken: number;
      timeout: number;
      unknown: number;
    };
  }> {
    const [totalResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId));

    const [favoritesResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(bookmarks)
      .where(and(eq(bookmarks.isFavorite, true), eq(bookmarks.userId, userId)));

    const [categoriesResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(categories)
      .where(eq(categories.userId, userId));

    // Get all unique tags for this user
    const tagResults = await db
      .select({
        tags: bookmarks.tags,
      })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          sql`${bookmarks.tags} IS NOT NULL AND array_length(${bookmarks.tags}, 1) > 0`,
        ),
      );

    const allTags = new Set<string>();
    tagResults.forEach((result) => {
      if (result.tags) {
        result.tags.forEach((tag) => allTags.add(tag));
      }
    });

    // Get link status counts
    const linkStatusResults = await db
      .select({
        status: sql<string>`COALESCE(${bookmarks.linkStatus}, 'unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .groupBy(sql`COALESCE(${bookmarks.linkStatus}, 'unknown')`);

    const linkStats = {
      total: totalResult.count,
      working: 0,
      broken: 0,
      timeout: 0,
      unknown: 0,
    };

    linkStatusResults.forEach((result) => {
      switch (result.status) {
        case 'ok':
          linkStats.working = result.count;
          break;
        case 'broken':
          linkStats.broken = result.count;
          break;
        case 'timeout':
          linkStats.timeout = result.count;
          break;
        case 'unknown':
        default:
          linkStats.unknown = result.count;
          break;
      }
    });

    return {
      total: totalResult.count,
      favorites: favoritesResult.count,
      categories: categoriesResult.count,
      tags: Array.from(allTags),
      linkStats,
    };
  }
}
