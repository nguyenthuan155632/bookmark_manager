// Documentation section IDs extracted from documentation.tsx
export const documentationSections = [
  // Getting Started
  'getting-started',
  'overview',
  'authentication',
  'first-bookmark',

  // Core Features - Bookmarks
  'core-features',
  'bookmarks',
  'create-bookmark',
  'edit-bookmark',
  'delete-bookmark',
  'view-bookmark',
  'favorite-bookmarks',

  // Core Features - Categories
  'categories',
  'create-category',
  'edit-category',
  'delete-category',
  'reorder-categories',

  // Core Features - Search & Filter
  'search-filter',
  'search-bookmarks',
  'filter-by-category',
  'filter-by-tags',
  'filter-by-status',
  'sort-bookmarks',

  // Advanced Features - Bulk Operations
  'advanced-features',
  'bulk-operations',
  'bulk-select',
  'bulk-delete',
  'bulk-move',
  'bulk-check-links',

  // Advanced Features - AI Features
  'ai-features',
  'auto-tagging',
  'auto-description',
  'domain-tags',

  // Advanced Features - Link Management
  'link-management',
  'link-checking',
  'broken-links',
  'link-status',

  // Advanced Features - Screenshots
  'screenshots',
  'auto-screenshots',
  'screenshot-status',

  // Security & Privacy - Protected Bookmarks
  'security-privacy',
  'protected-bookmarks',
  'create-protected',
  'unlock-protected',

  // Security & Privacy - Sharing
  'sharing',
  'share-bookmark',

  // Data Management - Import & Export
  'data-management',
  'import-export',
  'export-bookmarks',
  'import-bookmarks',

  // Customization - Appearance
  'customization',
  'appearance',
  'themes',
  'view-modes',

  // Customization - Settings
  'settings',
  'user-preferences',
  'default-category',
  'session-timeout',

  // Extensions & Integrations - Chrome Extension
  'extensions',
  'chrome-extension',
  'install-extension',
  'extension-usage',

  // Troubleshooting
  'troubleshooting',
  'common-issues',
  'performance',
  'support',
];

export const documentationSectionTitles: Record<string, string> = {
  'getting-started': 'Getting Started',
  'overview': 'Overview',
  'authentication': 'Authentication',
  'first-bookmark': 'Creating Your First Bookmark',
  'core-features': 'Core Features',
  'bookmarks': 'Bookmarks',
  'create-bookmark': 'Creating Bookmarks',
  'edit-bookmark': 'Editing Bookmarks',
  'delete-bookmark': 'Deleting Bookmarks',
  'view-bookmark': 'Viewing Bookmarks',
  'favorite-bookmarks': 'Favorites',
  'categories': 'Categories',
  'create-category': 'Creating Categories',
  'edit-category': 'Editing Categories',
  'delete-category': 'Deleting Categories',
  'reorder-categories': 'Reordering Categories',
  'search-filter': 'Search & Filter',
  'search-bookmarks': 'Searching Bookmarks',
  'filter-by-category': 'Filter by Category',
  'filter-by-tags': 'Filter by Tags',
  'filter-by-status': 'Filter by Link Status',
  'sort-bookmarks': 'Sorting Bookmarks',
  'advanced-features': 'Advanced Features',
  'bulk-operations': 'Bulk Operations',
  'bulk-select': 'Selecting Multiple Bookmarks',
  'bulk-delete': 'Bulk Delete',
  'bulk-move': 'Bulk Move to Category',
  'bulk-check-links': 'Bulk Link Checking',
  'ai-features': 'AI Features',
  'auto-tagging': 'Auto Tagging',
  'auto-description': 'Auto Description',
  'domain-tags': 'Domain Tags',
  'link-management': 'Link Management',
  'link-checking': 'Link Checking',
  'broken-links': 'Broken Link Detection',
  'link-status': 'Link Status Indicators',
  'screenshots': 'Screenshots',
  'auto-screenshots': 'Automatic Screenshots',
  'screenshot-status': 'Screenshot Status',
  'security-privacy': 'Security & Privacy',
  'protected-bookmarks': 'Protected Bookmarks',
  'create-protected': 'Creating Protected Bookmarks',
  'unlock-protected': 'Unlocking Protected Bookmarks',
  'sharing': 'Sharing',
  'share-bookmark': 'Sharing Bookmarks',
  'data-management': 'Data Management',
  'import-export': 'Import & Export',
  'export-bookmarks': 'Exporting Bookmarks',
  'import-bookmarks': 'Importing Bookmarks',
  'customization': 'Customization',
  'appearance': 'Appearance',
  'themes': 'Light & Dark Themes',
  'view-modes': 'Grid & List Views',
  'settings': 'Settings',
  'user-preferences': 'User Preferences',
  'default-category': 'Default Category',
  'session-timeout': 'Session Timeout',
  'extensions': 'Extensions & Integrations',
  'chrome-extension': 'Chrome Extension',
  'install-extension': 'Installing the Extension',
  'extension-usage': 'Using the Extension',
  'troubleshooting': 'Troubleshooting',
  'common-issues': 'Common Issues',
  'performance': 'Performance Tips',
  'support': 'Getting Support',
};

export function generateDocumentationSitemapItems() {
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || '';

  return documentationSections.map(sectionId => ({
    loc: `${baseUrl}/documentation#${sectionId}`,
    lastmod: new Date().toISOString(),
    changefreq: 'weekly' as const,
    priority: 0.7 as const,
    title: documentationSectionTitles[sectionId] || sectionId,
  }));
}