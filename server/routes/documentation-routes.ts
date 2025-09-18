import type { Express } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export function registerDocumentationRoutes(app: Express) {
  // Serve documentation content
  app.get('/api/documentation', async (req, res) => {
    try {
      const docsPath = join(process.cwd(), 'docs');
      const content: Record<string, string> = {};

      // Read all markdown files from the docs directory
      const files = readdirSync(docsPath).filter((file) => file.endsWith('.md'));

      for (const file of files) {
        const filePath = join(docsPath, file);
        const fileContent = readFileSync(filePath, 'utf-8');
        const key = file.replace('.md', '');
        content[key] = fileContent;
      }

      res.json(content);
    } catch (error) {
      console.error('Error loading documentation:', error);
      res.status(500).json({ message: 'Failed to load documentation' });
    }
  });
}
