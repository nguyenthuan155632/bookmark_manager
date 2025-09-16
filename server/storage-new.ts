import { BaseStorage, IStorage } from './storage-base';
import { UserStorage } from './storage-user';
import { BookmarkStorage } from './storage-bookmark';
import { CategoryStorage } from './storage-category';
import { StatsStorage } from './storage-stats';
import { AIStorage } from './storage-ai';
import { ScreenshotStorage } from './storage-screenshot';
import { LinkCheckerStorage } from './storage-link-checker';
import {
  type Bookmark,
  type InsertBookmark,
  type Category,
  type InsertCategory,
  type User,
  type InsertUser,
  type UserPreferences,
  type InsertUserPreferences,
} from '@shared/schema';

export class DatabaseStorage extends BaseStorage implements IStorage {
  private userStorage: UserStorage;
  private bookmarkStorage: BookmarkStorage;
  private categoryStorage: CategoryStorage;
  private statsStorage: StatsStorage;
  private aiStorage: AIStorage;
  private screenshotStorage: ScreenshotStorage;
  private linkCheckerStorage: LinkCheckerStorage;

  constructor() {
    super();

    // Initialize all storage modules
    this.userStorage = new UserStorage();
    this.bookmarkStorage = new BookmarkStorage();
    this.categoryStorage = new CategoryStorage();
    this.statsStorage = new StatsStorage();
    this.aiStorage = new AIStorage(this.userStorage.getUserPreferences.bind(this.userStorage));
    this.screenshotStorage = new ScreenshotStorage(
      this.bookmarkStorage.getBookmark.bind(this.bookmarkStorage),
    );
    this.linkCheckerStorage = new LinkCheckerStorage(
      this.bookmarkStorage.getBookmark.bind(this.bookmarkStorage),
    );
  }

  // User methods - delegate to UserStorage
  async getUser(id: string): Promise<User | undefined> {
    return this.userStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.userStorage.getUserByUsername(username);
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.userStorage.createUser(user);
  }

  async updateUserUsername(userId: string, username: string): Promise<User> {
    return this.userStorage.updateUserUsername(userId, username);
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
    return this.userStorage.updateUserPassword(userId, hashedPassword);
  }

  // API token methods - delegate to UserStorage
  async createApiToken(userId: string): Promise<{ token: string; id: number }> {
    return this.userStorage.createApiToken(userId);
  }

  async getUserByApiToken(token: string): Promise<User | undefined> {
    return this.userStorage.getUserByApiToken(token);
  }

  async touchApiToken(token: string): Promise<void> {
    return this.userStorage.touchApiToken(token);
  }

  // Bookmark methods - delegate to BookmarkStorage
  async getBookmarks(
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
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean })[]> {
    return this.bookmarkStorage.getBookmarks(userId, params);
  }

  async getBookmark(
    userId: string,
    id: number,
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined> {
    return this.bookmarkStorage.getBookmark(userId, id);
  }

  async createBookmark(userId: string, bookmark: InsertBookmark): Promise<Bookmark> {
    return this.bookmarkStorage.createBookmark(userId, bookmark);
  }

  async updateBookmark(
    userId: string,
    id: number,
    bookmark: Partial<InsertBookmark>,
  ): Promise<Bookmark> {
    return this.bookmarkStorage.updateBookmark(userId, id, bookmark);
  }

  async deleteBookmark(userId: string, id: number): Promise<void> {
    return this.bookmarkStorage.deleteBookmark(userId, id);
  }

  async verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean> {
    return this.bookmarkStorage.verifyBookmarkPasscode(userId, id, passcode);
  }

  // Bulk operations - delegate to BookmarkStorage
  async bulkDeleteBookmarks(
    userId: string,
    ids: number[],
    passcodes?: Record<string, string>,
  ): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    return this.bookmarkStorage.bulkDeleteBookmarks(userId, ids, passcodes);
  }

  async bulkMoveBookmarks(
    userId: string,
    ids: number[],
    categoryId: number | null,
    passcodes?: Record<string, string>,
  ): Promise<{
    movedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    return this.bookmarkStorage.bulkMoveBookmarks(userId, ids, categoryId, passcodes);
  }

  // Category methods - delegate to CategoryStorage
  async getCategories(userId: string): Promise<Category[]> {
    return this.categoryStorage.getCategories(userId);
  }

  async getCategoriesWithCounts(userId: string): Promise<(Category & { bookmarkCount: number })[]> {
    return this.categoryStorage.getCategoriesWithCounts(userId);
  }

  async getCategory(userId: string, id: number): Promise<Category | undefined> {
    return this.categoryStorage.getCategory(userId, id);
  }

  async createCategory(userId: string, category: InsertCategory): Promise<Category> {
    return this.categoryStorage.createCategory(userId, category);
  }

  async updateCategory(
    userId: string,
    id: number,
    category: Partial<InsertCategory>,
  ): Promise<Category> {
    return this.categoryStorage.updateCategory(userId, id, category);
  }

  async unlinkCategoryBookmarks(userId: string, categoryId: number): Promise<void> {
    return this.categoryStorage.unlinkCategoryBookmarks(userId, categoryId);
  }

  async deleteBookmarksByCategory(userId: string, categoryId: number): Promise<number> {
    return this.categoryStorage.deleteBookmarksByCategory(userId, categoryId);
  }

  async deleteCategory(userId: string, id: number): Promise<void> {
    return this.categoryStorage.deleteCategory(userId, id);
  }

  // Stats methods - delegate to StatsStorage
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
    return this.statsStorage.getBookmarkStats(userId);
  }

  // User Preferences methods - delegate to UserStorage
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return this.userStorage.getUserPreferences(userId);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences> {
    return this.userStorage.updateUserPreferences(userId, preferences);
  }

  // Bookmark sharing methods - delegate to BookmarkStorage
  generateShareId(): string {
    return this.bookmarkStorage.generateShareId();
  }

  async setBookmarkSharing(
    userId: string,
    bookmarkId: number,
    isShared: boolean,
  ): Promise<Bookmark> {
    return this.bookmarkStorage.setBookmarkSharing(userId, bookmarkId, isShared);
  }

  async getSharedBookmark(
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
  > {
    return this.bookmarkStorage.getSharedBookmark(shareId, options);
  }

  // Auto-tagging methods - delegate to AIStorage
  async updateBookmarkSuggestedTags(
    userId: string,
    bookmarkId: number,
    suggestedTags: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    return this.aiStorage.updateBookmarkSuggestedTags(userId, bookmarkId, suggestedTags);
  }

  async acceptSuggestedTags(
    userId: string,
    bookmarkId: number,
    tagsToAccept: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    return this.aiStorage.acceptSuggestedTags(userId, bookmarkId, tagsToAccept);
  }

  async generateAutoTags(url: string, name?: string, description?: string): Promise<string[]> {
    return this.aiStorage.generateAutoTags(url, name, description);
  }

  async generateAutoDescription(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string | undefined> {
    return this.aiStorage.generateAutoDescription(url, name, description, opts);
  }

  // Screenshot methods - delegate to ScreenshotStorage
  async triggerScreenshot(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; message: string }> {
    return this.screenshotStorage.triggerScreenshot(userId, bookmarkId);
  }

  async updateScreenshotStatus(bookmarkId: number, status: string, url?: string): Promise<void> {
    return this.screenshotStorage.updateScreenshotStatus(bookmarkId, status, url);
  }

  async getScreenshotStatus(
    userId: string,
    bookmarkId: number,
  ): Promise<{ status: string; screenshotUrl?: string; updatedAt?: Date } | undefined> {
    return this.screenshotStorage.getScreenshotStatus(userId, bookmarkId);
  }

  // Link checking methods - delegate to LinkCheckerStorage
  async checkBookmarkLink(
    userId: string,
    bookmarkId: number,
  ): Promise<{ linkStatus: string; httpStatus?: number; lastLinkCheckAt: Date }> {
    return this.linkCheckerStorage.checkBookmarkLink(userId, bookmarkId);
  }

  async bulkCheckBookmarkLinks(
    userId: string,
    bookmarkIds?: number[],
  ): Promise<{
    checkedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    return this.linkCheckerStorage.bulkCheckBookmarkLinks(userId, bookmarkIds);
  }

  async updateLinkStatus(
    bookmarkId: number,
    linkStatus: string,
    httpStatus?: number,
    linkFailCount?: number,
  ): Promise<void> {
    return this.linkCheckerStorage.updateLinkStatus(
      bookmarkId,
      linkStatus,
      httpStatus,
      linkFailCount,
    );
  }

  async getBookmarksForLinkCheck(
    limit: number,
    userId?: string,
  ): Promise<{ id: number; url: string; lastLinkCheckAt: Date | null }[]> {
    return this.linkCheckerStorage.getBookmarksForLinkCheck(limit, userId);
  }
}

export const storage = new DatabaseStorage();
