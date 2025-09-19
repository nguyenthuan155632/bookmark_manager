import { Bookmark } from '@shared/schema';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export const generateBreadcrumbSchema = (items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

export const generateBookmarksSchema = (bookmarks: (Bookmark & { category?: { name: string } })[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Bookmarks Collection',
  description: 'A curated collection of bookmarks saved in Memorize Vault',
  numberOfItems: bookmarks.length,
  itemListElement: bookmarks.map((bookmark, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Bookmark',
      name: bookmark.name,
      description: bookmark.description || '',
      url: bookmark.url,
      dateCreated: bookmark.createdAt,
      dateModified: bookmark.updatedAt,
      ...(bookmark.category && {
        about: {
          '@type': 'Thing',
          name: bookmark.category.name,
        },
      }),
      ...(bookmark.screenshotUrl && {
        image: bookmark.screenshotUrl,
      }),
      ...(bookmark.tags && bookmark.tags.length > 0 && {
        keywords: bookmark.tags,
      }),
    },
  })),
});

export const generateFAQSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Memorize Vault?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Memorize Vault is an AI-powered bookmark manager that helps you organize, search, and manage your saved links with automatic screenshots and link health monitoring. Perfect for researchers, developers, and knowledge workers.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the AI-powered organization work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our AI analyzes your bookmarks and automatically suggests tags, generates descriptions, and categorizes content based on the actual content of the pages you save. This makes organizing your digital knowledge effortless.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I share my bookmarks with others?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Memorize Vault allows you to share individual bookmarks with passcode protection. You can create shareable links that others can access, making collaboration and knowledge sharing easy.',
      },
    },
    {
      '@type': 'Question',
      name: 'What features does Memorize Vault offer?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Memorize Vault offers AI-powered auto-tagging, automatic screenshots, link health monitoring, hierarchical categories, full-text search, bulk operations, team collaboration, import/export functionality, and browser extensions for easy bookmarking.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Memorize Vault free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Memorize Vault offers a free tier with generous limits for individual users. We also offer premium plans for teams and power users with additional features and higher limits.',
      },
    },
  ],
});

export const generateHowToSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Use Memorize Vault',
  description: 'Learn how to effectively use Memorize Vault to organize your bookmarks',
  totalTime: 'PT5M',
  estimatedCost: {
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: '0',
  },
  tool: [
    {
      '@type': 'HowToTool',
      name: 'Memorize Vault Account',
    },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Sign up for an account',
      text: 'Create your free Memorize Vault account by signing up with your email.',
      url: 'https://memorize.click/auth',
    },
    {
      '@type': 'HowToStep',
      name: 'Install the browser extension',
      text: 'Install our Chrome extension to easily save bookmarks while browsing.',
      url: 'https://memorize.click/documentation#install-extension',
    },
    {
      '@type': 'HowToStep',
      name: 'Save your first bookmark',
      text: 'Click the extension icon or use the web interface to save your first bookmark.',
      url: 'https://memorize.click/documentation#first-bookmark',
    },
    {
      '@type': 'HowToStep',
      name: 'Organize with categories',
      text: 'Create categories to organize your bookmarks hierarchically.',
      url: 'https://memorize.click/documentation#create-category',
    },
    {
      '@type': 'HowToStep',
      name: 'Use AI features',
      text: 'Let AI automatically tag and describe your bookmarks for better organization.',
      url: 'https://memorize.click/documentation#ai-features',
    },
  ],
});

export const generateSoftwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Memorize Vault',
  description: 'AI-powered bookmark manager with automatic screenshots, link health monitoring, and intelligent organization',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web Browser',
  url: 'https://memorize.click',
  author: {
    '@type': 'Organization',
    name: 'Memorize Vault Team',
    url: 'https://memorize.click',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '127',
  },
  features: [
    'AI-powered auto-tagging',
    'Automatic screenshots',
    'Link health monitoring',
    'Hierarchical categories',
    'Full-text search',
    'Team collaboration',
    'Import/Export functionality',
    'Browser extensions',
    'Shareable bookmarks',
    'Bulk operations',
  ],
};

export const generateVideoGameSchema = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Memorize Vault',
  description: 'AI-powered bookmark manager for organizing digital knowledge',
  url: 'https://memorize.click',
  author: {
    '@type': 'Organization',
    name: 'Memorize Vault Team',
  },
  gamePlatform: 'Web Browser',
  applicationCategory: 'Game',
  operatingSystem: 'Web Browser',
};

// Helper to combine multiple schemas
export const combineSchemas = (...schemas: Record<string, any>[]) => {
  return schemas.filter(Boolean);
};