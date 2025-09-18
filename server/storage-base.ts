import {
  type Bookmark,
  type InsertBookmark,
  type InsertBookmarkInternal,
  type Category,
  type InsertCategory,
  type User,
  type InsertUser,
  type UserPreferences,
  type InsertUserPreferences,
} from '@shared/schema';
import { db, pool } from './db';
import { eq, ilike, or, desc, asc, and, isNull, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import ConnectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import crypto from 'crypto';
import OpenAI from 'openai';

const DEBUG_AI = process.env.DEBUG_AI;
export const logAI = (...args: any[]) => {
  if (!DEBUG_AI) return;
  try {
    console.log('[AI]', ...args);
  } catch {
    // ignore logging errors
  }
};

const PgSession = ConnectPgSimple(session);

// Removed global cooldown; rely on per-call retry/backoff only

export interface IStorage {
  // Session store for authentication
  sessionStore: any;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserUsername(userId: string, username: string): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User>;

  // API token methods (for extensions)
  createApiToken(userId: string): Promise<{ token: string; id: number }>; // returns raw token
  getUserByApiToken(token: string): Promise<User | undefined>;
  touchApiToken(token: string): Promise<void>;

  // Bookmark methods
  getBookmarks(
    userId: string,
    params?: {
      search?: string;
      categoryId?: number | null;
      isFavorite?: boolean;
      tags?: string[];
      linkStatus?: string;
      sortBy?: 'name' | 'createdAt' | 'isFavorite';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ): Promise<
    (Bookmark & { category?: Category; hasPasscode?: boolean; passcodeHash?: string | null })[]
  >;
  getBookmark(
    userId: string,
    id: number,
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined>;
  createBookmark(userId: string, bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(userId: string, id: number, bookmark: Partial<InsertBookmark>): Promise<Bookmark>;
  deleteBookmark(userId: string, id: number): Promise<void>;
  verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean>;

  // Bulk operations
  bulkDeleteBookmarks(
    userId: string,
    ids: number[],
    passcodes?: Record<string, string>,
  ): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  bulkMoveBookmarks(
    userId: string,
    ids: number[],
    categoryId: number | null,
    passcodes?: Record<string, string>,
  ): Promise<{
    movedIds: number[];
    failed: { id: number; reason: string }[];
  }>;

  // Category methods
  getCategories(userId: string): Promise<Category[]>;
  getCategoriesWithCounts(userId: string): Promise<(Category & { bookmarkCount: number })[]>;
  getCategory(userId: string, id: number): Promise<Category | undefined>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  updateCategory(userId: string, id: number, category: Partial<InsertCategory>): Promise<Category>;
  updateCategorySortOrder(userId: string, categoryId: number, sortOrder: number): Promise<Category>;
  updateCategoriesSortOrder(
    userId: string,
    sortOrders: { id: number; sortOrder: number }[],
  ): Promise<Category[]>;
  unlinkCategoryBookmarks(userId: string, categoryId: number): Promise<void>;
  deleteBookmarksByCategory(userId: string, categoryId: number): Promise<number>;
  deleteCategory(userId: string, id: number): Promise<void>;

  // Stats methods
  getBookmarkStats(userId: string): Promise<{
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
  }>;

  // User Preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(
    userId: string,
    preferences: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences>;

  // Bookmark sharing methods
  generateShareId(name?: string, bookmarkId?: number): string;
  setBookmarkSharing(userId: string, bookmarkId: number, isShared: boolean): Promise<Bookmark>;
  getSharedBookmark(
    shareId: string,
    options?: { full?: boolean },
  ): Promise<
    | {
        name: string;
        description: string | null;
        url: string | null;
        tags: string[] | null;
        screenshotUrl?: string | null;
        createdAt: Date;
        category?: { name: string } | null;
        hasPasscode?: boolean;
      }
    | undefined
  >;

  // Auto-tagging methods
  updateBookmarkSuggestedTags(
    userId: string,
    bookmarkId: number,
    suggestedTags: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }>;
  acceptSuggestedTags(
    userId: string,
    bookmarkId: number,
    tagsToAccept: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }>;
  generateAutoTags(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string[]>;
  generateAutoDescription(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string; language?: string },
  ): Promise<string | undefined>;

  // Screenshot methods
  triggerScreenshot(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; message: string }>;
  updateScreenshotStatus(bookmarkId: number, status: string, url?: string): Promise<void>;
  getScreenshotStatus(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; screenshotUrl?: string; updatedAt?: Date } | undefined>;

  // Link checking methods
  checkBookmarkLink(
    userId: string,
    bookmarkId: number,
  ): Promise<{ linkStatus: string; httpStatus?: number; lastLinkCheckAt: Date }>;
  bulkCheckBookmarkLinks(
    userId: string,
    bookmarkIds?: number[],
  ): Promise<{
    checkedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  updateLinkStatus(
    bookmarkId: number,
    linkStatus: string,
    httpStatus?: number,
    linkFailCount?: number,
  ): Promise<void>;
  getBookmarksForLinkCheck(
    limit: number,
    userId?: string,
  ): Promise<{ id: number; url: string; lastLinkCheckAt: Date | null }[]>;
}

export abstract class BaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    // Initialize PostgreSQL session store with connect-pg-simple
    this.sessionStore = new PgSession({
      pool: pool,
      tableName: 'session',
      schemaName: process.env.DB_SCHEMA || 'public',
      createTableIfMissing: true,
    });
  }

  // Abstract methods to be implemented by concrete classes
  abstract getUser(id: string): Promise<User | undefined>;
  abstract getUserByUsername(username: string): Promise<User | undefined>;
  abstract createUser(user: InsertUser): Promise<User>;
  abstract updateUserUsername(userId: string, username: string): Promise<User>;
  abstract updateUserPassword(userId: string, hashedPassword: string): Promise<User>;
  abstract createApiToken(userId: string): Promise<{ token: string; id: number }>;
  abstract getUserByApiToken(token: string): Promise<User | undefined>;
  abstract touchApiToken(token: string): Promise<void>;
  abstract getBookmarks(
    userId: string,
    params?: {
      search?: string;
      categoryId?: number | null;
      isFavorite?: boolean;
      tags?: string[];
      linkStatus?: string;
      sortBy?: 'name' | 'createdAt' | 'isFavorite';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]>;
  abstract getBookmark(
    userId: string,
    id: number,
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined>;
  abstract createBookmark(userId: string, bookmark: InsertBookmark): Promise<Bookmark>;
  abstract updateBookmark(
    userId: string,
    id: number,
    bookmark: Partial<InsertBookmark>,
  ): Promise<Bookmark>;
  abstract deleteBookmark(userId: string, id: number): Promise<void>;
  abstract verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean>;
  abstract bulkDeleteBookmarks(
    userId: string,
    ids: number[],
    passcodes?: Record<string, string>,
  ): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  abstract bulkMoveBookmarks(
    userId: string,
    ids: number[],
    categoryId: number | null,
    passcodes?: Record<string, string>,
  ): Promise<{
    movedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  abstract getCategories(userId: string): Promise<Category[]>;
  abstract getCategoriesWithCounts(
    userId: string,
  ): Promise<(Category & { bookmarkCount: number })[]>;
  abstract getCategory(userId: string, id: number): Promise<Category | undefined>;
  abstract createCategory(userId: string, category: InsertCategory): Promise<Category>;
  abstract updateCategory(
    userId: string,
    id: number,
    category: Partial<InsertCategory>,
  ): Promise<Category>;
  abstract updateCategorySortOrder(
    userId: string,
    categoryId: number,
    sortOrder: number,
  ): Promise<Category>;
  abstract updateCategoriesSortOrder(
    userId: string,
    sortOrders: { id: number; sortOrder: number }[],
  ): Promise<Category[]>;
  abstract unlinkCategoryBookmarks(userId: string, categoryId: number): Promise<void>;
  abstract deleteBookmarksByCategory(userId: string, categoryId: number): Promise<number>;
  abstract deleteCategory(userId: string, id: number): Promise<void>;
  abstract getBookmarkStats(userId: string): Promise<{
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
  }>;
  abstract getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  abstract updateUserPreferences(
    userId: string,
    preferences: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences>;
  abstract generateShareId(name?: string, bookmarkId?: number): string;
  abstract setBookmarkSharing(
    userId: string,
    bookmarkId: number,
    isShared: boolean,
  ): Promise<Bookmark>;
  abstract getSharedBookmark(
    shareId: string,
    options?: { full?: boolean },
  ): Promise<
    | {
        name: string;
        description: string | null;
        url: string | null;
        tags: string[] | null;
        screenshotUrl?: string | null;
        createdAt: Date;
        category?: { name: string } | null;
        hasPasscode?: boolean;
      }
    | undefined
  >;
  abstract updateBookmarkSuggestedTags(
    userId: string,
    bookmarkId: number,
    suggestedTags: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }>;
  abstract acceptSuggestedTags(
    userId: string,
    bookmarkId: number,
    tagsToAccept: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }>;
  abstract generateAutoTags(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string[]>;
  abstract generateAutoDescription(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string | undefined>;
  abstract triggerScreenshot(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; message: string }>;
  abstract updateScreenshotStatus(bookmarkId: number, status: string, url?: string): Promise<void>;
  abstract getScreenshotStatus(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; screenshotUrl?: string; updatedAt?: Date } | undefined>;
  abstract checkBookmarkLink(
    userId: string,
    bookmarkId: number,
  ): Promise<{ linkStatus: string; httpStatus?: number; lastLinkCheckAt: Date }>;
  abstract bulkCheckBookmarkLinks(
    userId: string,
    bookmarkIds?: number[],
  ): Promise<{
    checkedIds: number[];
    failed: { id: number; reason: string }[];
  }>;
  abstract updateLinkStatus(
    bookmarkId: number,
    linkStatus: string,
    httpStatus?: number,
    linkFailCount?: number,
  ): Promise<void>;
  abstract getBookmarksForLinkCheck(
    limit: number,
    userId?: string,
  ): Promise<{ id: number; url: string; lastLinkCheckAt: Date | null }[]>;
}

// Export common utilities and types
export { db, pool, eq, ilike, or, desc, asc, and, isNull, sql, inArray, bcrypt, crypto, OpenAI };
export type {
  Bookmark,
  InsertBookmark,
  InsertBookmarkInternal,
  Category,
  InsertCategory,
  User,
  InsertUser,
  UserPreferences,
  InsertUserPreferences,
};
