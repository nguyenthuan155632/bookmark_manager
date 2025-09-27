import { aiFeedArticles } from '@shared/schema.js';
import { eq } from 'drizzle-orm';
import type { Express } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { db } from '../db';

export function registerAIRewriteRoutes(app: Express) {
  // AI content rewriting endpoint
  app.post('/api/ai-rewrite', requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        content: z.string().min(1, 'Content is required'),
        instruction: z.string().optional(),
        articleId: z.number().optional(), // Optional article ID for caching
      });

      const { content, instruction, articleId } = schema.parse(req.body);

      // If articleId is provided, check if we already have cached AI-rewritten content
      let cachedContent = null;
      if (articleId) {
        const cachedArticle = await db
          .select({ formattedContent: aiFeedArticles.formattedContent })
          .from(aiFeedArticles)
          .where(eq(aiFeedArticles.id, articleId));

        if (cachedArticle.length > 0 && cachedArticle[0].formattedContent) {
          cachedContent = cachedArticle[0].formattedContent;
          console.log(`🎯 Serving cached AI-rewritten content for article ${articleId}`);
          return res.json({
            rewrittenContent: cachedContent,
            fromCache: true,
            model: 'cached',
          });
        }
      }

      // Get OpenRouter API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'AI service not configured' });
      }

      // Create the AI prompt
      const systemPrompt = `You are an expert content formatter and technical writer. Your job is to rewrite content into beautiful, well-structured markdown format.

Follow these guidelines:
- Use clear headings with relevant emojis that match the content theme
- Create logical sections based on the content's natural structure
- Use bullet points for lists, features, or multiple items
- Highlight important terms like version numbers, names, and key concepts using **bold** formatting
- Ensure proper spacing and readability
- Organize content into logical sections that flow naturally
- Use markdown formatting effectively (bold, lists, etc.) for better readability
- Keep all important information but make it much more readable and scannable
- Remove redundancy and wordiness while preserving key information
- Use clear, concise language
- Be flexible with section headings - adapt to the content type and topic

Examples of flexible section headings based on content:
- 📋 Overview, 📰 Article Summary, 🎯 Key Points
- 🚀 New Features, 🔧 Technical Updates, 💡 Innovations
- 🔒 Security Updates, 🛡️ Protection Features, ⚠️ Vulnerability Fixes
- 🌐 Language Support, 🏗️ Framework Updates, 📦 Library Changes
- 🎨 Design Improvements, 📱 UI Updates, 🎮 User Experience
- 📊 Performance, ⚡ Speed Improvements, 🔧 Optimizations
- 🔄 Process Changes, 📝 Documentation, 🎓 Learning Resources

Adapt your approach based on the specific content you're processing.`;

      const userPrompt = instruction || `Rewrite this content into beautiful, well-structured markdown format:`;

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:4001',
          'X-Title': 'Memorize Vault AI Content Rewriter',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_DESC_MODEL || 'deepseek/deepseek-chat-v3.1:free',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `${userPrompt}\n\n${content}`,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', errorText);
        return res.status(500).json({ message: 'Failed to rewrite content with AI' });
      }

      const result = await response.json();
      const rewrittenContent = result.choices[0]?.message?.content || content;

      // Cache the rewritten content in database if articleId is provided
      if (articleId) {
        try {
          await db
            .update(aiFeedArticles)
            .set({ formattedContent: rewrittenContent.trim() })
            .where(eq(aiFeedArticles.id, articleId));
          console.log(`💾 Cached AI-rewritten content for article ${articleId}`);
        } catch (cacheError) {
          console.error('Failed to cache AI-rewritten content:', cacheError);
          // Don't fail the request if caching fails
        }
      }

      res.json({
        rewrittenContent: rewrittenContent.trim(),
        fromCache: false,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      console.error('AI rewriting error:', error);
      res.status(500).json({ message: 'Failed to rewrite content' });
    }
  });

  // Public AI content rewriting endpoint (for shared articles)
  app.post('/api/public-ai-rewrite', async (req, res) => {
    try {
      const schema = z.object({
        content: z.string().min(1, 'Content is required'),
        instruction: z.string().optional(),
        articleId: z.number().optional(), // Optional article ID for caching
      });

      const { content, instruction, articleId } = schema.parse(req.body);

      // If articleId is provided, check if we already have cached AI-rewritten content
      let cachedContent = null;
      if (articleId) {
        const cachedArticle = await db
          .select({ formattedContent: aiFeedArticles.formattedContent })
          .from(aiFeedArticles)
          .where(eq(aiFeedArticles.id, articleId));

        if (cachedArticle.length > 0 && cachedArticle[0].formattedContent) {
          cachedContent = cachedArticle[0].formattedContent;
          console.log(`🎯 Serving cached AI-rewritten content for article ${articleId}`);
          return res.json({
            rewrittenContent: cachedContent,
            fromCache: true,
            model: 'cached',
          });
        }
      }

      // Get OpenRouter API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'AI service not configured' });
      }

      // Create the AI prompt (same as above)
      const systemPrompt = `You are an expert content formatter and technical writer. Your job is to rewrite content into beautiful, well-structured markdown format.

Follow these guidelines:
- Use clear headings with relevant emojis that match the content theme
- Create logical sections based on the content's natural structure
- Use bullet points for lists, features, or multiple items
- Highlight important terms like version numbers, names, and key concepts using **bold** formatting
- Ensure proper spacing and readability
- Organize content into logical sections that flow naturally
- Use markdown formatting effectively (bold, lists, etc.) for better readability
- Keep all important information but make it much more readable and scannable
- Remove redundancy and wordiness while preserving key information
- Use clear, concise language
- Be flexible with section headings - adapt to the content type and topic

Examples of flexible section headings based on content:
- 📋 Overview, 📰 Article Summary, 🎯 Key Points
- 🚀 New Features, 🔧 Technical Updates, 💡 Innovations
- 🔒 Security Updates, 🛡️ Protection Features, ⚠️ Vulnerability Fixes
- 🌐 Language Support, 🏗️ Framework Updates, 📦 Library Changes
- 🎨 Design Improvements, 📱 UI Updates, 🎮 User Experience
- 📊 Performance, ⚡ Speed Improvements, 🔧 Optimizations
- 🔄 Process Changes, 📝 Documentation, 🎓 Learning Resources

Adapt your approach based on the specific content you're processing.`;

      const userPrompt = instruction || `Rewrite this content into beautiful, well-structured markdown format:`;

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:4001',
          'X-Title': 'Memorize Vault AI Content Rewriter',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_DESC_MODEL || 'deepseek/deepseek-chat-v3.1:free',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `${userPrompt}\n\n${content}`,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', errorText);
        return res.status(500).json({ message: 'Failed to rewrite content with AI' });
      }

      const result = await response.json();
      const rewrittenContent = result.choices[0]?.message?.content || content;

      // Cache the rewritten content in database if articleId is provided
      if (articleId) {
        try {
          await db
            .update(aiFeedArticles)
            .set({ formattedContent: rewrittenContent.trim() })
            .where(eq(aiFeedArticles.id, articleId));
          console.log(`💾 Cached AI-rewritten content for article ${articleId}`);
        } catch (cacheError) {
          console.error('Failed to cache AI-rewritten content:', cacheError);
          // Don't fail the request if caching fails
        }
      }

      res.json({
        rewrittenContent: rewrittenContent.trim(),
        fromCache: false,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      console.error('AI rewriting error:', error);
      res.status(500).json({ message: 'Failed to rewrite content' });
    }
  });
}