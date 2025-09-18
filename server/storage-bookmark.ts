import {
  bookmarks,
  categories,
  type Bookmark,
  type InsertBookmark,
  type InsertBookmarkInternal,
  type Category,
  bookmarkLanguageEnum,
  type BookmarkLanguage,
} from '@shared/schema';
import { customAlphabet } from 'nanoid';
import {
  db,
  eq,
  ilike,
  or,
  desc,
  asc,
  and,
  isNull,
  sql,
  inArray,
  bcrypt,
} from './storage-base';

const SHARE_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHARE_ID_RANDOM_LENGTH = 6;
const shareIdSegment = customAlphabet(SHARE_ID_ALPHABET, SHARE_ID_RANDOM_LENGTH);
const MAX_SHARE_ID_LENGTH = 160;

function slugifyForShare(input: string): string {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildShareSlug(name?: string, bookmarkId?: number): string {
  const fallback = bookmarkId ? `bookmark-${bookmarkId}` : 'bookmark';
  const source = name?.trim() ? name : fallback;
  const baseSlug = slugifyForShare(source);
  const randomSegment = shareIdSegment();
  const availableLength = Math.max(0, MAX_SHARE_ID_LENGTH - SHARE_ID_RANDOM_LENGTH - 1);
  const trimmedBase = baseSlug.slice(0, availableLength);
  return trimmedBase ? `${trimmedBase}-${randomSegment}` : randomSegment;
}

function normalizeBookmarkLanguage(input: unknown): BookmarkLanguage {
  if (typeof input !== 'string') return 'auto';
  const normalized = input.trim().toLowerCase();
  const parsed = bookmarkLanguageEnum.safeParse(normalized);
  if (parsed.success) {
    return parsed.data as BookmarkLanguage;
  }
  return 'auto';
}

export class BookmarkStorage {
  // Bookmark methods
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
  ): Promise<
    (Bookmark & { category?: Category; hasPasscode?: boolean; passcodeHash?: string | null })[]
  > {
    // Build conditions - always filter by userId first
    const conditions = [eq(bookmarks.userId, userId)];

    if (params?.search) {
      const searchQuery = params.search.trim();
      if (searchQuery) {
        // Use hybrid search: full-text search + ILIKE for partial matches
        // This handles both exact word matches and partial word matches

        // Full-text search condition
        const ftsCondition = sql`${bookmarks.searchVector} @@ plainto_tsquery('english', ${searchQuery})`;

        // ILIKE condition for partial matches (especially useful for hyphenated tags)
        const ilikeCondition = or(
          ilike(bookmarks.name, `%${searchQuery}%`),
          ilike(bookmarks.description, `%${searchQuery}%`),
          ilike(bookmarks.url, `%${searchQuery}%`),
          sql`array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${searchQuery}%`}`,
        );

        // Combine both conditions with OR
        const searchCondition = or(ftsCondition, ilikeCondition);
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
    }

    if (params && 'categoryId' in params) {
      const cid = params.categoryId as number | null | undefined;
      if (cid === null) {
        conditions.push(isNull(bookmarks.categoryId));
      } else if (typeof cid === 'number' && !Number.isNaN(cid)) {
        conditions.push(eq(bookmarks.categoryId, cid));
      }
    }

    if (params?.isFavorite !== undefined) {
      conditions.push(eq(bookmarks.isFavorite, params.isFavorite));
    }

    if (params?.tags && params.tags.length > 0) {
      // Use proper array search with array_to_string for tag filtering
      const tagCondition = or(
        ...params.tags.map(
          (tag) => sql`array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${tag}%`}`,
        ),
      );
      if (tagCondition) {
        conditions.push(tagCondition);
      }
    }

    if (params?.linkStatus && params.linkStatus !== 'all') {
      // Filter by link status (skip if 'all' is selected)
      if (params.linkStatus === 'unknown') {
        // For 'unknown' status, include both NULL values and 'unknown' values
        const unknownCondition = or(
          isNull(bookmarks.linkStatus),
          eq(bookmarks.linkStatus, 'unknown'),
        );
        if (unknownCondition) {
          conditions.push(unknownCondition);
        }
      } else if (params.linkStatus) {
        conditions.push(eq(bookmarks.linkStatus, params.linkStatus));
      }
    }

    // Build query with conditions
    let baseQuery = db
      .select({
        id: bookmarks.id,
        name: bookmarks.name,
        description: bookmarks.description,
        language: bookmarks.language,
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
        // Add search relevance score when searching (with robust fallback for missing ts_rank)
        ...(params?.search
          ? {
              searchRank: sql<number>`
            CASE 
              WHEN ${bookmarks.searchVector} IS NOT NULL AND ${bookmarks.searchVector} @@ plainto_tsquery('english', ${params.search}) 
              THEN COALESCE(
                custom_search_rank(${bookmarks.searchVector}, plainto_tsquery('english', ${params.search})),
                0.5
              )
              WHEN ${bookmarks.name} ILIKE ${`%${params.search}%`}
              THEN 0.8  -- High score for name matches
              WHEN ${bookmarks.description} ILIKE ${`%${params.search}%`}
              THEN 0.6  -- Medium score for description matches
              WHEN ${bookmarks.url} ILIKE ${`%${params.search}%`}
              THEN 0.4  -- Lower score for URL matches
              WHEN array_to_string(${bookmarks.tags}, ' ') ILIKE ${`%${params.search}%`}
              THEN 0.5  -- Medium score for tag matches
              ELSE 0.1  -- Low score for other matches
            END
          `.as('search_rank'),
            }
          : {}),
      })
      .from(bookmarks)
      .leftJoin(
        categories,
        and(eq(bookmarks.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Add sorting
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = params?.sortOrder || 'desc';

    let finalQuery;

    // When searching, prioritize by search relevance first
    if (params?.search) {
      finalQuery = baseQuery.orderBy(
        desc(sql`
          CASE 
            WHEN ${bookmarks.searchVector} @@ plainto_tsquery('english', ${params.search}) 
            THEN custom_search_rank(${bookmarks.searchVector}, plainto_tsquery('english', ${params.search}))
            ELSE 0.1  -- Lower score for ILIKE matches
          END
        `),
        // Then apply the requested sort
        sortBy === 'name'
          ? sortOrder === 'asc'
            ? asc(bookmarks.name)
            : desc(bookmarks.name)
          : sortBy === 'isFavorite'
            ? sortOrder === 'asc'
              ? asc(bookmarks.isFavorite)
              : desc(bookmarks.isFavorite)
            : sortOrder === 'asc'
              ? asc(bookmarks.createdAt)
              : desc(bookmarks.createdAt),
        // Tie-breaker for deterministic pagination
        desc(bookmarks.id),
      );
    } else if (sortBy === 'name') {
      finalQuery = baseQuery.orderBy(
        sortOrder === 'asc' ? asc(bookmarks.name) : desc(bookmarks.name),
        // Tie-breaker for deterministic pagination
        desc(bookmarks.id),
      );
    } else if (sortBy === 'isFavorite') {
      finalQuery = baseQuery.orderBy(
        sortOrder === 'asc' ? asc(bookmarks.isFavorite) : desc(bookmarks.isFavorite),
        desc(bookmarks.id),
      );
    } else {
      finalQuery = baseQuery.orderBy(
        sortOrder === 'asc' ? asc(bookmarks.createdAt) : desc(bookmarks.createdAt),
        // Tie-breaker
        desc(bookmarks.id),
      );
    }

    // Apply pagination if provided
    if (typeof params?.limit === 'number' && params.limit > 0) {
      finalQuery = finalQuery.limit(params.limit);
    }
    if (typeof params?.offset === 'number' && params.offset > 0) {
      finalQuery = finalQuery.offset(params.offset);
    }

    const results = await finalQuery;
    return results.map((row) => {
      const { passcodeHash, ...bookmarkData } = row;
      return {
        ...bookmarkData,
        category: row.category || undefined,
        hasPasscode: !!passcodeHash,
        passcodeHash: passcodeHash, // Include passcodeHash for export
      };
    });
  }

  async getBookmark(
    userId: string,
    id: number,
  ): Promise<(Bookmark & { category?: Category; hasPasscode?: boolean }) | undefined> {
    const [result] = await db
      .select({
        id: bookmarks.id,
        name: bookmarks.name,
        description: bookmarks.description,
        language: bookmarks.language,
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
      })
      .from(bookmarks)
      .leftJoin(
        categories,
        and(eq(bookmarks.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!result) return undefined;

    const { passcodeHash, ...bookmarkData } = result;
    return {
      ...bookmarkData,
      category: result.category || undefined,
      hasPasscode: !!passcodeHash,
    };
  }

  async createBookmark(
    userId: string,
    bookmark: InsertBookmark,
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    // Map client-facing 'passcode' to internal 'passcodeHash'
    const { passcode, ...bookmarkWithoutPasscode } = bookmark;
    const { language: incomingLanguage, ...restWithoutLanguage } = bookmarkWithoutPasscode as any;
    const normalizedLanguage = normalizeBookmarkLanguage(incomingLanguage);

    let bookmarkData: InsertBookmarkInternal = {
      ...restWithoutLanguage,
      language: normalizedLanguage,
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
      .values(bookmarkData as any)
      .returning();

    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = newBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async updateBookmark(
    userId: string,
    id: number,
    bookmark: Partial<InsertBookmark>,
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    // Map client-facing 'passcode' to internal 'passcodeHash'
    const { passcode, ...bookmarkWithoutPasscode } = bookmark;
    const { language: updateLanguage, ...restUpdate } = bookmarkWithoutPasscode as any;
    let updateData: Partial<InsertBookmarkInternal> = {
      ...restUpdate,
    };

    if (updateLanguage !== null && updateLanguage !== undefined) {
      updateData.language = normalizeBookmarkLanguage(updateLanguage);
    }

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

  async duplicateBookmark(
    userId: string,
    id: number,
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    const [orig] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!orig) {
      throw new Error('Bookmark not found');
    }

    // Determine next unique name within the same category using (n) suffix pattern
    const namesInCategory = await db
      .select({ name: bookmarks.name })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          orig.categoryId == null
            ? isNull(bookmarks.categoryId)
            : eq(bookmarks.categoryId, orig.categoryId!),
        ),
      );

    const stripSuffix = (name: string) => {
      const m = name.match(/^(.*)\s*\((\d+)\)\s*$/);
      return m ? m[1] : name;
    };
    const base = stripSuffix(orig.name).trim();
    let maxN = 1;
    for (const row of namesInCategory) {
      const n = (() => {
        const m =
          row.name.match(/^\s*"?\s*(.*)\s*\((\d+)\)\s*"?\s*$/) ||
          row.name.match(/^(.+?)\s*\((\d+)\)$/);
        if (m && stripSuffix(row.name).trim() === base) {
          return parseInt(m[2], 10) || 1;
        }
        if (row.name.trim() === base) return 1;
        return 0;
      })();
      if (n > maxN) maxN = n;
    }
    const nextName = `${base} (${Math.max(2, maxN + 1)})`;

    // Insert a new bookmark copying most attributes. Do not carry over shareId to avoid uniqueness issues.
    const [created] = await db
      .insert(bookmarks)
      .values({
        name: nextName,
        description: orig.description,
        url: orig.url,
        tags: orig.tags,
        suggestedTags: orig.suggestedTags,
        isFavorite: orig.isFavorite,
        categoryId: orig.categoryId,
        userId: orig.userId,
        passcodeHash: orig.passcodeHash,
        isShared: false,
        shareId: null,
        screenshotUrl: orig.screenshotUrl,
        screenshotStatus: orig.screenshotStatus,
        screenshotUpdatedAt: orig.screenshotUpdatedAt,
        language: orig.language,
        linkStatus: orig.linkStatus,
        httpStatus: orig.httpStatus,
        lastLinkCheckAt: orig.lastLinkCheckAt,
        linkFailCount: orig.linkFailCount,
      })
      .returning();

    const { passcodeHash, ...rest } = created;
    return { ...rest, hasPasscode: !!passcodeHash } as Bookmark & { hasPasscode?: boolean };
  }

  async verifyBookmarkPasscode(userId: string, id: number, passcode: string): Promise<boolean> {
    const [bookmark] = await db
      .select({
        passcodeHash: bookmarks.passcodeHash,
      })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!bookmark || !bookmark.passcodeHash) {
      return false; // No bookmark found or no passcode set
    }

    return await bcrypt.compare(passcode, bookmark.passcodeHash);
  }

  // Bulk operations
  async bulkDeleteBookmarks(
    userId: string,
    ids: number[],
    passcodes?: Record<string, string>,
  ): Promise<{
    deletedIds: number[];
    failed: { id: number; reason: string }[];
  }> {
    const deletedIds: number[] = [];
    const failed: { id: number; reason: string }[] = [];

    if (ids.length === 0) {
      return { deletedIds, failed };
    }

    // Get all bookmarks that belong to this user
    const userBookmarks = await db
      .select({
        id: bookmarks.id,
        passcodeHash: bookmarks.passcodeHash,
      })
      .from(bookmarks)
      .where(and(inArray(bookmarks.id, ids), eq(bookmarks.userId, userId)));

    // Create a map for quick lookup
    const userBookmarkMap = new Map(userBookmarks.map((b) => [b.id, b]));

    // Process each bookmark ID
    for (const id of ids) {
      const bookmark = userBookmarkMap.get(id);

      if (!bookmark) {
        failed.push({ id, reason: 'Bookmark not found or access denied' });
        continue;
      }

      // Check if bookmark is protected and requires passcode
      if (bookmark.passcodeHash) {
        const providedPasscode = passcodes?.[id.toString()];

        if (!providedPasscode || typeof providedPasscode !== 'string') {
          failed.push({ id, reason: 'Passcode required for protected bookmark' });
          continue;
        }

        const isValidPasscode = await bcrypt.compare(providedPasscode, bookmark.passcodeHash);
        if (!isValidPasscode) {
          failed.push({ id, reason: 'Invalid passcode' });
          continue;
        }
      }

      // If we get here, bookmark can be deleted
      deletedIds.push(id);
    }

    // Perform bulk deletion for all successful IDs
    if (deletedIds.length > 0) {
      await db
        .delete(bookmarks)
        .where(and(inArray(bookmarks.id, deletedIds), eq(bookmarks.userId, userId)));
    }

    return { deletedIds, failed };
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
    const movedIds: number[] = [];
    const failed: { id: number; reason: string }[] = [];

    if (ids.length === 0) {
      return { movedIds, failed };
    }

    // If categoryId is provided, verify it belongs to the user
    if (categoryId !== null) {
      // This would need to be injected or accessed differently in a real implementation
      // For now, we'll assume the category validation is done elsewhere
    }

    // Get all bookmarks that belong to this user
    const userBookmarks = await db
      .select({
        id: bookmarks.id,
        passcodeHash: bookmarks.passcodeHash,
      })
      .from(bookmarks)
      .where(and(inArray(bookmarks.id, ids), eq(bookmarks.userId, userId)));

    // Create a map for quick lookup
    const userBookmarkMap = new Map(userBookmarks.map((b) => [b.id, b]));

    // Process each bookmark ID
    for (const id of ids) {
      const bookmark = userBookmarkMap.get(id);

      if (!bookmark) {
        failed.push({ id, reason: 'Bookmark not found or access denied' });
        continue;
      }

      // Check if bookmark is protected and requires passcode
      if (bookmark.passcodeHash) {
        const providedPasscode = passcodes?.[id.toString()];

        if (!providedPasscode || typeof providedPasscode !== 'string') {
          failed.push({ id, reason: 'Passcode required for protected bookmark' });
          continue;
        }

        const isValidPasscode = await bcrypt.compare(providedPasscode, bookmark.passcodeHash);
        if (!isValidPasscode) {
          failed.push({ id, reason: 'Invalid passcode' });
          continue;
        }
      }

      // If we get here, bookmark can be moved
      movedIds.push(id);
    }

    // Perform bulk update for all successful IDs
    if (movedIds.length > 0) {
      await db
        .update(bookmarks)
        .set({
          categoryId,
          updatedAt: new Date(),
        })
        .where(and(inArray(bookmarks.id, movedIds), eq(bookmarks.userId, userId)));
    }

    return { movedIds, failed };
  }

  // Bookmark sharing methods
  generateShareId(name?: string, bookmarkId?: number): string {
    return buildShareSlug(name, bookmarkId);
  }

  async setBookmarkSharing(
    userId: string,
    bookmarkId: number,
    isShared: boolean,
  ): Promise<Bookmark> {
    const [targetBookmark] = await db
      .select({ id: bookmarks.id, name: bookmarks.name })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .limit(1);

    if (!targetBookmark) {
      throw new Error('Bookmark not found');
    }

    let shareId: string | null = null;

    if (isShared) {
      let attempt = 0;
      const maxAttempts = 5;

      while (attempt < maxAttempts) {
        const candidate = this.generateShareId(targetBookmark.name, targetBookmark.id);
        const [existing] = await db
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(eq(bookmarks.shareId, candidate))
          .limit(1);

        if (!existing) {
          shareId = candidate;
          break;
        }

        attempt += 1;
      }

      if (!shareId) {
        throw new Error('Could not generate unique share URL');
      }
    }

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
    const { passcodeHash: _passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return bookmarkResponse as Bookmark;
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
    const [result] = await db
      .select({
        name: bookmarks.name,
        description: bookmarks.description,
        url: bookmarks.url,
        tags: bookmarks.tags,
        screenshotUrl: bookmarks.screenshotUrl,
        createdAt: bookmarks.createdAt,
        categoryName: categories.name,
        passcodeHash: bookmarks.passcodeHash,
      })
      .from(bookmarks)
      .leftJoin(categories, eq(bookmarks.categoryId, categories.id))
      .where(and(eq(bookmarks.shareId, shareId), eq(bookmarks.isShared, true)));

    if (!result) return undefined;

    const hasPass = !!result.passcodeHash;
    const full = options?.full === true;

    if (hasPass && !full) {
      // Censor content until passcode verified
      return {
        name: '',
        description: null,
        url: '',
        tags: [],
        screenshotUrl: null,
        createdAt: result.createdAt,
        category: result.categoryName ? { name: result.categoryName } : undefined,
        hasPasscode: true,
      };
    }

    return {
      name: result.name,
      description: result.description,
      url: result.url,
      tags: result.tags,
      screenshotUrl: result.screenshotUrl,
      createdAt: result.createdAt,
      category: result.categoryName ? { name: result.categoryName } : undefined,
      hasPasscode: hasPass,
    };
  }

  async verifySharedPasscode(shareId: string, passcode: string): Promise<boolean> {
    const [row] = await db
      .select({ passcodeHash: bookmarks.passcodeHash })
      .from(bookmarks)
      .where(and(eq(bookmarks.shareId, shareId), eq(bookmarks.isShared, true)));
    if (!row?.passcodeHash) return false;
    return await bcrypt.compare(passcode, row.passcodeHash);
  }
}
