import { bookmarks, categories, users, userPreferences, type Bookmark, type InsertBookmark, type InsertBookmarkInternal, type Category, type InsertCategory, type User, type InsertUser, type UserPreferences, type InsertUserPreferences } from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or, desc, asc, and, isNull, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import ConnectPgSimple from "connect-pg-simple";
import session from "express-session";

const PgSession = ConnectPgSimple(session);

export interface IStorage {
  // Session store for authentication
  sessionStore: any;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bookmark methods
  getBookmarks(userId: string, params?: {
    search?: string;
    categoryId?: number;
    isFavorite?: boolean;
    tags?: string[];
    sortBy?: 'name' | 'createdAt' | 'isFavorite';
    sortOrder?: 'asc' | 'desc';
  }): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]>;
  getBookmark(userId: string, id: number): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined>;
  createBookmark(userId: string, bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(userId: string, id: number, bookmark: Partial<InsertBookmark>): Promise<Bookmark>;
  deleteBookmark(userId: string, id: number): Promise<void>;
  verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean>;
  
  // Category methods
  getCategories(userId: string): Promise<Category[]>;
  getCategoriesWithCounts(userId: string): Promise<(Category & { bookmarkCount: number })[]>;
  getCategory(userId: string, id: number): Promise<Category | undefined>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  updateCategory(userId: string, id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(userId: string, id: number): Promise<void>;
  
  // Stats methods
  getBookmarkStats(userId: string): Promise<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  }>;
  
  // User Preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    // Initialize PostgreSQL session store with connect-pg-simple
    this.sessionStore = new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }
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
  async getBookmarks(userId: string, params?: {
    search?: string;
    categoryId?: number;
    isFavorite?: boolean;
    tags?: string[];
    sortBy?: 'name' | 'createdAt' | 'isFavorite';
    sortOrder?: 'asc' | 'desc';
  }): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]> {
    // Build conditions - always filter by userId first
    const conditions = [eq(bookmarks.userId, userId)];

    if (params?.search) {
      const searchCondition = or(
        ilike(bookmarks.name, `%${params.search}%`),
        ilike(bookmarks.description, `%${params.search}%`),
        ilike(bookmarks.url, `%${params.search}%`),
        // Search within tags array - convert array to string and search
        sql`array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${params.search}%`}`,
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (params?.categoryId !== undefined) {
      conditions.push(eq(bookmarks.categoryId, params.categoryId));
    }

    if (params?.isFavorite !== undefined) {
      conditions.push(eq(bookmarks.isFavorite, params.isFavorite));
    }

    if (params?.tags && params.tags.length > 0) {
      // Use proper array search with array_to_string for tag filtering
      const tagCondition = or(...params.tags.map(tag => 
        sql`array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${tag}%`}`
      ));
      if (tagCondition) {
        conditions.push(tagCondition);
      }
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
      userId: bookmarks.userId,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      passcodeHash: bookmarks.passcodeHash,
      category: categories,
    }).from(bookmarks)
    .leftJoin(categories, and(eq(bookmarks.categoryId, categories.id), eq(categories.userId, userId)))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Add sorting
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = params?.sortOrder || 'desc';
    
    let finalQuery;
    if (sortBy === 'name') {
      finalQuery = baseQuery.orderBy(sortOrder === 'asc' ? asc(bookmarks.name) : desc(bookmarks.name));
    } else if (sortBy === 'isFavorite') {
      finalQuery = baseQuery.orderBy(sortOrder === 'asc' ? asc(bookmarks.isFavorite) : desc(bookmarks.isFavorite));
    } else {
      finalQuery = baseQuery.orderBy(sortOrder === 'asc' ? asc(bookmarks.createdAt) : desc(bookmarks.createdAt));
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

  async getBookmark(userId: string, id: number): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined> {
    const [result] = await db.select({
      id: bookmarks.id,
      name: bookmarks.name,
      description: bookmarks.description,
      url: bookmarks.url,
      tags: bookmarks.tags,
      isFavorite: bookmarks.isFavorite,
      categoryId: bookmarks.categoryId,
      userId: bookmarks.userId,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      passcodeHash: bookmarks.passcodeHash,
      category: categories,
    }).from(bookmarks)
    .leftJoin(categories, and(eq(bookmarks.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!result) return undefined;

    const { passcodeHash, ...bookmarkData } = result;
    return {
      ...bookmarkData,
      category: result.category || undefined,
      hasPasscode: !!passcodeHash,
    };
  }

  async createBookmark(userId: string, bookmark: InsertBookmark): Promise<Bookmark & { hasPasscode?: boolean }> {
    // Map client-facing 'passcode' to internal 'passcodeHash'
    const { passcode, ...bookmarkWithoutPasscode } = bookmark;
    let bookmarkData: InsertBookmarkInternal = {
      ...bookmarkWithoutPasscode,
      userId, // Add userId from authenticated user
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

  async updateBookmark(userId: string, id: number, bookmark: Partial<InsertBookmark>): Promise<Bookmark & { hasPasscode?: boolean }> {
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
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .returning();
    
    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async deleteBookmark(userId: string, id: number): Promise<void> {
    await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  }

  async verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean> {
    const [bookmark] = await db.select({
      passcodeHash: bookmarks.passcodeHash,
    }).from(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
    
    if (!bookmark || !bookmark.passcodeHash) {
      return false; // No bookmark found or no passcode set
    }
    
    return await bcrypt.compare(passcode, bookmark.passcodeHash);
  }

  // Category methods
  async getCategories(userId: string): Promise<Category[]> {
    return await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name));
  }

  async getCategoriesWithCounts(userId: string): Promise<(Category & { bookmarkCount: number })[]> {
    const results = await db.select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      userId: categories.userId,
      createdAt: categories.createdAt,
      bookmarkCount: sql<number>`count(${bookmarks.id})::int`,
    }).from(categories)
    .leftJoin(bookmarks, and(eq(categories.id, bookmarks.categoryId), eq(bookmarks.userId, userId)))
    .where(eq(categories.userId, userId))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));

    return results;
  }

  async getCategory(userId: string, id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
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

  async updateCategory(userId: string, id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(userId: string, id: number): Promise<void> {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  // Stats methods
  async getBookmarkStats(userId: string): Promise<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  }> {
    const [totalResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(bookmarks).where(eq(bookmarks.userId, userId));

    const [favoritesResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(bookmarks).where(and(eq(bookmarks.isFavorite, true), eq(bookmarks.userId, userId)));

    const [categoriesResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(categories).where(eq(categories.userId, userId));

    // Get all unique tags for this user
    const tagResults = await db.select({
      tags: bookmarks.tags,
    }).from(bookmarks).where(and(
      eq(bookmarks.userId, userId),
      sql`${bookmarks.tags} IS NOT NULL AND array_length(${bookmarks.tags}, 1) > 0`
    ));

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
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return preferences || undefined;
  }

  async updateUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    // Check if preferences record exists for this user
    const existingPreferences = await this.getUserPreferences(userId);
    
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
          userId,
          theme: preferences.theme || "light",
          viewMode: preferences.viewMode || "grid",
        })
        .returning();
      return newPreferences;
    }
  }
}

export const storage = new DatabaseStorage();
