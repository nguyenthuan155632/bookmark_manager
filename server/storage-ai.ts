import { bookmarks, domainTags, type Bookmark } from '@shared/schema';
import { db, eq, and, logAI, OpenAI } from './storage-base';

export class AIStorage {
  constructor(private getUserPreferences: (userId: string) => Promise<any>) {}

  // Cache for domain tags to avoid repeated database queries
  private domainTagsCache: Map<string, string[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Get domain tags mapping from database
  private async getDomainTagsMap(): Promise<Record<string, string[]>> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.domainTagsCache.size > 0 && now < this.cacheExpiry) {
      return Object.fromEntries(this.domainTagsCache);
    }

    try {
      // Fetch all active domain tags from database
      const domainTagsData = await db
        .select({
          domain: domainTags.domain,
          tags: domainTags.tags,
        })
        .from(domainTags)
        .where(eq(domainTags.isActive, true));

      // Build the mapping
      const domainTagMap: Record<string, string[]> = {};
      this.domainTagsCache.clear();

      for (const row of domainTagsData) {
        const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
        domainTagMap[row.domain] = tags;
        this.domainTagsCache.set(row.domain, tags);
      }

      // Update cache expiry
      this.cacheExpiry = now + this.CACHE_DURATION;

      return domainTagMap;
    } catch (error) {
      console.error('Failed to fetch domain tags from database:', error);
      // Return empty mapping if database query fails
      return {};
    }
  }

  // Auto-tagging methods
  async updateBookmarkSuggestedTags(
    userId: string,
    bookmarkId: number,
    suggestedTags: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({
        suggestedTags: suggestedTags,
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();

    if (!updatedBookmark) {
      throw new Error('Bookmark not found or access denied');
    }

    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async acceptSuggestedTags(
    userId: string,
    bookmarkId: number,
    tagsToAccept: string[],
  ): Promise<Bookmark & { hasPasscode?: boolean }> {
    // First get the current bookmark to merge tags
    const [bookmark] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));

    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    // Merge current tags with accepted suggested tags, removing duplicates
    const currentTags = bookmark.tags || [];
    const newTags = Array.from(new Set([...currentTags, ...tagsToAccept]));

    // Remove accepted tags from suggested tags
    const remainingSuggestedTags = (bookmark.suggestedTags || []).filter(
      (tag) => !tagsToAccept.includes(tag),
    );

    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({
        tags: newTags,
        suggestedTags: remainingSuggestedTags,
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();

    if (!updatedBookmark) {
      throw new Error('Failed to update bookmark');
    }

    // Remove passcodeHash from response and add hasPasscode field
    const { passcodeHash, ...bookmarkResponse } = updatedBookmark;
    return {
      ...bookmarkResponse,
      hasPasscode: !!passcodeHash,
    } as Bookmark & { hasPasscode?: boolean };
  }

  async generateAutoTags(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string[]> {
    const tags: Set<string> = new Set();

    try {
      // Parse URL for domain-based tags
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();

      // Domain-based tag mapping
      // Get domain tags from database
      const domainTagMap = await this.getDomainTagsMap();

      // Add domain-specific tags
      for (const [domainPattern, domainTags] of Object.entries(domainTagMap)) {
        if (domain.includes(domainPattern.replace('www.', '')) || domain === domainPattern) {
          domainTags.forEach((tag) => tags.add(tag));
          break; // Only match the first domain pattern
        }
      }

      // Path-based analysis for additional context
      if (path.includes('/docs') || path.includes('/documentation')) {
        tags.add('documentation');
      }
      if (path.includes('/api')) {
        tags.add('api');
      }
      if (path.includes('/tutorial') || path.includes('/guide')) {
        tags.add('tutorial');
      }
      if (path.includes('/blog')) {
        tags.add('blog');
      }
      if (path.includes('/news')) {
        tags.add('news');
      }

      // Technology-specific detection from URL and content
      const techKeywords = {
        react: 'react',
        vue: 'vue',
        angular: 'angular',
        javascript: 'javascript',
        typescript: 'typescript',
        python: 'python',
        java: 'java',
        php: 'php',
        ruby: 'ruby',
        go: 'golang',
        rust: 'rust',
        swift: 'swift',
        kotlin: 'kotlin',
        docker: 'docker',
        kubernetes: 'kubernetes',
        aws: 'aws',
        azure: 'azure',
        gcp: 'gcp',
        mongodb: 'database',
        postgresql: 'database',
        mysql: 'database',
        redis: 'database',
        graphql: 'graphql',
        rest: 'api',
        node: 'nodejs',
        express: 'nodejs',
        next: 'nextjs',
        nuxt: 'nuxtjs',
        svelte: 'svelte',
        flutter: 'flutter',
        laravel: 'laravel',
        django: 'django',
        rails: 'rails',
      };

      const contentToAnalyze = `${url} ${name || ''} ${description || ''}`.toLowerCase();
      for (const [keyword, tag] of Object.entries(techKeywords)) {
        if (contentToAnalyze.includes(keyword)) {
          tags.add(tag);
        }
      }

      // Try to fetch metadata for additional context (with timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4001); // 5 second timeout

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0)',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();

          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const pageTitle = titleMatch?.[1]?.trim();

          // Extract meta description
          const descMatch = html.match(
            /<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i,
          );
          const metaDescription = descMatch?.[1]?.trim();

          // Extract meta keywords
          const keywordsMatch = html.match(
            /<meta[^>]*name=['"]keywords['"][^>]*content=['"]([^'"]+)['"][^>]*>/i,
          );
          const metaKeywords = keywordsMatch?.[1]?.trim();

          // Analyze extracted content for additional tags
          const metaContent =
            `${pageTitle || ''} ${metaDescription || ''} ${metaKeywords || ''}`.toLowerCase();

          // Content type detection
          if (
            metaContent.includes('tutorial') ||
            metaContent.includes('how to') ||
            metaContent.includes('guide')
          ) {
            tags.add('tutorial');
          }
          if (metaContent.includes('video') || metaContent.includes('watch')) {
            tags.add('video');
          }
          if (metaContent.includes('article') || metaContent.includes('blog')) {
            tags.add('article');
          }
          if (
            metaContent.includes('tool') ||
            metaContent.includes('app') ||
            metaContent.includes('software')
          ) {
            tags.add('tool');
          }
          if (metaContent.includes('news') || metaContent.includes('breaking')) {
            tags.add('news');
          }
          if (metaContent.includes('free') || metaContent.includes('open source')) {
            tags.add('free');
          }

          // Check for more tech keywords in metadata
          for (const [keyword, tag] of Object.entries(techKeywords)) {
            if (metaContent.includes(keyword)) {
              tags.add(tag);
            }
          }
        }
      } catch (fetchError) {
        // Silently fail metadata fetching - we'll use URL-based tags
        console.warn(
          `Failed to fetch metadata for ${url}:`,
          fetchError instanceof Error ? fetchError.message : 'Unknown error',
        );
      }

      // AI-assisted tags (OpenRouter only)
      const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
      let useAI = !!openRouterKey;
      // No global cooldown; retries/backoff handled per request
      // Respect per-user preference when available
      if (useAI && opts?.userId) {
        try {
          const prefs = await this.getUserPreferences(opts.userId);
          if (prefs) {
            // If AI tagging is disabled, or auto-tag suggestions are disabled, don't use AI here.
            if (prefs.aiTaggingEnabled === false) useAI = false;
            // Note: autoTagSuggestionsEnabled is primarily a client-side toggle for auto-run; we also honor it here.
            if (prefs.autoTagSuggestionsEnabled === false) useAI = false;
          }
        } catch (_e) {
          void _e;
        }
      }
      const maxTags = Math.max(1, Math.min(12, parseInt(process.env.OPENAI_TAGS_MAX || '8', 10)));
      const aiTimeout = Math.max(3000, parseInt(process.env.OPENAI_TIMEOUT_MS || '6000', 10));

      if (useAI) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), aiTimeout);
        try {
          // Tag generation via Chat Completions (OpenRouter)
          const siteReferer =
            process.env.OPENROUTER_SITE_URL?.trim() ||
            process.env.VITE_PUBLIC_BASE_URL?.trim() ||
            '';
          const siteTitle = process.env.OPENROUTER_SITE_TITLE?.trim() || 'Memorize Vault';
          const chatApiKey = process.env.OPENROUTER_API_KEY!.trim();
          const chatModel =
            process.env.OPENROUTER_TAG_MODEL?.trim() || 'deepseek/deepseek-chat-v3.1:free';

          const sys =
            'You extract concise, useful tags from a web resource. Return ONLY a JSON array of 3-8 short, lowercase tags (single words or hyphenated), no explanations.';
          const user = `URL: ${url}\nTitle: ${name || ''}\nDescription: ${description || ''}\nInstructions: derive up to ${maxTags} relevant tags.`;

          // Helper: chat completion with retries + Retry-After (OpenRouter)
          const callChat = async (retries = 5): Promise<any> => {
            let wait = 500; // ms
            for (let i = 0; i <= retries; i++) {
              if (controller.signal.aborted) throw new Error('aborted');
              try {
                logAI('OR request (tags)', { model: chatModel, referer: siteReferer });
                const client = new OpenAI({
                  apiKey: chatApiKey,
                  baseURL: 'https://openrouter.ai/api/v1',
                  defaultHeaders: {
                    'HTTP-Referer': siteReferer || 'http://localhost:4001',
                    'X-Title': siteTitle,
                  },
                });
                const completion = await client.chat.completions.create({
                  model: chatModel,
                  temperature: 0.2,
                  messages: [
                    { role: 'system', content: sys },
                    { role: 'user', content: user },
                  ],
                });
                logAI(
                  'OR response (tags)',
                  completion.choices?.[0]?.message?.content?.slice?.(0, 180),
                );
                return completion;
              } catch (e: any) {
                const status = e?.status || e?.response?.status;
                if (status === 429) {
                  const ra = Number(e?.response?.headers?.get?.('retry-after'));
                  if (!Number.isNaN(ra)) await new Promise((s) => setTimeout(s, ra * 1000));
                  else {
                    await new Promise((s) => setTimeout(s, wait));
                    wait = Math.min(wait * 2, 8000) + Math.floor(Math.random() * 250);
                  }
                  continue;
                }
                logAI('tags chat error', e?.message || e);
                throw e;
              }
            }
            throw new Error('Chat completion still rate-limited after retries');
          };

          try {
            const data: any = await callChat();
            const content = data?.choices?.[0]?.message?.content?.trim?.() || '';
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                for (const t of parsed) {
                  if (typeof t === 'string' && t.trim()) tags.add(t.trim().toLowerCase());
                }
              }
            } catch {
              // Try to salvage tags from brackets if present
              const match = content.match(/\[(.|\n|\r)*\]/);
              if (match) {
                try {
                  const arr = JSON.parse(match[0]);
                  if (Array.isArray(arr)) {
                    for (const t of arr) {
                      if (typeof t === 'string' && t.trim()) tags.add(t.trim().toLowerCase());
                    }
                  }
                } catch (_e) {
                  void _e;
                }
              }
            }
          } catch (chatErr) {
            // Rate limited or other chat error — skip AI for now
          }
        } catch (e) {
          // Timeout or API error — silently ignore and fall back
        } finally {
          clearTimeout(timeoutId);
        }
      }

      // Convert set to array and limit to configured number
      const tagArray = Array.from(tags);
      return tagArray.slice(0, maxTags);
    } catch (error) {
      console.error('Error generating auto tags:', error);
      // Return empty array if URL parsing or other errors occur
      return [];
    }
  }

  async generateAutoDescription(
    url: string,
    name?: string,
    description?: string,
    opts?: { userId?: string },
  ): Promise<string | undefined> {
    try {
      // If description already exists and is non-empty, prefer returning it
      if (description && description.trim()) return description.trim();

      // Provider and preference checks (OpenRouter only)
      const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
      let useAI = !!openRouterKey;
      if (useAI && opts?.userId) {
        try {
          const prefs = await this.getUserPreferences(opts.userId);
          if (prefs) {
            if (prefs.aiDescriptionEnabled === false) useAI = false;
          }
        } catch (_e) {
          void _e;
        }
      }

      const maxChars = Math.max(120, parseInt(process.env.AI_DESC_MAX_CHARS || '300', 10));
      const minChars = Math.max(
        120,
        Math.min(maxChars - 40, parseInt(process.env.AI_DESC_MIN_CHARS || '180', 10)),
      );
      const descFormat = (
        process.env.AI_DESC_FORMAT || (process.env.AI_DESC_MARKDOWN === '1' ? 'markdown' : 'text')
      ).toLowerCase();
      const isMarkdown = descFormat === 'markdown';
      const aiTimeout = Math.max(3000, parseInt(process.env.OPENAI_TIMEOUT_MS || '6000', 10));

      // Try to fetch basic metadata for a non-AI fallback and better prompts
      let metaTitle = '';
      let metaDesc = '';
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 memorize-vault' },
        });
        clearTimeout(t);
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch) metaTitle = titleMatch[1].trim();
          const md1 = html.match(
            /<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i,
          );
          const md2 = html.match(
            /<meta[^>]*property=['"][og:]*description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i,
          );
          metaDesc = (md1?.[1] || md2?.[1] || '').trim();
        }
      } catch (_e) {
        void _e;
      }

      // If we have a meta description and no AI, return it
      if (!useAI && metaDesc) return metaDesc;

      if (useAI) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), aiTimeout);
        try {
          // Chat completion via OpenRouter
          const siteReferer =
            process.env.OPENROUTER_SITE_URL?.trim() ||
            process.env.VITE_PUBLIC_BASE_URL?.trim() ||
            '';
          const siteTitle = process.env.OPENROUTER_SITE_TITLE?.trim() || 'Memorize Vault';
          const chatApiKey = openRouterKey!;
          const chatModel =
            process.env.OPENROUTER_DESC_MODEL?.trim() || 'deepseek/deepseek-chat-v3.1:free';

          const targetLen = Math.max(
            minChars + 100,
            Math.min(maxChars - 20, Math.floor((minChars + maxChars) / 2)),
          );
          const sys = isMarkdown
            ? `You are a clear, neutral technical writer. Produce a comprehensive Markdown overview of a web page.
- Target length: aim for about ${targetLen} characters (never exceed ${maxChars}).
- Format: Markdown with sections (e.g., ## Overview, ## Key Topics, ## Who It's For, ## Highlights, ## How to Use, ## Key Takeaways). Use short paragraphs and bullet lists where helpful.
- Tone: informative and neutral (no hype, no emojis, no exclamations).
- Content: focus on purpose, primary topics and capabilities, typical use cases, and audience. Prefer concrete nouns over vague phrasing.
- Grounding: base only on provided inputs (URL, Title, Hints/metadata). Do not invent specific features that are not implied.
- Language: match the language of Title/Hints if present.`
            : `You are a concise, neutral copywriter.
Write a clear, specific multi-sentence summary of a web page:
- Target length: ~${targetLen} characters; NEVER exceed ${maxChars}.
- Tone: informative and neutral (no hype, no emojis, no exclamations).
- Content: state purpose, key topics/features, and intended audience; prefer concrete nouns over vague phrasing.
- Style: do NOT repeat the title; avoid "this website/page"; use the subject directly.
- Output: plain text only.
- Grounding: base only on the provided inputs; do not invent details not implied by them.
- Language: write in the same language as the Title/Hints if present.`;
          const user = `Inputs\n- URL: ${url}\n- Title: ${name || metaTitle || ''}\n- Hints: ${description || metaDesc || ''}\nTask\nWrite ${isMarkdown ? 'a Markdown document' : 'a description'} that fits the constraints above. If information is sparse, keep it accurate and grounded in the domain/path without fabricating specifics. Length between ${minChars} and ${maxChars} characters.`;

          const callChat = async (retries = 5) => {
            let wait = 500;
            for (let i = 0; i <= retries; i++) {
              if (controller.signal.aborted) throw new Error('aborted');
              try {
                const client = new OpenAI({
                  apiKey: chatApiKey,
                  baseURL: 'https://openrouter.ai/api/v1',
                  defaultHeaders: {
                    'HTTP-Referer': siteReferer || 'http://localhost:4001',
                    'X-Title': siteTitle,
                  },
                });
                const completion = await client.chat.completions.create({
                  model: chatModel,
                  temperature: 0.3,
                  messages: [
                    { role: 'system', content: sys },
                    { role: 'user', content: user },
                  ],
                });
                logAI('OR response (desc)', completion.choices[0].message);
                return completion;
              } catch (e: any) {
                const status = e?.status || e?.response?.status;
                if (status === 429) {
                  logAI('OR response (desc)', e);
                  const ra = Number(e?.response?.headers?.get?.('retry-after'));
                  if (!Number.isNaN(ra)) await new Promise((s) => setTimeout(s, ra * 1000));
                  else {
                    await new Promise((s) => setTimeout(s, wait));
                    wait = Math.min(wait * 2, 8000) + Math.floor(Math.random() * 250);
                  }
                } else {
                  logAI('OR response (desc)', e);
                  throw e;
                }
              }
            }
            throw new Error('Chat completion still rate-limited after retries');
          };

          try {
            const data: any = await callChat();
            let content = data?.choices?.[0]?.message?.content?.trim?.() || '';
            logAI('OR response (desc)', content);
            // Sanitize and trim to character budget
            content = content
              .replace(/^"|"$/g, '')
              .replace(/^'+|'+$/g, '')
              .trim();
            if (!content && metaDesc) return metaDesc;
            // If too short, retry once with explicit expansion prompt
            if (content.length < minChars) {
              const client = new OpenAI({
                apiKey: chatApiKey,
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                  'HTTP-Referer': siteReferer || 'http://localhost:4001',
                  'X-Title': siteTitle,
                },
              });
              const data2: any = await client.chat.completions.create({
                model: chatModel,
                temperature: 0.3,
                messages: [
                  { role: 'system', content: sys },
                  { role: 'user', content: user },
                  {
                    role: 'user',
                    content: `Rewrite and expand the previous draft to approximately ${Math.min(maxChars, Math.max(minChars + 200, targetLen))} characters, adding concrete purpose and key topics. Keep the same language and do not fabricate details. Return ${isMarkdown ? 'Markdown' : 'plain text'} only.`,
                  },
                ],
              });
              logAI('OR response (desc)', data2?.choices?.[0]?.message?.content?.slice?.(0, 180));
              content = data2?.choices?.[0]?.message?.content?.trim?.() || content;
              content = content
                .replace(/^"|"$/g, '')
                .replace(/^'+|'+$/g, '')
                .trim();
            }
            return content;
          } catch {
            // skip cooldown; rely on per-call retry/backoff only
            return metaDesc ? metaDesc : undefined;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }

      // Final fallback
      if (metaDesc) {
        if (isMarkdown) {
          const titleText = name || metaTitle || 'Overview';
          const body = metaDesc.slice(
            0,
            Math.max(0, maxChars - Math.min(titleText.length + 6, 60)),
          );
          return `# ${titleText}\n\n## Overview\n${body}`;
        }
        return metaDesc;
      }
      const u = new URL(url);
      const base = `${u.hostname.replace(/^www\./, '')}${u.pathname && u.pathname !== '/' ? u.pathname : ''}`;
      if (isMarkdown) {
        const titleText = name || base;
        const body = `This page appears to relate to ${base}.`;
        return `# ${titleText}\n\n## Overview\n${body}`!;
      }
      return `A link to ${name || base}`;
    } catch (e) {
      console.error('Error generating auto description:', e);
      return undefined;
    }
  }
}
