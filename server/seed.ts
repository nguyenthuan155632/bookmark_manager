import { db } from './db';
import { bookmarks, categories } from '@shared/schema';

// Vensera user ID for seeding
const VENSERA_USER_ID = 'c73053f2-ec15-438c-8af0-3bf8c7954454';

async function seed() {
  console.log('Starting database seed...');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await db.delete(bookmarks);
    await db.delete(categories);

    // Seed categories
    console.log('Creating categories...');
    const createdCategories = await db.insert(categories).values([
      { name: 'Development', parentId: null, userId: VENSERA_USER_ID },
      { name: 'Design', parentId: null, userId: VENSERA_USER_ID },
      { name: 'JavaScript', parentId: null, userId: VENSERA_USER_ID },
      { name: 'Learning', parentId: null, userId: VENSERA_USER_ID },
      { name: 'Tools', parentId: null, userId: VENSERA_USER_ID },
    ]).returning();

    const devCategory = createdCategories.find(c => c.name === 'Development');
    const designCategory = createdCategories.find(c => c.name === 'Design');
    const jsCategory = createdCategories.find(c => c.name === 'JavaScript');
    const learningCategory = createdCategories.find(c => c.name === 'Learning');
    const toolsCategory = createdCategories.find(c => c.name === 'Tools');

    // Seed bookmarks
    console.log('Creating bookmarks...');
    await db.insert(bookmarks).values([
      {
        name: 'React Documentation',
        description: 'Official React documentation with guides, tutorials, and API reference.',
        url: 'https://react.dev',
        tags: ['react', 'frontend', 'documentation'],
        isFavorite: true,
        categoryId: devCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'TypeScript Handbook',
        description: 'Complete guide to TypeScript for JavaScript developers.',
        url: 'https://www.typescriptlang.org/docs/',
        tags: ['typescript', 'javascript', 'programming'],
        isFavorite: true,
        categoryId: jsCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'Dribbble',
        description: 'Discover the world\'s top designers & creative professionals.',
        url: 'https://dribbble.com',
        tags: ['design', 'inspiration', 'ui', 'ux'],
        isFavorite: false,
        categoryId: designCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'MDN Web Docs',
        description: 'Resources for developers, by developers.',
        url: 'https://developer.mozilla.org',
        tags: ['web', 'documentation', 'reference'],
        isFavorite: true,
        categoryId: devCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'Tailwind CSS',
        description: 'A utility-first CSS framework packed with classes.',
        url: 'https://tailwindcss.com',
        tags: ['css', 'framework', 'frontend'],
        isFavorite: false,
        categoryId: devCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'Figma',
        description: 'The collaborative interface design tool.',
        url: 'https://www.figma.com',
        tags: ['design', 'prototyping', 'collaboration'],
        isFavorite: true,
        categoryId: designCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'JavaScript.info',
        description: 'The Modern JavaScript Tutorial.',
        url: 'https://javascript.info',
        tags: ['javascript', 'tutorial', 'learning'],
        isFavorite: false,
        categoryId: learningCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'GitHub',
        description: 'The world\'s leading software development platform.',
        url: 'https://github.com',
        tags: ['git', 'development', 'collaboration'],
        isFavorite: true,
        categoryId: toolsCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'VS Code',
        description: 'Free source-code editor made by Microsoft.',
        url: 'https://code.visualstudio.com',
        tags: ['editor', 'ide', 'development'],
        isFavorite: false,
        categoryId: toolsCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'Stack Overflow',
        description: 'The largest online community for developers.',
        url: 'https://stackoverflow.com',
        tags: ['programming', 'community', 'q&a'],
        isFavorite: false,
        categoryId: learningCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'Unsplash',
        description: 'Beautiful, free images and photos that you can download and use.',
        url: 'https://unsplash.com',
        tags: ['photos', 'free', 'stock'],
        isFavorite: false,
        categoryId: designCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
      {
        name: 'npm',
        description: 'The package manager for JavaScript and the world\'s largest software registry.',
        url: 'https://www.npmjs.com',
        tags: ['javascript', 'packages', 'node'],
        isFavorite: false,
        categoryId: jsCategory?.id || null,
        userId: VENSERA_USER_ID,
      },
    ]);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seed();