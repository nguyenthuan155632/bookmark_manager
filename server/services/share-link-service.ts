import { aiFeedArticles, aiFeedSources } from '@shared/schema.js';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';

function generateShareId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export async function ensureShareLinkForArticle(articleId: number, userId: string): Promise<string> {
  const existing = await db
    .select({ shareId: aiFeedArticles.shareId })
    .from(aiFeedArticles)
    .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
    .where(and(eq(aiFeedArticles.id, articleId), eq(aiFeedSources.userId, userId)))
    .limit(1);

  if (!existing.length) {
    throw new Error('Article not found');
  }

  if (existing[0].shareId) {
    return existing[0].shareId;
  }

  const shareId = generateShareId();

  await db
    .update(aiFeedArticles)
    .set({
      shareId,
      isShared: true,
    })
    .where(eq(aiFeedArticles.id, articleId));

  return shareId;
}
