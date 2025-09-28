import {
  aiFeedArticles,
  type AiCrawlerSettings,
  type AiFeedSource,
  type InsertAiFeedArticle
} from '@shared/schema.js';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '../db';
import { pushNotificationService } from './push-notification-service.js';

export class AiFeedProcessor {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.VITE_PUBLIC_BASE_URL || 'http://localhost:4001',
        'X-Title': 'Memorize Vault',
      },
    });
  }

  async processFeedContent(
    feed: AiFeedSource,
    setting: AiCrawlerSettings & { defaultAiLanguage?: string },
    articles: Array<{
      title: string;
      content: string;
      url: string;
      publishedAt?: Date;
      imageUrl?: string;
    }>
  ): Promise<void> {
    console.log(`🤖 Processing ${articles.length} articles from feed: ${feed.url}`);
    const startTime = Date.now();

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const articleStartTime = Date.now();

      console.log(`📝 [${i + 1}/${articles.length}] Starting article: ${article.title.substring(0, 50)}...`);
      console.log(`📊 Content length: ${article.content.length} characters`);

      try {
        // Check for duplicates first
        const isDuplicate = await this.checkDuplicateArticle(article.url, feed.id);
        if (isDuplicate) {
          console.log(`⏭️  Skipping duplicate article: ${article.title.substring(0, 50)}...`);
          continue;
        }

        const processedArticle = await this.processSingleArticle(
          article,
          feed,
          setting
        );

        // Save to database
        const inserted = await db
          .insert(aiFeedArticles)
          .values(processedArticle)
          .returning();

        if (inserted.length > 0) {
          const createdArticle = inserted[0];
          const notificationResult = await pushNotificationService.sendArticleNotification(
            feed.userId,
            createdArticle,
          );

          if (notificationResult?.sent) {
            await db
              .update(aiFeedArticles)
              .set({ notificationSent: true })
              .where(eq(aiFeedArticles.id, createdArticle.id));
          }
        }

        const articleEndTime = Date.now();
        const articleDuration = articleEndTime - articleStartTime;
        console.log(`✅ Processed article in ${articleDuration}ms: ${article.title.substring(0, 50)}...`);
        console.log(`📈 Processed content length: ${processedArticle.formattedContent?.length || 0} characters`);
      } catch (error) {
        const articleEndTime = Date.now();
        const articleDuration = articleEndTime - articleStartTime;
        console.error(`❌ Error processing article ${article.title.substring(0, 50)}... after ${articleDuration}ms:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🏁 Completed processing ${articles.length} articles in ${totalTime}ms (average: ${Math.round(totalTime / articles.length)}ms per article)`);
  }

  private async processSingleArticle(
    article: {
      title: string;
      content: string;
      url: string;
      publishedAt?: Date;
      imageUrl?: string;
    },
    feed: AiFeedSource,
    setting: AiCrawlerSettings & { defaultAiLanguage?: string }
  ): Promise<InsertAiFeedArticle> {
    console.log(`🔧 Starting AI processing for article: ${article.title.substring(0, 50)}...`);
    console.log(`🌐 Target language: ${setting.defaultAiLanguage || 'auto'}`);

    const aiStartTime = Date.now();

    // Use the HTML content extracted by the crawler
    console.log(`🌐 Using HTML content from: ${article.url}`);
    const fullContent = article.content;
    console.log(`📊 HTML content length: ${fullContent.length} characters`);

    // Process content with AI
    const {
      formattedContent,
      summary,
      notificationContent,
      translatedTitle
    } = await this.formatContentWithAI(
      fullContent,
      article.title,
      setting.defaultAiLanguage
    );

    const aiEndTime = Date.now();
    const aiDuration = aiEndTime - aiStartTime;

    console.log(`🤖 AI processing completed in ${aiDuration}ms`);
    console.log(`📊 AI Results:`);
    console.log(`  - HTML content: ${fullContent.length} chars`);
    console.log(`  - Formatted content: ${formattedContent.length} chars`);
    console.log(`  - Summary: ${summary.length} chars`);
    console.log(`  - Notification: ${notificationContent.length} chars`);
    console.log(`  - AI title: ${translatedTitle}`);
    console.log(`  - Length ratio: ${Math.round((formattedContent.length / fullContent.length) * 100)}%`);

    return {
      sourceId: feed.id,
      title: translatedTitle || article.title,
      originalContent: fullContent, // Store the full HTML content
      formattedContent,
      summary,
      url: article.url,
      imageUrl: article.imageUrl,
      notificationContent,
      publishedAt: article.publishedAt,
    };
  }

  private async formatContentWithAI(
    content: string,
    title: string,
    targetLanguage: string = 'auto',
    retryCount: number = 0
  ): Promise<{
    formattedContent: string;
    summary: string;
    notificationContent: string;
    translatedTitle: string;
  }> {
    const model = process.env.OPENROUTER_DESC_MODEL || 'deepseek/deepseek-chat-v3.1:free';
    console.log(`🎯 Using AI model: ${model}`);
    console.log(`📝 Prompt length: ${content.length} characters`);

    // AI prompt for content formatting and translation
    const systemPrompt = `You are an expert content formatter, translator, and technical writer. Your job is to rewrite content into beautiful, well-structured markdown format that is highly readable for humans.

CRITICAL FORMATTING REQUIREMENTS:
- Use clear headings with relevant emojis that match the content theme
- Create logical sections based on the content's natural structure
- Use bullet points for lists, features, or multiple items
- Highlight important terms like version numbers, names, and key concepts using **bold** formatting
- Ensure proper spacing with blank lines between sections
- Use markdown formatting effectively (bold, lists, etc.) for better readability
- Keep all important information but make it much more readable and scannable
- Remove redundancy and wordiness while preserving key information
- Use clear, concise language
- Be flexible with section headings - adapt to the content type and topic
- Add proper line breaks and paragraph spacing for human readability

Examples of flexible section headings based on content:
- 📋 Overview, 📰 Article Summary, 🎯 Key Points
- 🚀 New Features, 🔧 Technical Updates, 💡 Innovations
- 🔒 Security Updates, 🛡️ Protection Features, ⚠️ Vulnerability Fixes
- 🌐 Language Support, 🏗️ Framework Updates, 📦 Library Changes
- 🎨 Design Improvements, 📱 UI Updates, 🎮 User Experience
- 📊 Performance, ⚡ Speed Improvements, 🔧 Optimizations
- 🔄 Process Changes, 📝 Documentation, 🎓 Learning Resources

HUMAN READABILITY REQUIREMENTS:
- Content MUST be properly formatted with markdown headings, lists, and emphasis
- Use proper spacing (blank lines) between sections and paragraphs
- Break down long paragraphs into smaller, readable chunks
- Use bullet points for features and lists
- Ensure the output is NOT just a wall of text
- Make it scannable and easy to read for humans

${targetLanguage !== 'auto' ? `IMPORTANT: Translate the entire content to ${targetLanguage}. All output including formatted content, summary, notification, and translatedTitle must be in ${targetLanguage}.` : 'IMPORTANT: Detect and maintain the original language of the content. Do NOT translate or change the language. Keep all content in its original language whether it is English, Vietnamese, Chinese, Spanish, or any other language. translatedTitle must match the original title when no translation is requested.'}

CONTENT PROCESSING RULES:
1. **formattedContent**: MUST be beautifully formatted markdown with proper structure, headings, lists, and spacing
2. **formattedContent**: Should be well-organized and readable, NOT a wall of text
3. **formattedContent**: Preserve all important information but present it in a structured, readable format
4. Remove unnecessary elements like ads, navigation, or social media widgets
5. Add proper markdown formatting throughout (headings, bold text, lists, etc.)
6. **translatedTitle**: Provide a concise article title in the requested language (or original when target language is auto). Keep it under 120 characters.`;

    const formatPrompt = `Original title: ${title}

Original content to process:
${content}

Please provide:
1. **formattedContent**: FULL content reformatted in beautiful, readable markdown with proper headings, lists, spacing, and structure. Make it human-readable with proper formatting!
2. **summary**: A separate 2-3 paragraph summary capturing the main points
3. **notificationContent**: A short notification message (under 200 characters) for push notifications
4. **translatedTitle**: Title in the requested language (or the original title if no translation is requested). Keep it under 120 characters.

CRITICAL: The formattedContent MUST be properly structured markdown with:
- Clear headings with relevant emojis
- Bullet points for lists and features
- Bold formatting for important terms
- Proper spacing between sections
- Break up long paragraphs into readable chunks
- Make it visually appealing and easy to read

IMPORTANT: Respond with ONLY the JSON object below. Do not include any markdown formatting, code blocks, or explanatory text. Just return the raw JSON:

{
  "formattedContent": "BEAUTIFULLY FORMATTED MARKDOWN CONTENT HERE WITH PROPER HEADINGS, LISTS, AND SPACING",
  "summary": "2-3 paragraph summary here",
  "notificationContent": "Short notification under 200 chars",
  "translatedTitle": "Translated title under 120 chars"
}`;

    try {
      console.log(`🚀 Sending request to AI API...`);
      const apiStartTime = Date.now();

      let completion;
      try {
        completion = await Promise.race([
          this.openai.chat.completions.create({
            model,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: formatPrompt,
              },
            ],
            temperature: 0.3,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI API call timeout after 300 seconds')), 300000)
          )
        ]) as any;
      } catch (apiError) {
        console.error('❌ AI API call failed:', apiError);
        throw new Error(`AI API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }

      const apiEndTime = Date.now();
      const apiDuration = apiEndTime - apiStartTime;
      console.log(`📡 AI API response received in ${apiDuration}ms`);

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      console.log(`📄 AI response length: ${response.length} characters`);

      // Check if response looks like truncated JSON
      const trimmedResponse = response.trim();
      let cleanedResponse = trimmedResponse;

      if (!trimmedResponse.endsWith('}') || !trimmedResponse.startsWith('{')) {
        console.warn('⚠️ AI response appears to be malformed or truncated');
        console.log('🔍 Response starts with:', trimmedResponse.substring(0, 50));
        console.log('🔍 Response ends with:', trimmedResponse.substring(trimmedResponse.length - 50));

        // Try to recover truncated JSON by finding the last complete structure
        const recoveredJson = this.recoverTruncatedJson(trimmedResponse);
        if (recoveredJson) {
          console.log('✅ Successfully recovered truncated JSON');
          cleanedResponse = recoveredJson;
        } else {
          console.log('⚠️ Could not recover truncated JSON, will attempt fallback parsing');
          // Don't throw error here, let the JSON parsing section handle fallback
        }
      }

      // Clean the response - remove markdown code blocks if present

      // Remove JSON markdown code block formatting if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      // Parse JSON response
      let result;
      try {
        console.log(`🔍 Parsing JSON response...`);
        result = JSON.parse(cleanedResponse);
        console.log(`✅ JSON parsing successful`);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:');
        console.error('❌ Response preview:', cleanedResponse.substring(0, 500) + (cleanedResponse.length > 500 ? '...' : ''));
        console.error('❌ Parse error:', parseError);

        // Try to fix common JSON issues
        let fixedResponse = cleanedResponse;

        // Remove any leading/trailing non-JSON content
        const jsonStart = fixedResponse.indexOf('{');
        const jsonEnd = fixedResponse.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          fixedResponse = fixedResponse.substring(jsonStart, jsonEnd + 1);
          console.log(`🔄 Attempting to fix JSON by extracting from ${jsonStart} to ${jsonEnd}`);

          try {
            result = JSON.parse(fixedResponse);
            console.log(`✅ JSON parsing successful after fixing`);
          } catch (secondParseError) {
            console.error('❌ JSON parsing still failed after fixing:', secondParseError);

            // Last resort: create a minimal valid response
            console.log('🔄 Creating minimal fallback response due to JSON parsing failure');
            result = {
              formattedContent: this.cleanHtml(content),
              summary: this.generateFallbackSummary(content, title),
              notificationContent: this.generateFallbackNotification(title),
              translatedTitle: title
            };
            console.log(`✅ Created fallback response successfully`);
          }
        } else {
          console.log('🔄 No valid JSON structure found, creating fallback response');
          result = {
            formattedContent: this.cleanHtml(content),
            summary: this.generateFallbackSummary(content, title),
            notificationContent: this.generateFallbackNotification(title),
            translatedTitle: title
          };
          console.log(`✅ Created fallback response successfully`);
        }
      }

      // Validate formatted content quality
      let finalFormattedContent = result.formattedContent || content;
      const originalLength = content.length;
      const formattedLength = finalFormattedContent.length;

      console.log(`📏 Content length validation:`);
      console.log(`  - Original: ${originalLength} chars`);
      console.log(`  - AI formatted: ${formattedLength} chars`);
      console.log(`  - Ratio: ${Math.round((formattedLength / originalLength) * 100)}%`);

      // Accept AI formatted content if it has reasonable length and proper structure
      // AI formatting should make content more readable and concise, not necessarily maintain original length
      if (formattedLength < 200) {
        console.warn(`⚠️ AI formatted content too short (${formattedLength} chars), using fallback`);
        finalFormattedContent = this.cleanHtml(content);
        console.log(`🔄 Fallback content length: ${finalFormattedContent.length} chars`);
      } else if (formattedLength < originalLength * 0.1) {
        console.warn(`⚠️ AI formatted content extremely short (${formattedLength} vs ${originalLength} chars), using fallback`);
        finalFormattedContent = this.cleanHtml(content);
        console.log(`🔄 Fallback content length: ${finalFormattedContent.length} chars`);
      } else {
        console.log(`✅ AI formatted content accepted`);
      }

      // Ensure all required fields exist
      const formattedContent = finalFormattedContent;
      const summary = result.summary || this.generateFallbackSummary(content, title);
      const notificationContent = result.notificationContent || this.generateFallbackNotification(title);
      const translatedTitleRaw =
        typeof result.translatedTitle === 'string' ? result.translatedTitle.trim() : '';
      const translatedTitle = translatedTitleRaw || (targetLanguage === 'auto' ? title : title);

      console.log(`📦 Final result validation:`);
      console.log(`  - formattedContent: ${formattedContent.length} chars`);
      console.log(`  - summary: ${summary.length} chars`);
      console.log(`  - notificationContent: ${notificationContent.length} chars`);
      console.log(`  - translatedTitle: ${translatedTitle}`);

      return {
        formattedContent,
        summary,
        notificationContent,
        translatedTitle,
      };
    } catch (error) {
      console.error('❌ Error formatting content with AI:', error);

      // Retry logic for transient failures
      if (retryCount < 2) {
        const retryDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s delays
        console.log(`🔄 Retrying AI formatting in ${retryDelay}ms (attempt ${retryCount + 1}/3)...`);

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.formatContentWithAI(content, title, targetLanguage, retryCount + 1);
      }

      // Final fallback to basic processing
      console.log(`🔄 Using fallback processing after ${retryCount + 1} failed attempts...`);
      const fallbackContent = this.cleanHtml(content);
      console.log(`📊 Fallback content length: ${fallbackContent.length} chars`);

      return {
        formattedContent: fallbackContent,
        summary: this.generateFallbackSummary(content, title),
        notificationContent: this.generateFallbackNotification(title),
        translatedTitle: title,
      };
    }
  }

  private cleanHtml(html: string): string {
    // Basic HTML cleaning - remove tags but preserve content
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generateFallbackSummary(content: string, _title: string): string {
    // Simple fallback summary - first few sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '.' : '');
  }

  private generateFallbackNotification(title: string): string {
    // Simple fallback notification
    return `New article: ${title.substring(0, 150)}${title.length > 150 ? '...' : ''}`;
  }

  private tryExtractionStrategies(html: string): string {
    // Strategy 1: Semantic HTML5 tags (highest priority)
    const semanticPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];

    for (const pattern of semanticPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && this.isExtractedContentQualityGood(match[1])) {
        console.log(`✅ Found content using semantic pattern: ${pattern}`);
        return match[1];
      }
    }

    // Strategy 2: Content-specific class and ID patterns (expanded list)
    const contentPatterns = [
      // Class patterns
      /<div[^>]*class="[^"]*(?:article-body|article-content|content-body|post-content|story-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,

      // ID patterns
      /<div[^>]*id="[^"]*(?:article-body|article-content|content-body|post-content|story-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i,

      // Section patterns
      /<section[^>]*class="[^"]*(?:content|article|post|story)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      /<section[^>]*id="[^"]*(?:content|article|post|story)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    ];

    for (const pattern of contentPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && this.isExtractedContentQualityGood(match[1])) {
        console.log(`✅ Found content using pattern: ${pattern}`);
        return match[1];
      }
    }

    return '';
  }

  private extractByParagraphs(html: string): string {
    // Extract all paragraphs and long text blocks
    const paragraphMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (!paragraphMatches) return '';

    const paragraphs = paragraphMatches
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 50) // Only substantial paragraphs
      .filter(p => !p.toLowerCase().includes('advertisement'))
      .filter(p => !p.toLowerCase().includes('subscribe'))
      .filter(p => !p.toLowerCase().includes('newsletter'));

    if (paragraphs.length >= 3) {
      console.log(`✅ Extracted ${paragraphs.length} substantial paragraphs`);
      return paragraphs.join('\n\n');
    }

    return '';
  }

  private extractWithMinimalFiltering(html: string): string {
    // Remove only the most obvious non-content elements
    let minimalContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    return minimalContent;
  }

  private isExtractedContentQualityGood(content: string): boolean {
    if (!content || content.length < 300) {
      return false;
    }

    // Remove HTML tags for content analysis
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Check minimum length after HTML removal
    if (textContent.length < 200) {
      return false;
    }

    // Check for meaningful word count
    const words = textContent.split(/\s+/).filter(word => word.length > 2);
    if (words.length < 30) {
      return false;
    }

    return true;
  }

  async checkDuplicateArticle(url: string, _sourceId: number): Promise<boolean> {
    const existing = await db
      .select()
      .from(aiFeedArticles)
      .where(eq(aiFeedArticles.url, url))
      .limit(1);

    return existing.length > 0;
  }

  async markNotificationSent(articleId: number): Promise<void> {
    await db
      .update(aiFeedArticles)
      .set({ notificationSent: true })
      .where(eq(aiFeedArticles.id, articleId));
  }

  /**
   * Attempt to recover truncated JSON by finding the last complete structure
   */
  private recoverTruncatedJson(jsonString: string): string | null {
    try {
      // Try to find where the JSON structure is complete
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let lastCompleteIndex = -1;

      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastCompleteIndex = i;
            }
          }
        }
      }

      if (lastCompleteIndex > 0) {
        const recovered = jsonString.substring(0, lastCompleteIndex + 1);
        console.log(`🔧 Recovered JSON from ${jsonString.length} to ${recovered.length} characters`);

        // Validate the recovered JSON
        JSON.parse(recovered);
        return recovered;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to recover truncated JSON:', error);
      return null;
    }
  }
}

// Export singleton instance
export const aiFeedProcessor = new AiFeedProcessor();
