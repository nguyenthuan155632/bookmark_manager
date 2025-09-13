import 'dotenv/config';
import { storage } from '../storage';
import { hashPassword } from '../auth';
import type { InsertBookmark, InsertCategory, User } from '@shared/schema';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

const sites = [
  { domain: 'github.com', names: ['Repo', 'Gist', 'Action', 'Issue'] },
  { domain: 'stackoverflow.com', names: ['Question', 'Answer', 'Snippet'] },
  { domain: 'medium.com', names: ['Article', 'Guide', 'Story'] },
  { domain: 'youtube.com', names: ['Video', 'Talk', 'Tutorial'] },
  { domain: 'dev.to', names: ['Post', 'Tip', 'Lesson'] },
  { domain: 'notion.so', names: ['Doc', 'Notes', 'Template'] },
  { domain: 'x.com', names: ['Thread', 'Tweet', 'Post'] },
  { domain: 'reddit.com', names: ['Discussion', 'Thread', 'Post'] },
  { domain: 'vercel.com', names: ['Docs', 'Guide', 'Integration'] },
  { domain: 'openai.com', names: ['Blog', 'Docs', 'Example'] },
];

const tagPool = [
  'javascript',
  'typescript',
  'node',
  'react',
  'design',
  'css',
  'backend',
  'frontend',
  'database',
  'testing',
  'devops',
  'security',
  'ai',
  'ml',
  'productivity',
  'tools',
];

function getCreds(): { username: string; password: string } {
  // Priority: CLI flags -> env -> defaults
  const argv = process.argv.slice(2);
  let username = process.env.SEED_USERNAME || 'vensera';
  let password = process.env.SEED_PASSWORD || '8789';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user' || a === '-u') {
      username = argv[i + 1];
      i++;
    } else if (a === '--pass' || a === '-p') {
      password = argv[i + 1];
      i++;
    }
  }

  if (!username || !password) {
    throw new Error('Missing username/password for seed');
  }
  return { username, password };
}

async function ensureUser(username: string, password: string): Promise<User> {
  const existing = await storage.getUserByUsername(username);
  if (existing) return existing;
  const hashed = await hashPassword(password);
  return storage.createUser({ username, password: hashed });
}

async function main() {
  const { username, password } = getCreds();
  const user = await ensureUser(username, password);
  console.log(`Using user: ${user.username} (${user.id})`);

  // Create 10 folders
  const categories: { id: number; name: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = `Folder ${i}`;
    const created = await storage.createCategory(user.id, { name } as InsertCategory);
    categories.push({ id: created.id, name: created.name });
  }
  console.log(`Created ${categories.length} folders`);

  // Create 100 bookmarks
  const total = 100;
  for (let i = 1; i <= total; i++) {
    const site = pick(sites);
    const name = `${pick(site.names)} ${i}`;
    const url = `https://${site.domain}/${randInt(1000, 999999)}`;
    const desc = `Sample description for ${name} on ${site.domain}.`;
    const tags = sample(tagPool, randInt(0, 4));
    const categoryChance = Math.random();
    const category = categoryChance < 0.8 ? pick(categories) : null; // ~80% categorized

    const bookmark: InsertBookmark = {
      name,
      description: desc,
      url,
      tags,
      isFavorite: Math.random() < 0.15, // ~15% favorites
      categoryId: category ? category.id : null,
      isShared: Math.random() < 0.1, // ~10% shared
      passcode: null, // not protected by default
    } as InsertBookmark;

    await storage.createBookmark(user.id, bookmark);
  }
  console.log(`Created ${total} bookmarks`);

  console.log(
    `Seeding complete. You can log in with username "${user.username}" and your provided password.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
