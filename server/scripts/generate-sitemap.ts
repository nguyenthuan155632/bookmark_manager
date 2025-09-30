import { aiFeedArticles } from '@shared/schema';
import 'dotenv/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db';

const CANONICAL_BASE_URL = process.env.CANONICAL_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || 'https://memorize.click';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

const staticUrls: SitemapUrl[] = [
  {
    loc: '/',
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 1.0,
  },
  {
    loc: '/discover',
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.9,
  },
  {
    loc: '/documentation',
    lastmod: new Date().toISOString(),
    changefreq: 'weekly',
    priority: 0.8,
  },
  {
    loc: '/auth',
    lastmod: new Date().toISOString(),
    changefreq: 'monthly',
    priority: 0.5,
  },
];

// Documentation sections
const documentationSections = [
  'getting-started',
  'overview',
  'authentication',
  'first-bookmark',
  'core-features',
  'bookmarks',
  'create-bookmark',
  'edit-bookmark',
  'delete-bookmark',
  'view-bookmark',
  'favorite-bookmarks',
  'categories',
  'create-category',
  'edit-category',
  'delete-category',
  'reorder-categories',
  'search-filter',
  'search-bookmarks',
  'filter-by-category',
  'filter-by-tags',
  'filter-by-status',
  'sort-bookmarks',
  'advanced-features',
  'bulk-operations',
  'ai-features',
  'auto-tagging',
  'auto-description',
  'domain-tags',
  'link-management',
  'link-checking',
  'broken-links',
  'link-status',
  'screenshots',
  'auto-screenshots',
  'screenshot-status',
  'security-privacy',
  'protected-bookmarks',
  'create-protected',
  'unlock-protected',
  'sharing',
  'share-bookmark',
  'data-management',
  'import-export',
  'export-bookmarks',
  'import-bookmarks',
  'customization',
  'appearance',
  'themes',
  'view-modes',
  'settings',
  'user-preferences',
  'default-category',
  'session-timeout',
  'extensions',
  'chrome-extension',
  'install-extension',
  'extension-usage',
  'troubleshooting',
  'common-issues',
  'performance',
  'support',
];

const documentationUrls: SitemapUrl[] = documentationSections.map((section) => ({
  loc: `/documentation#${section}`,
  lastmod: new Date().toISOString(),
  changefreq: 'weekly',
  priority: 0.7,
}));

async function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...');

  try {
    // Fetch all shared articles
    const sharedArticles = await db
      .select({
        shareId: aiFeedArticles.shareId,
        createdAt: aiFeedArticles.createdAt,
        title: aiFeedArticles.title,
      })
      .from(aiFeedArticles)
      .where(
        and(
          eq(aiFeedArticles.isShared, true),
          eq(aiFeedArticles.isDeleted, false),
          isNotNull(aiFeedArticles.shareId)
        )
      )
      .orderBy(aiFeedArticles.createdAt);

    console.log(`📰 Found ${sharedArticles.length} shared articles`);

    // Generate article URLs (shareId is guaranteed non-null by query)
    const articleUrls: SitemapUrl[] = sharedArticles
      .map((article) => ({
        loc: `/shared-article/${article.shareId}`,
        lastmod: new Date(article.createdAt).toISOString(),
        changefreq: 'weekly' as const,
        priority: 0.6,
      }));

    // Combine all URLs
    const allUrls = [...staticUrls, ...documentationUrls, ...articleUrls];

    // Generate XML
    const xml = generateSitemapXML(allUrls);

    // Write to file
    const outputPath = join(process.cwd(), 'client', 'public', 'sitemap.xml');
    writeFileSync(outputPath, xml, 'utf-8');

    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📊 Total URLs: ${allUrls.length}`);
    console.log(`   - Static pages: ${staticUrls.length}`);
    console.log(`   - Documentation: ${documentationUrls.length}`);
    console.log(`   - Shared articles: ${articleUrls.length}`);
    console.log(`📁 Output: ${outputPath}`);

    return {
      success: true,
      totalUrls: allUrls.length,
      staticUrls: staticUrls.length,
      documentationUrls: documentationUrls.length,
      articleUrls: articleUrls.length,
    };
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    throw error;
  }
}

function generateSitemapXML(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map((url) => {
      const fullUrl = url.loc.startsWith('http') ? url.loc : `${CANONICAL_BASE_URL}${url.loc}`;
      return `  <url>
    <loc>${escapeXml(fullUrl)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/__sitemap__/style.xsl"?>
<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
<!-- XML Sitemap generated by Memorize Vault at ${new Date().toISOString()} -->
`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Run if called directly (ES module check)
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;

if (isMainModule) {
  generateSitemap()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { generateSitemap };
