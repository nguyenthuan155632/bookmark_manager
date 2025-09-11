import { bookmarks, categories, users, userPreferences, type Bookmark, type InsertBookmark, type InsertBookmarkInternal, type Category, type InsertCategory, type User, type InsertUser, type UserPreferences, type InsertUserPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, asc, and, isNull, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bookmark methods
  getBookmarks(params?: {
    search?: string;
    categoryId?: number;
    isFavorite?: boolean;
    tags?: string[];
    sortBy?: 'name' | 'createdAt' | 'isFavorite';
    sortOrder?: 'asc' | 'desc';
  }): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]>;
  getBookmark(id: number): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(id: number, bookmark: Partial<InsertBookmark>): Promise<Bookmark>;
  deleteBookmark(id: number): Promise<void>;
  verifyBookmarkPasscode(id: number, passcode: string): Promise<boolean>;
  
  // Category methods
  getCategories(): Promise<Category[]>;
  getCategoriesWithCounts(): Promise<(Category & { bookmarkCount: number })[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Stats methods
  getBookmarkStats(): Promise<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  }>;
  
  // User Preferences methods
  getUserPreferences(): Promise<UserPreferences | undefined>;
  updateUserPreferences(preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Bookmark methods
  async getBookmarks(params?: {
    search?: string;
    categoryId?: number;
    isFavorite?: boolean;
    tags?: string[];
    sortBy?: 'name' | 'createdAt' | 'isFavorite';
    sortOrder?: 'asc' | 'desc';
  }): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]> {
    // Build conditions
    const conditions = [];

    if (params?.search) {
      conditions.push(
        or(
          ilike(bookmarks.name, `%${params.search}%`),
          ilike(bookmarks.description, `%${params.search}%`),
          ilike(bookmarks.url, `%${params.search}%`),
          // Search within tags array - convert array to string and search
          sql`array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${params.search}%`}`,
        )
      );
    }

    if (params?.categoryId !== undefined) {
      conditions.push(eq(bookmarks.categoryId, params.categoryId));
    }

    if (params?.isFavorite !== undefined) {
      conditions.push(eq(bookmarks.isFavorite, params.isFavorite));
    }

    if (params?.tags && params.tags.length > 0) {
      // For now, we'll do a simple text search in tags array
      // In a production app, you might want a separate tags table
      conditions.push(
        or(...params.tags.map(tag => 
          ilike(bookmarks.tags, `%${tag}%`)
        ))
      );
    }

    // Build query with conditions
    let baseQuery = db.select({
      id: bookmarks.id,
      name: bookmarks.name,
      description: bookmarks.description,
      url: bookmarks.url,
      tags: bookmarks.tags,
      isFavorite: bookmarks.isFavorite,
      categoryId: bookmarks.categoryId,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      passcodeHash: bookmarks.passcodeHash,
      category: categories,
    }).from(bookmarks)
    .leftJoin(categories, eq(bookmarks.categoryId, categories.id));

    // Add where clause if conditions exist
    const queryWithConditions = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // Add sorting
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = params?.sortOrder || 'desc';
    
    let finalQuery;
    if (sortBy === 'name') {
      finalQuery = queryWithConditions.orderBy(sortOrder === 'asc' ? asc(bookmarks.name) : desc(bookmarks.name));
    } else if (sortBy === 'isFavorite') {
      finalQuery = queryWithConditions.orderBy(sortOrder === 'asc' ? asc(bookmarks.isFavorite) : desc(bookmarks.isFavorite));
    } else {
      finalQuery = queryWithConditions.orderBy(sortOrder === 'asc' ? asc(bookmarks.createdAt) : desc(bookmarks.createdAt));
    }

    const results = await finalQuery;
    return results.map(row => {
      const { passcodeHash, ...bookmarkData } = row;
      return {
        ...bookmarkData,
        category: row.category || undefined,
        hasPasscode: !!passcodeHash,
      };
    });
  }

  async getBookmark(id: number): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined> {
    const [result] = await db.select({
      id: bookmarks.id,
      name: bookmarks.name,
      description: bookmarks.description,
      url: bookmarks.url,
      tags: bookmarks.tags,
      isFavorite: bookmarks.isFavorite,
      categoryId: bookmarks.categoryId,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      passcodeHash: bookmarks.passcodeHash,
      category: categories,
    }).from(bookmarks)
    .leftJoin(categories, eq(bookmarks.categoryId, categories.id))
    .where(eq(bookmarks.id, id));

    if (!result) return undefined;

    const { passcodeHash, ...bookmarkData } = result;
    return {
      ...bookmarkData,
      category: result.category || undefined,
      hasPasscode: !!passcodeHash,
    };
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark & { hasPasscode?: boolean }> {
    // Map client-facing 'passcode' to internal 'passcodeHash'
    const { passcode, ...bookmarkWithoutPasscode } = bookmark;
    let bookmarkData: InsertBookmarkInternal = {
      ...bookmarkWithoutPasscode,
    };
    
    // Hash passcode if provided and not null/undefined
    if (passcode && typeof passcode === 'string') {
      bookmarkData.passcodeHash = await bcrypt.hash(passcode, 12);
    } else if (passcode === null) {
      // Explicitly set to null if passcode was null (remove passcode)
      bookmarkData.passcodeHash = null;
    }
    
    const [newBookmark] = await db
      .insert(bookmarks)
      .values(bookmarkData)
      .returning();
    
    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = newBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async updateBookmark(id: number, bookmark: Partial<InsertBookmark>): Promise<Bookmark & { hasPasscode?: boolean }> {
    // Map client-facing 'passcode' to internal 'passcodeHash'
    const { passcode, ...bookmarkWithoutPasscode } = bookmark;
    let updateData: Partial<InsertBookmarkInternal> = {
      ...bookmarkWithoutPasscode,
    };
    
    // Hash passcode if provided and not null/undefined
    if (passcode !== undefined) {
      if (passcode && typeof passcode === 'string') {
        updateData.passcodeHash = await bcrypt.hash(passcode, 12);
      } else if (passcode === null) {
        // Explicitly set to null if passcode was null (remove passcode)
        updateData.passcodeHash = null;
      }
    }
    
    const [updatedBookmark] = await db
      .update(bookmarks)
      .set(updateData)
      .where(eq(bookmarks.id, id))
      .returning();
    
    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async deleteBookmark(id: number): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
  }

  async verifyBookmarkPasscode(id: number, passcode: string): Promise<boolean> {
    const [bookmark] = await db.select({
      passcodeHash: bookmarks.passcodeHash,
    }).from(bookmarks).where(eq(bookmarks.id, id));
    
    if (!bookmark || !bookmark.passcodeHash) {
      return false; // No bookmark found or no passcode set
    }
    
    return await bcrypt.compare(passcode, bookmark.passcodeHash);
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async getCategoriesWithCounts(): Promise<(Category & { bookmarkCount: number })[]> {
    const results = await db.select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      createdAt: categories.createdAt,
      bookmarkCount: sql<number>`count(${bookmarks.id})::int`,
    }).from(categories)
    .leftJoin(bookmarks, eq(categories.id, bookmarks.categoryId))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));

    return results;
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Stats methods
  async getBookmarkStats(): Promise<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  }> {
    const [totalResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(bookmarks);

    const [favoritesResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(bookmarks).where(eq(bookmarks.isFavorite, true));

    const [categoriesResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(categories);

    // Get all unique tags
    const tagResults = await db.select({
      tags: bookmarks.tags,
    }).from(bookmarks).where(sql`${bookmarks.tags} IS NOT NULL AND array_length(${bookmarks.tags}, 1) > 0`);

    const allTags = new Set<string>();
    tagResults.forEach(result => {
      if (result.tags) {
        result.tags.forEach(tag => allTags.add(tag));
      }
    });

    return {
      total: totalResult.count,
      favorites: favoritesResult.count,
      categories: categoriesResult.count,
      tags: Array.from(allTags),
    };
  }

  // User Preferences methods
  async getUserPreferences(): Promise<UserPreferences | undefined> {
    const [preferences] = await db.select().from(userPreferences).limit(1);
    return preferences || undefined;
  }

  async updateUserPreferences(preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    // Check if preferences record exists
    const existingPreferences = await this.getUserPreferences();
    
    if (existingPreferences) {
      // Update existing record
      const [updatedPreferences] = await db
        .update(userPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.id, existingPreferences.id))
        .returning();
      return updatedPreferences;
    } else {
      // Create new record with defaults
      const [newPreferences] = await db
        .insert(userPreferences)
        .values({
          theme: preferences.theme || "light",
          viewMode: preferences.viewMode || "grid",
        })
        .returning();
      return newPreferences;
    }
  }
}

export const storage = new DatabaseStorage();
