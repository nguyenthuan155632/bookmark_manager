import { categories, bookmarks, type Category, type InsertCategory } from '@shared/schema';
import { db, eq, asc, and, sql } from './storage-base';

export class CategoryStorage {
  // Category methods
  async getCategories(userId: string): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.name));
  }

  async getCategoriesWithCounts(userId: string): Promise<(Category & { bookmarkCount: number })[]> {
    const results = await db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        userId: categories.userId,
        createdAt: categories.createdAt,
        bookmarkCount: sql<number>`count(${bookmarks.id})::int`,
      })
      .from(categories)
      .leftJoin(
        bookmarks,
        and(eq(categories.id, bookmarks.categoryId), eq(bookmarks.userId, userId)),
      )
      .where(eq(categories.userId, userId))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));

    return results;
  }

  async getCategory(userId: string, id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return category || undefined;
  }

  async createCategory(userId: string, category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values({
        ...category,
        userId, // Add userId from authenticated user
      })
      .returning();
    return newCategory;
  }

  async updateCategory(
    userId: string,
    id: number,
    category: Partial<InsertCategory>,
  ): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return updatedCategory;
  }

  async unlinkCategoryBookmarks(userId: string, categoryId: number): Promise<void> {
    await db
      .update(bookmarks)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.categoryId, categoryId)));
  }

  async deleteBookmarksByCategory(userId: string, categoryId: number): Promise<number> {
    const deleted = await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.categoryId, categoryId)))
      .returning({ id: bookmarks.id });
    return deleted.length;
  }

  async deleteCategory(userId: string, id: number): Promise<void> {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }
}
