import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { comparePasswords } from '../auth';
import { getUserFromBearer } from './shared';

export function registerAuthRoutes(app: Express) {
  // CORS for extension endpoints only (no credentials; allows Authorization + JSON)
  app.use('/api/ext', (req: any, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Extension login: returns a persistent API token
  app.post('/api/ext/login', async (req, res) => {
    try {
      const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
      const { username, password } = schema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const { token } = await storage.createApiToken(user.id);
      return res.json({ token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid login data', errors: error.errors });
      }
      console.error('Extension login failed:', error);
      return res.status(500).json({ message: 'Failed to login' });
    }
  });
}
