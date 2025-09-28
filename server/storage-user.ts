import {
  users,
  userPreferences,
  apiTokens,
  type User,
  type InsertUser,
  type UserPreferences,
  type InsertUserPreferences,
} from '@shared/schema';
import crypto from 'crypto';
import { db, eq } from './storage-base';

export class UserStorage {
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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserUsername(userId: string, username: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ username })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // API token methods
  async createApiToken(userId: string): Promise<{ token: string; id: number }> {
    // Generate a 64-char hex token
    const token = crypto.randomBytes(32).toString('hex');
    const [row] = await db.insert(apiTokens).values({ userId, token }).returning();
    return { token, id: row.id };
  }

  async getUserByApiToken(token: string): Promise<User | undefined> {
    const [row] = await db
      .select({ userId: apiTokens.userId })
      .from(apiTokens)
      .where(eq(apiTokens.token, token));
    if (!row) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, row.userId));
    return user || undefined;
  }

  async touchApiToken(token: string): Promise<void> {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.token, token));
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences || undefined;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences> {
    // Check if preferences record exists for this user
    const existingPreferences = await this.getUserPreferences(userId);

    if (existingPreferences) {
      const updatePayload: Record<string, unknown> = { ...preferences };
      for (const key of Object.keys(updatePayload)) {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      }

      // Update existing record
      const [updatedPreferences] = await db
        .update(userPreferences)
        .set({
          ...updatePayload,
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
          theme: preferences.theme || 'light',
          viewMode: preferences.viewMode || 'grid',
          aiUsageLimit: preferences.aiUsageLimit ?? 50,
          defaultAiLanguage: preferences.defaultAiLanguage || 'auto',
          timezone: preferences.timezone || 'UTC',
        })
        .returning();
      return newPreferences;
    }
  }
}
