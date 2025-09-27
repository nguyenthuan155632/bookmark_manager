# AI News Feed Crawler Schema Design Discussions

## Overview
Design discussions for creating an AI news feed crawler system integrated with the existing bookmark manager.

## Initial Requirements
- Create a schema to crawl news/feeds related to AI
- Basic fields: id, url, status, last_run_at
- Allow setting maxFeeds crawled
- User can trigger Crawler Service or run by cron job every xxx
- Save crawled content with original and summarized content
- Use AI (OpenRouter) for formatting and summarization

## Discussion Evolution

### Iteration 1: Complex Schema
First proposal was overly complex with multiple tables:
- `aiFeedSources` - Feed source management
- `aiFeedArticles` - Article storage
- `aiUserFeedPreferences` - User preferences
- `aiFeedProcessingQueue` - Processing queue
- Multiple fields for categories, tags, sentiment analysis

**Feedback**: Too complicated, should be simpler

### Iteration 2: Simple Schema
Reduced to essential fields:
```typescript
export const aiFeedSources = pgTable('ai_feed_sources', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  url: text('url').notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  lastRunAt: timestamp('last_run_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Feedback**: Need maxFeeds control and user triggering

### Iteration 3: Added Controls
Added settings for feed management:
- `maxFeeds` - Max feeds per source
- `crawlInterval` - Minutes between crawls
- `isActive` - Enable/disable feeds
- Global settings table for limits

**Feedback**: Why no userId in settings? Need user scope

### Iteration 4: User-Scope and Article Storage
Added user isolation and article storage:
- `userId` in all tables for user isolation
- `aiFeedArticles` table to save original and formatted content
- AI formatting prompts for content enhancement
- Image URL extraction and storage

**Feedback**: Don't need isBookmarked, save only essential info

### Iteration 5: Streamlined Schema
Removed unnecessary fields:
- Removed `isBookmarked` (use existing bookmark system)
- Removed `tags`, `category`, `author`, `isRead`
- Kept essential fields only

**Feedback**: Keep summary field, add language support, markdown format

### Iteration 6: Enhanced with Language and Images
Added comprehensive language support:
- `defaultAiLanguage` in settings
- AI translation to user's language
- Markdown format for clean content
- Image URL extraction (no image storage)
- Enhanced AI prompts for translation

**Feedback**: Remove maxConcurrentFeeds, remove userId redundancy

### Iteration 7: Streamlined Relations
Simplified data model:
- Removed `maxConcurrentFeeds` (overcomplicates)
- Removed `userId` from articles (join through sources)
- Added `notificationSent` for push notifications

**Feedback**: Need field for push notification content

### Iteration 8: Final Schema with Push Content
Added push notification content field:
- `notificationContent` - 200 char max for push messages
- AI prompt for generating notification content
- Complete flow from article creation to push notification

## Final Schema Design

### User Settings
```typescript
export const aiCrawlerSettings = pgTable('ai_crawler_settings', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar('user_id').notNull().unique(),
  maxFeedsPerSource: integer('max_feeds_per_source').default(5),
  isEnabled: boolean('is_enabled').default(true),
  defaultAiLanguage: varchar('default_ai_language', { length: 16 }).notNull().default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Feed Sources
```typescript
export const aiFeedSources = pgTable('ai_feed_sources', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  url: text('url').notNull(),
  userId: varchar('user_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  lastRunAt: timestamp('last_run_at'),
  crawlInterval: integer('crawl_interval').default(60),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Articles
```typescript
export const aiFeedArticles = pgTable('ai_feed_articles', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  sourceId: integer('source_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  originalContent: text('original_content'),
  formattedContent: text('formattedContent'),
  summary: text('summary'),
  url: text('url').notNull(),
  imageUrl: text('image_url'),
  notificationContent: varchar('notification_content', { length: 200 }),
  notificationSent: boolean('notification_sent').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Key Features Implemented

### User Control
- User-specific feed sources and settings
- Configurable crawl intervals and limits
- Enable/disable individual feeds
- Manual trigger capability
- Language preferences for AI processing

### Content Processing
- AI-powered content formatting (markdown)
- Translation to user's preferred language
- Summary generation in user's language
- Image URL extraction
- Push notification content generation

### Integration
- User isolation throughout the system
- Leverages existing bookmark system
- Uses existing OpenRouter AI integration
- Follows established database patterns
- Ready for push notification system

## AI Prompts

### Content Formatting & Translation
- Clean HTML tags and format to markdown
- Translate content to user's language
- Extract image URLs
- Maintain technical accuracy

### Summary Generation
- 2-3 paragraphs in user's language
- Capture main points and significance
- Include technical details and breakthroughs

### Push Notification Content
- Maximum 200 characters
- Engaging and informative
- In user's language
- Compelling to drive engagement

## Processing Flow

1. User adds RSS feed URLs to their collection
2. Cron job checks feeds based on user intervals
3. System fetches raw content from feeds
4. AI processes content: formatting, translation, summarization
5. Generates push notification content
6. Saves all processed data
7. Sends push notifications (future implementation)
8. User can read formatted content and bookmark interesting articles

## Benefits of Final Design

- **Simplicity**: Only essential fields and tables
- **User-focused**: Complete user isolation and control
- **AI-enhanced**: High-quality content processing
- **Multilingual**: Support for multiple languages
- **Extensible**: Ready for future features
- **Integrated**: Works with existing systems
- **Efficient**: Lean data model with proper indexing

## Next Steps for Implementation

1. Add schema to `shared/schema.ts`
2. Create and run database migration
3. Enhance cron job for feed processing
4. Create API endpoints for feed management
5. Implement AI processing with OpenRouter
6. Add push notification system (future)
7. Create user interface for feed management
