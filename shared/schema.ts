import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, boolean, timestamp, integer, json, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// User schema (moved up to be defined before it's referenced)
export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

// User Preferences schema (moved up to be defined before it's referenced)
export const userPreferences = pgTable('user_preferences', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar('user_id').notNull(),
  theme: varchar('theme', { length: 10 }).notNull().default('light'),
  viewMode: varchar('view_mode', { length: 10 }).notNull().default('grid'),
  defaultCategoryId: integer('default_category_id'),
  sessionTimeoutMinutes: integer('session_timeout_minutes').default(30),
  linkCheckEnabled: boolean('link_check_enabled').default(false),
  linkCheckIntervalMinutes: integer('link_check_interval_minutes').default(30),
  linkCheckBatchSize: integer('link_check_batch_size').default(25),
  autoTagSuggestionsEnabled: boolean('auto_tag_suggestions_enabled').default(true),
  aiTaggingEnabled: boolean('ai_tagging_enabled').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Session table for express-session with connect-pg-simple
// Including this in the schema prevents it from being dropped by migrations
export const sessionTable = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (t) => ({
    expireIdx: index('IDX_session_expire').on(t.expire),
  }),
);

export const categories = pgTable('categories', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: integer('parent_id'),
  userId: varchar('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookmarks = pgTable('bookmarks', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  url: text('url').notNull(),
  tags: text('tags').array().default([]),
  suggestedTags: text('suggested_tags').array().default([]),
  isFavorite: boolean('is_favorite').default(false),
  categoryId: integer('category_id'),
  userId: varchar('user_id').notNull(),
  passcodeHash: text('passcode_hash'),
  isShared: boolean('is_shared').default(false),
  shareId: varchar('share_id', { length: 36 }).unique(),
  screenshotUrl: text('screenshot_url'),
  screenshotStatus: varchar('screenshot_status', { length: 16 }).default('idle'),
  screenshotUpdatedAt: timestamp('screenshot_updated_at'),
  linkStatus: varchar('link_status', { length: 16 }).default('unknown'),
  httpStatus: integer('http_status'),
  lastLinkCheckAt: timestamp('last_link_check_at'),
  linkFailCount: integer('link_fail_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [bookmarks.categoryId],
    references: [categories.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  bookmarks: many(bookmarks),
  categories: many(categories),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  userId: true, // userId will be added server-side from authenticated user
});

// Client-facing bookmark schemas (using 'passcode' instead of 'passcodeHash')
export const insertBookmarkSchema = createInsertSchema(bookmarks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    userId: true, // userId will be added server-side from authenticated user
    passcodeHash: true, // Exclude internal hash field from client API
    suggestedTags: true, // Server-managed auto-tagging
    screenshotUrl: true, // Server-managed screenshot functionality
    screenshotStatus: true, // Server-managed screenshot status
    screenshotUpdatedAt: true, // Server-managed timestamp
    linkStatus: true, // Server-managed link checking
    httpStatus: true, // Server-managed HTTP status
    lastLinkCheckAt: true, // Server-managed timestamp
    linkFailCount: true, // Server-managed failure counter
  })
  .extend({
    // Add client-facing passcode field with validation
    passcode: z
      .string()
      .min(4, 'Passcode must be at least 4 characters long')
      .max(64, 'Passcode must be no more than 64 characters long')
      .transform((val) => (val === '' ? null : val)) // Transform empty string to null
      .nullable()
      .optional(),
  });

// Internal server-side schema that includes the passcodeHash field
export const insertBookmarkInternalSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type InsertBookmarkInternal = z.infer<typeof insertBookmarkInternalSchema>;
export type Bookmark = Omit<typeof bookmarks.$inferSelect, 'passcodeHash'>; // Remove passcodeHash from public type

// User and preferences types/schemas (tables already defined above)
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true, // userId will be added server-side from authenticated user
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
