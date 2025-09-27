import { Readability } from '@mozilla/readability';
import {
  aiCrawlerSettings,
  aiFeedSources,
  userPreferences,
  type AiCrawlerSettings,
  type AiFeedSource
} from '@shared/schema.js';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { JSDOM } from 'jsdom';
import cron from 'node-cron';
import OpenAI from 'openai';
import { db } from '../db';
import { aiFeedProcessor } from './ai-feed-processor.js';

type AiCrawlerSettingsWithLanguage = AiCrawlerSettings & { defaultAiLanguage?: string };

class CronService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private openai: OpenAI | null = null;

  constructor() {
    this.setupCronJob();
  }

  private setupCronJob(): void {
    // Run daily in 7:00 AM
    const cronExpression = '0 7 * * *';
    // const cronExpression = '*/1 * * * *';

    this.cronJob = cron.schedule(cronExpression, () => {
      this.executeCronJob();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Log configuration during initialization, not in constructor
    console.log(`⏰ Cron job configured to run daily in 7:00 AM in ICT timezone with expression: ${cronExpression}`);
  }

  private getOpenRouterClient(): OpenAI | null {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    if (!this.openai) {
      const referer =
        process.env.OPENROUTER_SITE_URL?.trim() ||
        process.env.VITE_PUBLIC_BASE_URL?.trim() ||
        'http://localhost:4001';
      const title = process.env.OPENROUTER_SITE_TITLE?.trim() || 'Memorize Vault';

      this.openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': referer,
          'X-Title': title
        }
      });
    }

    return this.openai;
  }

  private async executeCronJob(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Cron job is already running, skipping this execution');
      return;
    }

    try {
      this.isRunning = true;
      const timestamp = new Date().toISOString();

      console.log(`🕒 Cron job executed at ${timestamp}`);

      // Execute the main cron tasks
      await this.performCronTasks();

      console.log(`✅ Cron job completed successfully at ${timestamp}`);
    } catch (error) {
      console.error(`❌ Cron job failed at ${new Date().toISOString()}:`, error);

      // Don't throw the error - we don't want to crash the main server
      // Just log it and continue
    } finally {
      this.isRunning = false;
    }
  }

  private async performCronTasks(): Promise<void> {
    console.log('📋 Performing scheduled tasks...');

    try {
      // Process AI feed crawling
      await this.processAiFeeds();

      // Add other tasks here in the future:
      // - Clean up expired sessions
      // - Check bookmark statuses
      // - Send notifications
      // - Generate reports
      // - Update caches
      // - Database maintenance
      // - Log rotation
    } catch (error) {
      console.error('❌ Error in performCronTasks:', error);
      throw error;
    }

    console.log('✨ Scheduled tasks completed');
  }

  private async processAiFeeds(): Promise<void> {
    console.log('🤖 Processing AI feeds...');

    try {
      // Get all enabled crawler settings
      const settings = await db
        .select()
        .from(aiCrawlerSettings)
        .where(eq(aiCrawlerSettings.isEnabled, true));

      console.log(`Found ${settings.length} enabled crawler settings`);

      for (const setting of settings) {
        // Get user preferences for language settings
        const userPrefs = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, setting.userId));

        // Get active feed sources for this user that need processing
        const feedsToProcess = await db
          .select()
          .from(aiFeedSources)
          .where(
            and(
              eq(aiFeedSources.userId, setting.userId),
              eq(aiFeedSources.isActive, true),
              or(
                isNull(aiFeedSources.lastRunAt),
                sql`${aiFeedSources.lastRunAt} + interval '1 minute' * ${aiFeedSources.crawlInterval} < ${new Date()}`
              )
            )
          );

        console.log(`User ${setting.userId}: ${feedsToProcess.length} feeds to process`);

        for (const feed of feedsToProcess) {
          // Merge crawler settings with user preferences
          const mergedSettings = {
            ...setting,
            defaultAiLanguage: userPrefs[0]?.defaultAiLanguage || 'auto'
          };
          await this.processSingleFeed(feed, mergedSettings);
        }
      }

      console.log('✅ AI feeds processing completed');
    } catch (error) {
      console.error('❌ Error processing AI feeds:', error);
      throw error;
    }
  }

  public async processSingleFeed(feed: AiFeedSource, setting: AiCrawlerSettingsWithLanguage): Promise<void> {
    console.log(`📡 Processing feed: ${feed.url} for user ${feed.userId}`);
    const feedStartTime = Date.now();

    try {
      // Update feed status to running
      await db
        .update(aiFeedSources)
        .set({ status: 'running' })
        .where(eq(aiFeedSources.id, feed.id));

      // Fetch and process HTML content
      console.log(`🔍 Crawling HTML content from: ${feed.url}`);
      const articles = await this.crawlHtmlContent(feed.url, setting);

      if (articles.length > 0) {
        console.log(`📝 Found ${articles.length} articles to process with AI`);
        console.log(`🌐 AI language setting: ${setting.defaultAiLanguage || 'auto'}`);

        // Process articles with AI
        await aiFeedProcessor.processFeedContent(feed, setting, articles);

        const feedEndTime = Date.now();
        const feedDuration = feedEndTime - feedStartTime;
        console.log(`✅ Processed ${articles.length} articles from ${feed.url} in ${feedDuration}ms`);
      } else {
        console.log(`ℹ️ No new articles found in ${feed.url}`);
      }

      // Update feed status to completed and set last run time
      await db
        .update(aiFeedSources)
        .set({
          status: 'completed',
          lastRunAt: new Date()
        })
        .where(eq(aiFeedSources.id, feed.id));

      console.log(`✅ Feed ${feed.url} processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing feed ${feed.url}:`, error);

      // Update feed status to failed
      await db
        .update(aiFeedSources)
        .set({ status: 'failed' })
        .where(eq(aiFeedSources.id, feed.id));

      throw error;
    }
  }

  private async crawlHtmlContent(
    sourceUrl: string,
    setting: AiCrawlerSettings
  ): Promise<Array<{
    title: string;
    content: string;
    url: string;
    publishedAt?: Date;
    imageUrl?: string;
  }>> {
    try {
      // Fetch HTML content with headers to avoid blocking
      const htmlContent = await this.fetchHtmlWithHeaders(sourceUrl);

      if (!htmlContent) {
        console.log(`⚠️ No content found at: ${sourceUrl}`);
        return [];
      }

      // Extract articles from HTML content
      const articles = await this.extractArticlesFromHtml(htmlContent, sourceUrl, setting);

      console.log(`📡 Successfully extracted ${articles.length} articles from ${sourceUrl}`);
      return articles;
    } catch (error) {
      console.error(`❌ Error crawling HTML content ${sourceUrl}:`, error);
      return [];
    }
  }

  private async fetchHtmlWithHeaders(url: string): Promise<string | null> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      console.log(`📄 Fetched HTML content: ${content.length} characters from ${url}`);
      return content;
    } catch (error) {
      console.error(`❌ Error fetching HTML from ${url}:`, error);
      return null;
    }
  }

  private async analyzeHtmlWithAI(
    htmlContent: string,
    baseUrl: string
  ): Promise<{ pageType: 'article' | 'listing' | 'unknown'; articleUrls: string[] }> {
    const client = this.getOpenRouterClient();
    if (!client) {
      return { pageType: 'unknown', articleUrls: [] };
    }

    try {
      const preparedHtml = this.prepareHtmlForAnalysis(htmlContent);
      const model = process.env.OPENROUTER_DESC_MODEL?.trim() || 'deepseek/deepseek-chat-v3.1:free';
      const systemPrompt = `You are an expert content crawler. Given an HTML snapshot of a web page, determine whether it represents a single article or an article listing. When it is a listing page, extract the canonical URLs that point to full articles. Return at least 10 article URLs when available (up to 25), sorted in reading order. Exclude navigation, pagination, tag, category, author, or utility links. Always respond with valid JSON.`;
      const userPrompt = `Base URL: ${baseUrl}\n\nHTML Snapshot (truncated):\n${preparedHtml}`;

      const completion = (await Promise.race([
        client.chat.completions.create({
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `${userPrompt}\n\nRequired JSON response format:{"pageType":"article|listing|unknown","articleUrls":["url1","url2",...]}. Return 10-25 article URLs when a listing has that many. Preserve the original order from the page. Use relative paths if only those appear in HTML.`
            }
          ]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout after 90s')), 90000)
        )
      ])) as any;

      const rawResponse = completion?.choices?.[0]?.message?.content;
      if (!rawResponse) {
        console.warn('⚠️ Empty AI response for article analysis');
        return { pageType: 'unknown', articleUrls: [] };
      }

      const cleaned = this.cleanAiJsonResponse(rawResponse);

      try {
        const parsed = JSON.parse(cleaned) as {
          pageType?: string;
          articleUrls?: unknown;
        };

        const pageType = parsed.pageType === 'article' || parsed.pageType === 'listing'
          ? parsed.pageType
          : 'unknown';
        const urls = Array.isArray(parsed.articleUrls)
          ? parsed.articleUrls.filter((item): item is string => typeof item === 'string')
          : [];

        return {
          pageType,
          articleUrls: urls
        };
      } catch (parseError) {
        console.error('❌ Failed to parse AI article analysis response as JSON:', parseError);
        console.error('❌ Raw AI response snippet:', cleaned.substring(0, 500));
        return { pageType: 'unknown', articleUrls: [] };
      }
    } catch (error) {
      console.error('❌ Error during AI-driven article analysis:', error);
      return { pageType: 'unknown', articleUrls: [] };
    }
  }

  private prepareHtmlForAnalysis(htmlContent: string): string {
    const withoutNoise = htmlContent
      .replace(/<(script|style|noscript|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\s*iframe[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const anchorMatches = withoutNoise.match(/<a[^>]*>[^<]*<\/a>/gi) || [];
    const anchorSample = anchorMatches
      .slice(0, 200)
      .map(anchor => anchor.replace(/\s+/g, ' ').trim().slice(0, 300))
      .join('\n');

    const truncatedMain = withoutNoise.slice(0, 40000);
    const payload = `MAIN_HTML_START\n${truncatedMain}\nMAIN_HTML_END\nANCHORS_START\n${anchorSample}\nANCHORS_END`;

    return payload.slice(0, 60000);
  }

  private cleanAiJsonResponse(response: string): string {
    let cleaned = response.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return cleaned.trim();
  }

  private normalizeArticleUrls(urls: string[], baseUrl: string): string[] {
    const normalized = new Set<string>();

    for (const rawUrl of urls) {
      const trimmed = rawUrl.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const resolved = new URL(trimmed, baseUrl).href;
        if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
          normalized.add(resolved);
        }
      } catch (_error) {
        continue;
      }
    }

    return Array.from(normalized);
  }

  private mergeArticleLinks(primary: string[], secondary: string[]): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];

    const addLink = (link: string) => {
      if (!link) {
        return;
      }
      if (!seen.has(link)) {
        seen.add(link);
        merged.push(link);
      }
    };

    for (const link of primary) {
      addLink(link);
    }

    for (const link of secondary) {
      addLink(link);
    }

    return merged;
  }

  private async extractArticlesFromHtml(
    htmlContent: string,
    baseUrl: string,
    setting: AiCrawlerSettings
  ): Promise<Array<{
    title: string;
    content: string;
    url: string;
    publishedAt?: Date;
    imageUrl?: string;
  }>> {
    const articles: Array<{
      title: string;
      content: string;
      url: string;
      publishedAt?: Date;
      imageUrl?: string;
    }> = [];

    try {
      const maxArticles = setting.maxFeedsPerSource || 5;
      const aiAnalysis = await this.analyzeHtmlWithAI(htmlContent, baseUrl);
      const aiPageType = aiAnalysis.pageType;
      if (aiPageType) {
        console.log(`🤖 AI page analysis (${baseUrl}): ${aiPageType} | ${aiAnalysis.articleUrls.length} suggested links`);
      }

      const tryAddArticle = async (content: string, url: string) => {
        if (articles.length >= maxArticles) {
          return;
        }

        const article = await this.extractSingleArticle(content, url);
        if (!article) {
          return;
        }
        const isDuplicate = await aiFeedProcessor.checkDuplicateArticle(article.url, 0);
        if (!isDuplicate) {
          articles.push(article);
        }
      };

      if (aiAnalysis.pageType === 'article') {
        console.log(`📰 AI identified ${baseUrl} as an article page`);
        await tryAddArticle(htmlContent, baseUrl);
        if (articles.length > 0) {
          return articles.slice(0, maxArticles);
        }
        console.log('⚠️ AI indicated article page but extraction failed, falling back to link discovery');
      }

      if (aiAnalysis.pageType !== 'listing' && this.isArticlePage(baseUrl)) {
        console.log(`📰 Fallback treating ${baseUrl} as article page via heuristics`);
        await tryAddArticle(htmlContent, baseUrl);
        if (articles.length > 0) {
          return articles.slice(0, maxArticles);
        }
      }

      const aiLinks = aiAnalysis.articleUrls.length > 0
        ? this.normalizeArticleUrls(aiAnalysis.articleUrls, baseUrl)
        : [];
      const heuristicLinks = this.extractArticleLinks(htmlContent, baseUrl);
      const articleLinks = this.mergeArticleLinks(aiLinks, heuristicLinks);

      if (aiLinks.length === 0) {
        console.log(`📋 AI did not provide links, using heuristic extraction for ${baseUrl}`);
      }

      console.log(`🔗 Found ${articleLinks.length} candidate article links, processing up to ${maxArticles}`);

      for (const link of articleLinks) {
        if (articles.length >= maxArticles) {
          break;
        }

        try {
          console.log(`📝 Processing article: ${link}`);
          const alreadyProcessed = await aiFeedProcessor.checkDuplicateArticle(link, 0);
          if (alreadyProcessed) {
            console.log(`⏭️  Skipping already processed article: ${link}`);
            continue;
          }
          const articleContent = await this.fetchHtmlWithHeaders(link);

          if (articleContent) {
            await tryAddArticle(articleContent, link);
          }
        } catch (error) {
          console.error(`❌ Error processing article ${link}:`, error);
        }
      }

      return articles;
    } catch (error) {
      console.error(`❌ Error extracting articles from HTML:`, error);
      return articles;
    }
  }

  private isArticlePage(url: string): boolean {
    // Common patterns that indicate a specific article page
    const articlePatterns = [
      /\/\d{4}\/\d{2}\/\d{2}\//, // Date-based URLs like /2024/12/27/
      /\/article\/\d+/,
      /\/news\/\d+/,
      /\/post\/\d+/,
      /\.html$/,
      /\/\d+$/ // Ends with numbers
    ];

    return articlePatterns.some(pattern => pattern.test(url));
  }

  private extractArticleLinks(htmlContent: string, baseUrl: string): string[] {
    const links = new Set<string>();

    try {
      const dom = new JSDOM(htmlContent, { url: baseUrl });
      try {
        const anchorElements = Array.from(
          dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')
        );

        for (const anchor of anchorElements) {
          const href = anchor.getAttribute('href');
          if (!href) {
            continue;
          }

          const text = (anchor.textContent || anchor.getAttribute('aria-label') || '').trim();

          if (this.looksLikeArticleLink(href, text)) {
            try {
              const absoluteUrl = new URL(href, baseUrl).href;
              if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
                links.add(absoluteUrl);
              }
            } catch (_error) {
              continue;
            }
          }
        }
      } finally {
        dom.window.close();
      }
    } catch (error) {
      console.warn(`⚠️ Heuristic link extraction failed for ${baseUrl}:`, error);
    }

    return Array.from(links);
  }

  private looksLikeArticleLink(href: string, linkText: string): boolean {
    if (!href) {
      return false;
    }

    const normalizedHref = href.toLowerCase();

    if (
      normalizedHref.startsWith('mailto:') ||
      normalizedHref.startsWith('tel:') ||
      normalizedHref.startsWith('javascript:')
    ) {
      return false;
    }

    const skipHrefPatterns = [
      /\/category\//,
      /\/categories\//,
      /\/tag\//,
      /\/tags\//,
      /\/topic\//,
      /\/topics\//,
      /\/author\//,
      /\/authors\//,
      /\/page\//,
      /\?/,
      /#/
    ];

    if (skipHrefPatterns.some(pattern => pattern.test(normalizedHref))) {
      return false;
    }

    const articleHrefPatterns = [
      /\/\d{4}\/\d{2}\/\d{2}\//,
      /\/\d{4}-\d{2}-\d{2}-/,
      /\/\d{4}\/\d{2}\//,
      /\/article\//,
      /\/news\//,
      /\/post\//,
      /\/story\//,
      /\.html?$/
    ];

    if (articleHrefPatterns.some(pattern => pattern.test(normalizedHref))) {
      return true;
    }

    if (!linkText || linkText.trim().length < 8) {
      return false;
    }

    const text = linkText.toLowerCase();

    const skipTextPatterns = [
      /home/i, /about/i, /contact/i, /login/i, /register/i,
      /search/i, /menu/i, /category/i, /tag/i, /author/i,
      /page \d+/i, /next/i, /previous/i, /more/i, /privacy/i, /terms/i
    ];

    if (skipTextPatterns.some(pattern => pattern.test(text))) {
      return false;
    }

    const articleTextPatterns = [
      /\d{4}/,
      /breaking/i,
      /update/i,
      /report/i,
      /guide/i,
      /release/i,
      /announcement/i,
      /launch/i,
      /insights?/i,
      /overview/i
    ];

    return articleTextPatterns.some(pattern => pattern.test(text));
  }

  private async extractSingleArticle(
    htmlContent: string,
    articleUrl: string
  ): Promise<{
    title: string;
    content: string;
    url: string;
    publishedAt?: Date;
    imageUrl?: string;
  } | null> {
    try {
      const readabilityResult = this.parseArticleWithReadability(htmlContent, articleUrl);

      let title = readabilityResult?.title?.trim() || this.extractTitle(htmlContent);
      if (title) {
        title = this.cleanHtml(title);
      }
      if (!title) {
        console.log(`⚠️ No title found for article: ${articleUrl}`);
        return null;
      }

      let content = '';
      if (readabilityResult?.textContent) {
        content = readabilityResult.textContent.trim();
      }

      if (content.length < 150 && readabilityResult?.htmlContent) {
        const cleaned = this.cleanAndExtractText(readabilityResult.htmlContent);
        if (cleaned.length > content.length) {
          content = cleaned;
        }
      }

      if (content.length < 150) {
        const fallbackContent = this.extractMainContent(htmlContent);
        if (fallbackContent.length > content.length) {
          content = fallbackContent;
        }
      }

      content = content.trim();

      if (!content || content.length < 150) {
        console.log(`⚠️ No sufficient content found for article: ${articleUrl} (${content?.length || 0} chars)`);
        return null;
      }

      // Extract publication date
      const publishedAt = this.extractPublishDate(htmlContent);

      // Extract main image
      let imageUrl = this.extractMainImage(htmlContent, articleUrl);
      if (!imageUrl && readabilityResult?.htmlContent) {
        imageUrl = this.extractMainImage(readabilityResult.htmlContent, articleUrl);
      }

      console.log(`✅ Extracted article: "${title.substring(0, 50)}..." (${content.length} chars)`);

      return {
        title,
        content,
        url: articleUrl,
        publishedAt,
        imageUrl
      };
    } catch (error) {
      console.error(`❌ Error extracting article from ${articleUrl}:`, error);
      return null;
    }
  }

  private parseArticleWithReadability(
    htmlContent: string,
    articleUrl: string
  ): {
    title?: string;
    textContent?: string;
    htmlContent?: string;
    excerpt?: string;
  } | null {
    try {
      const dom = new JSDOM(htmlContent, { url: articleUrl });
      try {
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article) {
          return null;
        }

        return {
          title: article.title || undefined,
          textContent: article.textContent || undefined,
          htmlContent: article.content || undefined,
          excerpt: article.excerpt || undefined
        };
      } finally {
        dom.window.close();
      }
    } catch (error) {
      console.warn(`⚠️ Readability parse failed for ${articleUrl}:`, error);
      return null;
    }
  }

  private extractTitle(htmlContent: string): string | null {
    // Try multiple title extraction strategies
    const titlePatterns = [
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /<title[^>]*>([^<]+)<\/title>/i,
      /<h2[^>]*>([^<]+)<\/h2>/i,
      /<h3[^>]*>([^<]+)<\/h3>/i
    ];

    for (const pattern of titlePatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        const title = match[1].trim();
        if (title.length > 10) { // Reasonable title length
          return this.cleanHtml(title);
        }
      }
    }

    return null;
  }

  private extractMainContent(htmlContent: string): string {
    // Try to find the main content area
    const contentSelectors = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<main[^>]*>([\s\S]*?)<\/main>/i
    ];

    for (const pattern of contentSelectors) {
      let match;
      while ((match = pattern.exec(htmlContent)) !== null) {
        const content = match[1];
        if (content.length > 200) { // Reasonable content length
          return this.cleanAndExtractText(content);
        }
      }
    }

    // Fallback: Extract all paragraphs
    const paragraphMatches = htmlContent.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (paragraphMatches) {
      const paragraphs = paragraphMatches
        .map(p => p.replace(/<[^>]*>/g, ' ').trim())
        .filter(p => p.length > 20);

      if (paragraphs.length > 2) {
        return paragraphs.join('\n\n');
      }
    }

    // Last resort: Extract text from body
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return this.cleanAndExtractText(bodyMatch[1]);
    }

    return '';
  }

  private extractPublishDate(htmlContent: string): Date | undefined {
    const datePatterns = [
      /datetime="([^"]+)"/i,
      /<time[^>]*datetime="([^"]+)"/i,
      /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
      /<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/gi
    ];

    for (const pattern of datePatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        try {
          const dateStr = match[1];
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (error) {
          // Continue to next pattern
        }
      }
    }

    return undefined;
  }

  private extractMainImage(htmlContent: string, articleUrl: string): string | undefined {
    // Try to find the main article image
    const imagePatterns = [
      /<img[^>]*src="([^"]*)"[^>]*alt="[^"]*article[^"]*"/i,
      /<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]*)"/i,
      /<img[^>]*class="[^"]*main[^"]*"[^>]*src="([^"]*)"/i,
      /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
    ];

    for (const pattern of imagePatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        const imageUrl = match[1];
        // Convert relative URLs to absolute
        if (imageUrl.startsWith('/')) {
          return new URL(imageUrl, articleUrl).href;
        }
        return imageUrl;
      }
    }

    return undefined;
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private cleanAndExtractText(html: string): string {
    // Remove script, style, and nav elements
    let cleaned = html.replace(/<(script|style|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Remove comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // Convert HTML to plain text while preserving structure
    cleaned = cleaned
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

    return cleaned;
  }


  public start(): void {
    if (this.cronJob && !(this.cronJob as any).running) {
      this.cronJob.start();
      console.log('🚀 Cron service started successfully');
    } else if ((this.cronJob as any)?.running) {
      console.log('ℹ️ Cron service is already running');
    } else {
      console.log('⚠️ Cannot start cron service - no cron job configured');
    }
  }

  public stop(): void {
    if (this.cronJob && (this.cronJob as any).running) {
      this.cronJob.stop();
      console.log('🛑 Cron service stopped successfully');
    } else {
      console.log('ℹ️ Cron service is not running');
    }
  }

  public getStatus(): { isRunning: boolean; isScheduled: boolean; lastRun?: string } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob ? (this.cronJob as any).running : false,
      lastRun: this.isRunning ? 'Currently running' : undefined
    };
  }

  // Method to manually trigger the cron job for testing
  public async triggerManually(): Promise<void> {
    console.log('⚡ Manually triggering cron job...');
    await this.executeCronJob();
  }
}

// Create a singleton instance
const cronService = new CronService();

export default cronService;
