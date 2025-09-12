import { bookmarks, categories, users, userPreferences, type Bookmark, type InsertBookmark, type InsertBookmarkInternal, type Category, type InsertCategory, type User, type InsertUser, type UserPreferences, type InsertUserPreferences } from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or, desc, asc, and, isNull, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import ConnectPgSimple from "connect-pg-simple";
import session from "express-session";
import crypto from "crypto";

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
  
  // Bulk operations
  bulkDeleteBookmarks(userId: string, ids: number[], passcodes?: Record<string, string>): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  bulkMoveBookmarks(userId: string, ids: number[], categoryId: number | null, passcodes?: Record<string, string>): Promise<{
    movedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  
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
  
  // Bookmark sharing methods
  generateShareId(): string;
  setBookmarkSharing(userId: string, bookmarkId: number, isShared: boolean): Promise<Bookmark>;
  getSharedBookmark(shareId: string): Promise<{ 
    name: string; 
    description: string | null; 
    url: string; 
    tags: string[] | null; 
    createdAt: Date;
    category?: { name: string } | null;
  } | undefined>;
  
  // Auto-tagging methods
  updateBookmarkSuggestedTags(userId: string, bookmarkId: number, suggestedTags: string[]): Promise<Bookmark & { hasPasscode?: boolean }>;
  acceptSuggestedTags(userId: string, bookmarkId: number, tagsToAccept: string[]): Promise<Bookmark & { hasPasscode?: boolean }>;
  generateAutoTags(url: string, name?: string, description?: string): Promise<string[]>;
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
      suggestedTags: bookmarks.suggestedTags,
      isFavorite: bookmarks.isFavorite,
      categoryId: bookmarks.categoryId,
      userId: bookmarks.userId,
      passcodeHash: bookmarks.passcodeHash,
      isShared: bookmarks.isShared,
      shareId: bookmarks.shareId,
      screenshotUrl: bookmarks.screenshotUrl,
      screenshotStatus: bookmarks.screenshotStatus,
      screenshotUpdatedAt: bookmarks.screenshotUpdatedAt,
      linkStatus: bookmarks.linkStatus,
      httpStatus: bookmarks.httpStatus,
      lastLinkCheckAt: bookmarks.lastLinkCheckAt,
      linkFailCount: bookmarks.linkFailCount,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
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
      suggestedTags: bookmarks.suggestedTags,
      isFavorite: bookmarks.isFavorite,
      categoryId: bookmarks.categoryId,
      userId: bookmarks.userId,
      passcodeHash: bookmarks.passcodeHash,
      isShared: bookmarks.isShared,
      shareId: bookmarks.shareId,
      screenshotUrl: bookmarks.screenshotUrl,
      screenshotStatus: bookmarks.screenshotStatus,
      screenshotUpdatedAt: bookmarks.screenshotUpdatedAt,
      linkStatus: bookmarks.linkStatus,
      httpStatus: bookmarks.httpStatus,
      lastLinkCheckAt: bookmarks.lastLinkCheckAt,
      linkFailCount: bookmarks.linkFailCount,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
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

  // Bulk operations
  async bulkDeleteBookmarks(userId: string, ids: number[], passcodes?: Record<string, string>): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    const deletedIds: number[] = [];
    const failed: { id: number; reason: string }[] = [];

    if (ids.length === 0) {
      return { deletedIds, failed };
    }

    // Get all bookmarks that belong to this user
    const userBookmarks = await db.select({
      id: bookmarks.id,
      passcodeHash: bookmarks.passcodeHash,
    }).from(bookmarks).where(and(
      inArray(bookmarks.id, ids),
      eq(bookmarks.userId, userId)
    ));

    // Create a map for quick lookup
    const userBookmarkMap = new Map(userBookmarks.map(b => [b.id, b]));

    // Process each bookmark ID
    for (const id of ids) {
      const bookmark = userBookmarkMap.get(id);
      
      if (!bookmark) {
        failed.push({ id, reason: "Bookmark not found or access denied" });
        continue;
      }

      // Check if bookmark is protected and requires passcode
      if (bookmark.passcodeHash) {
        const providedPasscode = passcodes?.[id.toString()];
        
        if (!providedPasscode || typeof providedPasscode !== 'string') {
          failed.push({ id, reason: "Passcode required for protected bookmark" });
          continue;
        }

        const isValidPasscode = await bcrypt.compare(providedPasscode, bookmark.passcodeHash);
        if (!isValidPasscode) {
          failed.push({ id, reason: "Invalid passcode" });
          continue;
        }
      }

      // If we get here, bookmark can be deleted
      deletedIds.push(id);
    }

    // Perform bulk deletion for all successful IDs
    if (deletedIds.length > 0) {
      await db.delete(bookmarks).where(and(
        inArray(bookmarks.id, deletedIds),
        eq(bookmarks.userId, userId)
      ));
    }

    return { deletedIds, failed };
  }

  async bulkMoveBookmarks(userId: string, ids: number[], categoryId: number | null, passcodes?: Record<string, string>): Promise<{
    movedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    const movedIds: number[] = [];
    const failed: { id: number; reason: string }[] = [];

    if (ids.length === 0) {
      return { movedIds, failed };
    }

    // If categoryId is provided, verify it belongs to the user
    if (categoryId !== null) {
      const categoryExists = await this.getCategory(userId, categoryId);
      if (!categoryExists) {
        // All bookmarks fail with same reason
        return {
          movedIds: [],
          failed: ids.map(id => ({ id, reason: "Target category not found or access denied" }))
        };
      }
    }

    // Get all bookmarks that belong to this user
    const userBookmarks = await db.select({
      id: bookmarks.id,
      passcodeHash: bookmarks.passcodeHash,
    }).from(bookmarks).where(and(
      inArray(bookmarks.id, ids),
      eq(bookmarks.userId, userId)
    ));

    // Create a map for quick lookup
    const userBookmarkMap = new Map(userBookmarks.map(b => [b.id, b]));

    // Process each bookmark ID
    for (const id of ids) {
      const bookmark = userBookmarkMap.get(id);
      
      if (!bookmark) {
        failed.push({ id, reason: "Bookmark not found or access denied" });
        continue;
      }

      // Check if bookmark is protected and requires passcode
      if (bookmark.passcodeHash) {
        const providedPasscode = passcodes?.[id.toString()];
        
        if (!providedPasscode || typeof providedPasscode !== 'string') {
          failed.push({ id, reason: "Passcode required for protected bookmark" });
          continue;
        }

        const isValidPasscode = await bcrypt.compare(providedPasscode, bookmark.passcodeHash);
        if (!isValidPasscode) {
          failed.push({ id, reason: "Invalid passcode" });
          continue;
        }
      }

      // If we get here, bookmark can be moved
      movedIds.push(id);
    }

    // Perform bulk update for all successful IDs
    if (movedIds.length > 0) {
      await db.update(bookmarks)
        .set({
          categoryId,
          updatedAt: new Date(),
        })
        .where(and(
          inArray(bookmarks.id, movedIds),
          eq(bookmarks.userId, userId)
        ));
    }

    return { movedIds, failed };
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

  // Bookmark sharing methods
  generateShareId(): string {
    return crypto.randomUUID();
  }

  async setBookmarkSharing(userId: string, bookmarkId: number, isShared: boolean): Promise<Bookmark> {
    // If enabling sharing, generate a shareId; if disabling, set to null
    const shareId = isShared ? this.generateShareId() : null;
    
    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({
        isShared,
        shareId,
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();
    
    if (!updatedBookmark) {
      throw new Error('Bookmark not found');
    }
    
    // Remove passcodeHash from response
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return bookmarkResponse as Bookmark;
  }

  async getSharedBookmark(shareId: string): Promise<{ 
    name: string; 
    description: string | null; 
    url: string; 
    tags: string[] | null; 
    createdAt: Date;
    category?: { name: string } | null;
  } | undefined> {
    const [result] = await db.select({
      name: bookmarks.name,
      description: bookmarks.description,
      url: bookmarks.url,
      tags: bookmarks.tags,
      createdAt: bookmarks.createdAt,
      categoryName: categories.name,
    }).from(bookmarks)
    .leftJoin(categories, eq(bookmarks.categoryId, categories.id))
    .where(and(
      eq(bookmarks.shareId, shareId),
      eq(bookmarks.isShared, true)
    ));

    if (!result) return undefined;

    return {
      name: result.name,
      description: result.description,
      url: result.url,
      tags: result.tags,
      createdAt: result.createdAt,
      category: result.categoryName ? { name: result.categoryName } : undefined,
    };
  }

  // Auto-tagging methods
  async updateBookmarkSuggestedTags(userId: string, bookmarkId: number, suggestedTags: string[]): Promise<Bookmark & { hasPasscode?: boolean }> {
    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({ 
        suggestedTags: suggestedTags,
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();

    if (!updatedBookmark) {
      throw new Error('Bookmark not found or access denied');
    }

    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async acceptSuggestedTags(userId: string, bookmarkId: number, tagsToAccept: string[]): Promise<Bookmark & { hasPasscode?: boolean }> {
    // First get the current bookmark to merge tags
    const bookmark = await this.getBookmark(userId, bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    // Merge current tags with accepted suggested tags, removing duplicates
    const currentTags = bookmark.tags || [];
    const newTags = Array.from(new Set([...currentTags, ...tagsToAccept]));
    
    // Remove accepted tags from suggested tags
    const remainingSuggestedTags = (bookmark.suggestedTags || []).filter(tag => !tagsToAccept.includes(tag));

    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({ 
        tags: newTags,
        suggestedTags: remainingSuggestedTags,
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();

    if (!updatedBookmark) {
      throw new Error('Failed to update bookmark');
    }

    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async generateAutoTags(url: string, name?: string, description?: string): Promise<string[]> {
    const tags: Set<string> = new Set();

    try {
      // Parse URL for domain-based tags
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();

      // Domain-based tag mapping
      const domainTagMap: Record<string, string[]> = {
        'github.com': ['development', 'code', 'git', 'repository'],
        'stackoverflow.com': ['programming', 'help', 'q&a', 'development'],
        'youtube.com': ['video', 'entertainment', 'media'],
        'youtu.be': ['video', 'entertainment', 'media'],
        'medium.com': ['article', 'blog', 'writing'],
        'dev.to': ['development', 'blog', 'programming'],
        'reddit.com': ['social', 'community', 'discussion'],
        'twitter.com': ['social', 'microblog'],
        'x.com': ['social', 'microblog'],
        'linkedin.com': ['professional', 'networking', 'career'],
        'dribbble.com': ['design', 'ui', 'portfolio'],
        'behance.net': ['design', 'portfolio', 'creative'],
        'figma.com': ['design', 'ui', 'tool', 'collaboration'],
        'notion.so': ['productivity', 'notes', 'tool'],
        'google.com': ['search', 'tool'],
        'docs.google.com': ['document', 'collaboration', 'productivity'],
        'sheets.google.com': ['spreadsheet', 'data', 'productivity'],
        'slides.google.com': ['presentation', 'slides', 'productivity'],
        'wikipedia.org': ['reference', 'encyclopedia', 'knowledge'],
        'mdn.mozilla.org': ['documentation', 'web', 'development'],
        'w3schools.com': ['tutorial', 'web', 'development'],
        'codepen.io': ['development', 'demo', 'frontend'],
        'jsfiddle.net': ['development', 'demo', 'javascript'],
        'npmjs.com': ['javascript', 'package', 'development'],
        'pypi.org': ['python', 'package', 'development'],
        'aws.amazon.com': ['cloud', 'infrastructure', 'aws'],
        'azure.microsoft.com': ['cloud', 'infrastructure', 'azure'],
        'cloud.google.com': ['cloud', 'infrastructure', 'gcp'],
        'stripe.com': ['payment', 'api', 'fintech'],
        'twilio.com': ['communication', 'api', 'sms'],
        'shopify.com': ['ecommerce', 'store', 'business'],
        'wordpress.com': ['blog', 'cms', 'website'],
        'wix.com': ['website', 'builder', 'tool'],
        'squarespace.com': ['website', 'builder', 'design'],
        'canva.com': ['design', 'graphics', 'tool'],
        'unsplash.com': ['photos', 'stock', 'images'],
        'pexels.com': ['photos', 'stock', 'images'],
        'fonts.google.com': ['fonts', 'typography', 'design'],
        'hackernews.com': ['tech', 'news', 'startup'],
        'news.ycombinator.com': ['tech', 'news', 'startup'],
        'techcrunch.com': ['tech', 'news', 'startup'],
        'arstechnica.com': ['tech', 'news'],
        'theverge.com': ['tech', 'news', 'culture'],
        'wired.com': ['tech', 'news', 'culture'],
        'coursera.org': ['education', 'course', 'learning'],
        'udemy.com': ['education', 'course', 'learning'],
        'edx.org': ['education', 'course', 'learning'],
        'khanacademy.org': ['education', 'learning', 'free'],
        'freecodecamp.org': ['education', 'programming', 'free'],
        'codecademy.com': ['education', 'programming', 'interactive'],
      };

      // Add domain-specific tags
      for (const [domainPattern, domainTags] of Object.entries(domainTagMap)) {
        if (domain.includes(domainPattern.replace('www.', '')) || domain === domainPattern) {
          domainTags.forEach(tag => tags.add(tag));
          break; // Only match the first domain pattern
        }
      }

      // Path-based analysis for additional context
      if (path.includes('/docs') || path.includes('/documentation')) {
        tags.add('documentation');
      }
      if (path.includes('/api')) {
        tags.add('api');
      }
      if (path.includes('/tutorial') || path.includes('/guide')) {
        tags.add('tutorial');
      }
      if (path.includes('/blog')) {
        tags.add('blog');
      }
      if (path.includes('/news')) {
        tags.add('news');
      }

      // Technology-specific detection from URL and content
      const techKeywords = {
        'react': 'react',
        'vue': 'vue',
        'angular': 'angular',
        'javascript': 'javascript',
        'typescript': 'typescript',
        'python': 'python',
        'java': 'java',
        'php': 'php',
        'ruby': 'ruby',
        'go': 'golang',
        'rust': 'rust',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'docker': 'docker',
        'kubernetes': 'kubernetes',
        'aws': 'aws',
        'azure': 'azure',
        'gcp': 'gcp',
        'mongodb': 'database',
        'postgresql': 'database',
        'mysql': 'database',
        'redis': 'database',
        'graphql': 'graphql',
        'rest': 'api',
        'node': 'nodejs',
        'express': 'nodejs',
        'next': 'nextjs',
        'nuxt': 'nuxtjs',
        'svelte': 'svelte',
        'flutter': 'flutter',
        'laravel': 'laravel',
        'django': 'django',
        'rails': 'rails',
      };

      const contentToAnalyze = `${url} ${name || ''} ${description || ''}`.toLowerCase();
      for (const [keyword, tag] of Object.entries(techKeywords)) {
        if (contentToAnalyze.includes(keyword)) {
          tags.add(tag);
        }
      }

      // Try to fetch metadata for additional context (with timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0)',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          
          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const pageTitle = titleMatch?.[1]?.trim();

          // Extract meta description
          const descMatch = html.match(/<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i);
          const metaDescription = descMatch?.[1]?.trim();

          // Extract meta keywords
          const keywordsMatch = html.match(/<meta[^>]*name=['"]keywords['"][^>]*content=['"]([^'"]+)['"][^>]*>/i);
          const metaKeywords = keywordsMatch?.[1]?.trim();

          // Analyze extracted content for additional tags
          const metaContent = `${pageTitle || ''} ${metaDescription || ''} ${metaKeywords || ''}`.toLowerCase();
          
          // Content type detection
          if (metaContent.includes('tutorial') || metaContent.includes('how to') || metaContent.includes('guide')) {
            tags.add('tutorial');
          }
          if (metaContent.includes('video') || metaContent.includes('watch')) {
            tags.add('video');
          }
          if (metaContent.includes('article') || metaContent.includes('blog')) {
            tags.add('article');
          }
          if (metaContent.includes('tool') || metaContent.includes('app') || metaContent.includes('software')) {
            tags.add('tool');
          }
          if (metaContent.includes('news') || metaContent.includes('breaking')) {
            tags.add('news');
          }
          if (metaContent.includes('free') || metaContent.includes('open source')) {
            tags.add('free');
          }

          // Check for more tech keywords in metadata
          for (const [keyword, tag] of Object.entries(techKeywords)) {
            if (metaContent.includes(keyword)) {
              tags.add(tag);
            }
          }
        }
      } catch (fetchError) {
        // Silently fail metadata fetching - we'll use URL-based tags
        console.warn(`Failed to fetch metadata for ${url}:`, fetchError instanceof Error ? fetchError.message : 'Unknown error');
      }

      // Convert set to array and limit to reasonable number
      const tagArray = Array.from(tags);
      
      // Return up to 8 tags, prioritizing more specific ones
      return tagArray.slice(0, 8);

    } catch (error) {
      console.error('Error generating auto tags:', error);
      // Return empty array if URL parsing or other errors occur
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
