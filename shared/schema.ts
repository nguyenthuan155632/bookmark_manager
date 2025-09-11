import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookmarks = pgTable("bookmarks", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url").notNull(),
  tags: text("tags").array().default([]),
  isFavorite: boolean("is_favorite").default(false),
  categoryId: integer("category_id"),
  passcodeHash: text("passcode_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  category: one(categories, {
    fields: [bookmarks.categoryId],
    references: [categories.id],
  }),
}));

// Schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

// Client-facing bookmark schemas (using 'passcode' instead of 'passcodeHash')
export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passcodeHash: true, // Exclude internal hash field from client API
}).extend({
  // Add client-facing passcode field with validation
  passcode: z.string()
    .min(4, "Passcode must be at least 4 characters long")
    .max(64, "Passcode must be no more than 64 characters long")
    .transform(val => val === "" ? null : val) // Transform empty string to null
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

// User schema (keeping existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User Preferences schema
export const userPreferences = pgTable("user_preferences", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  theme: varchar("theme", { length: 10 }).notNull().default("light"),
  viewMode: varchar("view_mode", { length: 10 }).notNull().default("grid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
