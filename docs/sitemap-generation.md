# Sitemap Generation Guide

This document explains how the sitemap.xml is automatically generated with shared articles.

## Overview

The sitemap is dynamically generated to include:
- **Static pages** (/, /discover, /documentation, /auth)
- **Documentation sections** (all anchor links in documentation)
- **Shared articles** (all AI feed articles marked as shared)

## How It Works

### 1. Dynamic Sitemap API (Recommended)

The sitemap is served dynamically via `/sitemap.xml` endpoint:

```
GET /sitemap.xml
```

**Features:**
- ✅ **Always up-to-date** - Reflects latest shared articles
- ✅ **No manual regeneration needed**
- ✅ **Cached for 1 hour** - Good performance
- ✅ **Limits to 5000 most recent articles** - Prevents oversized sitemaps

**How it works:**
1. When `/sitemap.xml` is requested, the server queries the database
2. Fetches all shared articles (where `isShared = true` and `isDeleted = false`)
3. Generates XML on-the-fly with all URLs
4. Returns with appropriate cache headers

### 2. Manual Static Generation

You can also generate a static `sitemap.xml` file:

```bash
npm run sitemap:generate
```

This creates a static file at `client/public/sitemap.xml`.

**When to use:**
- Pre-deployment builds
- Creating a snapshot for debugging
- If you prefer static files over dynamic generation

## Article URLs in Sitemap

Each shared article gets a URL like:

```xml
<url>
  <loc>https://memorize.click/shared-article/{shareId}</loc>
  <lastmod>2025-09-18T10:30:00Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.6</priority>
</url>
```

**Requirements for articles to appear:**
- Article must have `isShared = true`
- Article must have `isDeleted = false`
- Article must have a valid `shareId`

## Priority Levels

The sitemap uses the following priority structure:

- **1.0** - Homepage (/)
- **0.9** - Discovery page (/discover)
- **0.8** - Documentation (/documentation)
- **0.7** - Documentation sections (#anchors)
- **0.6** - Shared articles (/shared-article/:shareId)
- **0.5** - Auth page (/auth)

## Monitoring

Check sitemap stats:

```bash
curl http://localhost:4001/api/sitemap/stats
```

Response:
```json
{
  "staticPages": 4,
  "documentationPages": 54,
  "sharedArticles": 250,
  "totalUrls": 308,
  "baseUrl": "https://memorize.click",
  "lastGenerated": "2025-09-18T10:30:00Z"
}
```

## SEO Configuration

### robots.txt

The `robots.txt` file is configured to:
- ✅ **Allow** `/shared-article/` for crawling
- ✅ **Allow** `/discover/` for crawling
- ❌ **Disallow** `/api/` and authenticated routes

### Sitemap Registration

The sitemap is registered in `robots.txt`:

```
Sitemap: https://memorize.click/sitemap.xml
```

## How Articles Get Shared

To make an article appear in the sitemap:

1. **Create AI Feed Source** (in AI Feed Management)
2. **Process feeds** - Articles are auto-crawled
3. **Share article** - Click share button or auto-share in settings
4. Article automatically gets:
   - `isShared = true`
   - Unique `shareId`
   - Public URL: `/shared-article/{shareId}`

## Automatic Updates

The sitemap updates automatically:
- **Dynamic endpoint**: Always reflects current database state
- **Cache**: Refreshed every hour
- **New articles**: Appear immediately (after cache expires)

## Production Deployment

### Option 1: Dynamic (Recommended)

No special setup needed. The `/sitemap.xml` endpoint is registered and will serve the sitemap dynamically.

### Option 2: Static + Cron

If you prefer static sitemaps with periodic regeneration:

1. Add to your cron jobs:
   ```bash
   0 */6 * * * cd /app && npm run sitemap:generate
   ```

2. This regenerates the sitemap every 6 hours

## Google Search Console

After deployment:

1. Visit [Google Search Console](https://search.google.com/search-console)
2. Add your property: `https://memorize.click`
3. Submit sitemap: `https://memorize.click/sitemap.xml`
4. Google will crawl and index your shared articles

## Troubleshooting

### Sitemap is empty or missing articles

Check:
```sql
SELECT COUNT(*) 
FROM ai_feed_articles 
WHERE is_shared = true AND is_deleted = false;
```

### Articles not appearing in sitemap

Verify the article has:
- `isShared = true`
- `isDeleted = false`
- Valid `shareId`

### Performance issues with large sitemaps

The dynamic endpoint limits to 5000 articles. If you have more:
- Consider creating a sitemap index
- Split into multiple sitemaps by date
- Increase the limit in `sitemap-routes.ts`

## Example Sitemap Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://memorize.click/</loc>
    <lastmod>2025-09-18T10:00:00Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://memorize.click/discover</loc>
    <lastmod>2025-09-18T10:00:00Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://memorize.click/shared-article/abc123def456</loc>
    <lastmod>2025-09-18T09:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- More articles... -->
</urlset>
```

## Related Files

- `server/routes/sitemap-routes.ts` - Dynamic sitemap API
- `server/scripts/generate-sitemap.ts` - Static sitemap generator
- `client/public/robots.txt` - Robots configuration
- `client/public/__sitemap__/style.xsl` - Sitemap styling
