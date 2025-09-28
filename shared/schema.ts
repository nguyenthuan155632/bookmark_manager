import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const BASE_BOOKMARK_LANGUAGES = [
  'en',
  'vi',
  'es',
  'fr',
  'de',
  'ja',
  'ko',
  'zh',
  'pt',
  'hi',
  'it',
  'ru',
  'nl',
  'sv',
  'pl',
  'tr',
  'ar',
  'id',
  'th',
  'uk',
  'he',
] as const;
export const BOOKMARK_LANGUAGES = ['auto', ...BASE_BOOKMARK_LANGUAGES] as const;
export const bookmarkLanguageEnum = z.enum(BOOKMARK_LANGUAGES);
export type BookmarkLanguage = (typeof BOOKMARK_LANGUAGES)[number];
export const BOOKMARK_LANGUAGE_LABELS: Record<BookmarkLanguage, string> = {
  auto: 'Auto Detect',
  en: 'English',
  vi: 'Vietnamese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  pt: 'Portuguese',
  hi: 'Hindi',
  it: 'Italian',
  ru: 'Russian',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
  id: 'Indonesian',
  th: 'Thai',
  uk: 'Ukrainian',
  he: 'Hebrew',
};

export const PREFERENCE_AI_LANGUAGES = BOOKMARK_LANGUAGES;
export const preferenceAiLanguageEnum = z.enum(PREFERENCE_AI_LANGUAGES);
export type PreferenceAiLanguage = (typeof PREFERENCE_AI_LANGUAGES)[number];
export const PREFERENCE_AI_LANGUAGE_LABELS: Record<PreferenceAiLanguage, string> = {
  ...BOOKMARK_LANGUAGE_LABELS,
};

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
  autoDescriptionEnabled: boolean('auto_description_enabled').default(true),
  aiDescriptionEnabled: boolean('ai_description_enabled').default(false),
  aiUsageLimit: integer('ai_usage_limit').default(50),
  defaultAiLanguage: varchar('default_ai_language', { length: 16 }).notNull().default('auto'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// API tokens for non-cookie auth (e.g., browser extensions)
export const apiTokens = pgTable('api_tokens', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar('user_id').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
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
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const domainTags = pgTable(
  'domain_tags',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    tags: jsonb('tags').notNull().default([]),
    category: varchar('category', { length: 100 }), // e.g., 'development', 'design', 'education'
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    domainIdx: index('domain_tags_domain_idx').on(table.domain),
    categoryIdx: index('domain_tags_category_idx').on(table.category),
    activeIdx: index('domain_tags_active_idx').on(table.isActive),
  }),
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    language: varchar('language', { length: 16 }).notNull().default('auto'),
    url: text('url').notNull(),
    tags: text('tags').array().default([]),
    suggestedTags: text('suggested_tags').array().default([]),
    isFavorite: boolean('is_favorite').default(false),
    categoryId: integer('category_id'),
    userId: varchar('user_id').notNull(),
    passcodeHash: text('passcode_hash'),
    isShared: boolean('is_shared').default(false),
    shareId: varchar('share_id', { length: 160 }).unique(),
    screenshotUrl: text('screenshot_url'),
    screenshotStatus: varchar('screenshot_status', { length: 16 }).default('idle'),
    screenshotUpdatedAt: timestamp('screenshot_updated_at'),
    linkStatus: varchar('link_status', { length: 16 }).default('unknown'),
    httpStatus: integer('http_status'),
    lastLinkCheckAt: timestamp('last_link_check_at'),
    linkFailCount: integer('link_fail_count').default(0),
    // Full-text search columns
    searchVector: text('search_vector'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Full-text search index
    searchIdx: index('bookmarks_search_idx').on(table.searchVector),
    // User index for efficient filtering
    userIdIdx: index('bookmarks_user_id_idx').on(table.userId),
  }),
);

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
  // tokens: many(apiTokens) // optional relation not used directly
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const domainTagsRelations = relations(domainTags, ({ many }) => ({
  // Domain tags can be used by many bookmarks
  bookmarks: many(bookmarks),
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
    // Enforce non-empty name and valid URL
    name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required'),
    url: z.string({ required_error: 'URL is required' }).trim().url('Please provide a valid URL'),
    // Add client-facing passcode field with validation
    passcode: z
      .string()
      .min(4, 'Passcode must be at least 4 characters long')
      .max(64, 'Passcode must be no more than 64 characters long')
      .transform((val) => (val === '' ? null : val)) // Transform empty string to null
      .nullable()
      .optional(),
    language: bookmarkLanguageEnum.nullable().optional(),
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
export type Bookmark = Omit<typeof bookmarks.$inferSelect, 'passcodeHash' | 'searchVector'>; // Remove internal fields from public type

// User and preferences types/schemas (tables already defined above)
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    userId: true, // userId will be added server-side from authenticated user
  })
  .extend({
    defaultAiLanguage: preferenceAiLanguageEnum.optional(),
    timezone: z.string().max(64).optional(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// Domain tags schemas and types
export const insertDomainTagSchema = createInsertSchema(domainTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomainTag = z.infer<typeof insertDomainTagSchema>;
export type DomainTag = typeof domainTags.$inferSelect;

// AI Feed Crawler Schema

// AI Crawler Settings - User-specific configuration for feed crawling
export const aiCrawlerSettings = pgTable(
  'ai_crawler_settings',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    userId: varchar('user_id').notNull().unique(),
    maxFeedsPerSource: integer('max_feeds_per_source').default(5),
    isEnabled: boolean('is_enabled').default(true),
    crawlScheduleMode: varchar('crawl_schedule_mode', { length: 20 })
      .notNull()
      .default('every_hours'),
    crawlScheduleValue: varchar('crawl_schedule_value', { length: 10 }).notNull().default('6'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('ai_crawler_settings_user_id_idx').on(table.userId),
  }),
);

export const aiFeedSources = pgTable(
  'ai_feed_sources',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    url: text('url').notNull(),
    userId: varchar('user_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  lastRunAt: timestamp('last_run_at'),
  isActive: boolean('is_active').default(true),
  crawlScheduleMode: varchar('crawl_schedule_mode', { length: 20 }).notNull().default('inherit'),
  crawlScheduleValue: varchar('crawl_schedule_value', { length: 16 }).default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userUrlIdx: index('ai_feed_sources_user_url_idx').on(table.userId, table.url),
  }),
);

// AI Feed Articles - Individual articles fetched from feeds
export const aiFeedArticles = pgTable(
  'ai_feed_articles',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    sourceId: integer('source_id').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    originalContent: text('original_content'),
    formattedContent: text('formatted_content'),
    summary: text('summary'),
    url: text('url').notNull(),
    imageUrl: text('image_url'),
    notificationContent: varchar('notification_content', { length: 200 }),
    notificationSent: boolean('notification_sent').default(false),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    shareId: varchar('share_id', { length: 20 }),
    isShared: boolean('is_shared').default(false),
  },
  (table) => ({
    sourceIdIdx: index('ai_feed_articles_source_id_idx').on(table.sourceId),
    urlIdx: index('ai_feed_articles_url_idx').on(table.url),
    notificationIdx: index('ai_feed_articles_notification_idx').on(table.notificationSent),
    shareIdIdx: index('ai_feed_articles_share_id_idx').on(table.shareId),
  }),
);

// Relations for AI Feed Crawler
export const aiCrawlerSettingsRelations = relations(aiCrawlerSettings, ({ one }) => ({
  user: one(users, {
    fields: [aiCrawlerSettings.userId],
    references: [users.id],
  }),
}));

export const aiFeedSourcesRelations = relations(aiFeedSources, ({ one, many }) => ({
  user: one(users, {
    fields: [aiFeedSources.userId],
    references: [users.id],
  }),
  articles: many(aiFeedArticles),
}));

export const aiFeedArticlesRelations = relations(aiFeedArticles, ({ one }) => ({
  source: one(aiFeedSources, {
    fields: [aiFeedArticles.sourceId],
    references: [aiFeedSources.id],
  }),
}));

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    userId: varchar('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    authKey: varchar('auth_key', { length: 255 }).notNull(),
    p256dhKey: varchar('p256dh_key', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    endpointUniqueIdx: uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
    userIdx: index('push_subscriptions_user_idx').on(table.userId),
  }),
);

// Insert schemas for AI Feed Crawler
export const insertAiCrawlerSettingsSchema = createInsertSchema(aiCrawlerSettings).omit({
  id: true,
  createdAt: true,
});

export const insertAiFeedSourceSchema = createInsertSchema(aiFeedSources).omit({
  id: true,
  status: true,
  lastRunAt: true,
  createdAt: true,
});

export const insertAiFeedArticleSchema = createInsertSchema(aiFeedArticles).omit({
  id: true,
  notificationSent: true,
  createdAt: true,
});

// AI Feed Job Queue for persistent processing
export const aiFeedJobs = pgTable(
  'ai_feed_jobs',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    sourceId: integer('source_id').notNull(),
    userId: varchar('user_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed
    priority: integer('priority').default(0),
    scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0),
    maxRetries: integer('max_retries').default(3),
    settings: json('settings').notNull(), // Store AI settings with the job
  },
  (table) => ({
    sourceIdIdx: index('ai_feed_jobs_source_id_idx').on(table.sourceId),
    userIdIdx: index('ai_feed_jobs_user_id_idx').on(table.userId),
    statusIdx: index('ai_feed_jobs_status_idx').on(table.status),
    scheduledAtIdx: index('ai_feed_jobs_scheduled_at_idx').on(table.scheduledAt),
  }),
);

// Relations for AI Feed Jobs
export const aiFeedJobsRelations = relations(aiFeedJobs, ({ one }) => ({
  source: one(aiFeedSources, {
    fields: [aiFeedJobs.sourceId],
    references: [aiFeedSources.id],
  }),
}));

// Insert schema for AI Feed Jobs
export const insertAiFeedJobSchema = createInsertSchema(aiFeedJobs).omit({
  id: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  errorMessage: true,
  retryCount: true,
});

// Types for AI Feed Crawler
export type AiCrawlerSettings = typeof aiCrawlerSettings.$inferSelect;
export type InsertAiCrawlerSettings = z.infer<typeof insertAiCrawlerSettingsSchema>;
export type AiFeedSource = typeof aiFeedSources.$inferSelect;
export type InsertAiFeedSource = z.infer<typeof insertAiFeedSourceSchema>;
export type AiFeedArticle = typeof aiFeedArticles.$inferSelect;
export type InsertAiFeedArticle = z.infer<typeof insertAiFeedArticleSchema>;
export type AiFeedJob = typeof aiFeedJobs.$inferSelect;
export type InsertAiFeedJob = z.infer<typeof insertAiFeedJobSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
