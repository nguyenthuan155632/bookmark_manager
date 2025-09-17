import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen, ChevronRight, ChevronDown, FileText, Home, Star, Folder, Settings, Share, Lock, Search, Grid, List, Plus, Trash2, Edit, Eye, Download, Upload, Brain, Link as LinkIcon, Camera, Shield, Users, Globe, Tag, Filter, SortAsc, SortDesc, RefreshCw, CheckCircle, XCircle, AlertCircle, HelpCircle, Zap, Target, Clock, BarChart3, Palette, User, Key, Database, Wifi, Smartphone, Monitor, Chrome, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEO } from '@/lib/seo';
import { useAuth } from '@/hooks/use-auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface DocumentationSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: DocumentationSection[];
  content?: string;
}

const documentationSections: DocumentationSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    children: [
      {
        id: 'overview',
        title: 'Overview',
        icon: Home,
        content: 'overview'
      },
      {
        id: 'authentication',
        title: 'Authentication',
        icon: User,
        content: 'authentication'
      },
      {
        id: 'first-bookmark',
        title: 'Creating Your First Bookmark',
        icon: Plus,
        content: 'first-bookmark'
      }
    ]
  },
  {
    id: 'core-features',
    title: 'Core Features',
    icon: Star,
    children: [
      {
        id: 'bookmarks',
        title: 'Bookmarks',
        icon: BookOpen,
        children: [
          {
            id: 'create-bookmark',
            title: 'Creating Bookmarks',
            icon: Plus,
            content: 'create-bookmark'
          },
          {
            id: 'edit-bookmark',
            title: 'Editing Bookmarks',
            icon: Edit,
            content: 'edit-bookmark'
          },
          {
            id: 'delete-bookmark',
            title: 'Deleting Bookmarks',
            icon: Trash2,
            content: 'delete-bookmark'
          },
          {
            id: 'view-bookmark',
            title: 'Viewing Bookmarks',
            icon: Eye,
            content: 'view-bookmark'
          },
          {
            id: 'favorite-bookmarks',
            title: 'Favorites',
            icon: Star,
            content: 'favorite-bookmarks'
          }
        ]
      },
      {
        id: 'categories',
        title: 'Categories',
        icon: Folder,
        children: [
          {
            id: 'create-category',
            title: 'Creating Categories',
            icon: Plus,
            content: 'create-category'
          },
          {
            id: 'edit-category',
            title: 'Editing Categories',
            icon: Edit,
            content: 'edit-category'
          },
          {
            id: 'delete-category',
            title: 'Deleting Categories',
            icon: Trash2,
            content: 'delete-category'
          },
          {
            id: 'reorder-categories',
            title: 'Reordering Categories',
            icon: SortAsc,
            content: 'reorder-categories'
          }
        ]
      },
      {
        id: 'search-filter',
        title: 'Search & Filter',
        icon: Search,
        children: [
          {
            id: 'search-bookmarks',
            title: 'Searching Bookmarks',
            icon: Search,
            content: 'search-bookmarks'
          },
          {
            id: 'filter-by-category',
            title: 'Filter by Category',
            icon: Filter,
            content: 'filter-by-category'
          },
          {
            id: 'filter-by-tags',
            title: 'Filter by Tags',
            icon: Tag,
            content: 'filter-by-tags'
          },
          {
            id: 'filter-by-status',
            title: 'Filter by Link Status',
            icon: CheckCircle,
            content: 'filter-by-status'
          },
          {
            id: 'sort-bookmarks',
            title: 'Sorting Bookmarks',
            icon: SortAsc,
            content: 'sort-bookmarks'
          }
        ]
      }
    ]
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    icon: Zap,
    children: [
      {
        id: 'bulk-operations',
        title: 'Bulk Operations',
        icon: Target,
        children: [
          {
            id: 'bulk-select',
            title: 'Selecting Multiple Bookmarks',
            icon: CheckCircle,
            content: 'bulk-select'
          },
          {
            id: 'bulk-delete',
            title: 'Bulk Delete',
            icon: Trash2,
            content: 'bulk-delete'
          },
          {
            id: 'bulk-move',
            title: 'Bulk Move to Category',
            icon: Folder,
            content: 'bulk-move'
          },
          {
            id: 'bulk-check-links',
            title: 'Bulk Link Checking',
            icon: LinkIcon,
            content: 'bulk-check-links'
          }
        ]
      },
      {
        id: 'ai-features',
        title: 'AI Features',
        icon: Brain,
        children: [
          {
            id: 'auto-tagging',
            title: 'Auto Tagging',
            icon: Tag,
            content: 'auto-tagging'
          },
          {
            id: 'auto-description',
            title: 'Auto Description',
            icon: FileText,
            content: 'auto-description'
          },
          {
            id: 'domain-tags',
            title: 'Domain Tags',
            icon: Globe,
            content: 'domain-tags'
          }
        ]
      },
      {
        id: 'link-management',
        title: 'Link Management',
        icon: LinkIcon,
        children: [
          {
            id: 'link-checking',
            title: 'Link Checking',
            icon: CheckCircle,
            content: 'link-checking'
          },
          {
            id: 'broken-links',
            title: 'Broken Link Detection',
            icon: XCircle,
            content: 'broken-links'
          },
          {
            id: 'link-status',
            title: 'Link Status Indicators',
            icon: AlertCircle,
            content: 'link-status'
          }
        ]
      },
      {
        id: 'screenshots',
        title: 'Screenshots',
        icon: Camera,
        children: [
          {
            id: 'auto-screenshots',
            title: 'Automatic Screenshots',
            icon: Camera,
            content: 'auto-screenshots'
          },
          {
            id: 'screenshot-status',
            title: 'Screenshot Status',
            icon: CheckCircle,
            content: 'screenshot-status'
          }
        ]
      }
    ]
  },
  {
    id: 'security-privacy',
    title: 'Security & Privacy',
    icon: Shield,
    children: [
      {
        id: 'protected-bookmarks',
        title: 'Protected Bookmarks',
        icon: Lock,
        children: [
          {
            id: 'create-protected',
            title: 'Creating Protected Bookmarks',
            icon: Lock,
            content: 'create-protected'
          },
          {
            id: 'unlock-protected',
            title: 'Unlocking Protected Bookmarks',
            icon: Key,
            content: 'unlock-protected'
          },
        ]
      },
      {
        id: 'sharing',
        title: 'Sharing',
        icon: Share,
        children: [
          {
            id: 'share-bookmark',
            title: 'Sharing Bookmarks',
            icon: Share,
            content: 'share-bookmark'
          },
        ]
      }
    ]
  },
  {
    id: 'data-management',
    title: 'Data Management',
    icon: Database,
    children: [
      {
        id: 'import-export',
        title: 'Import & Export',
        icon: Download,
        children: [
          {
            id: 'export-bookmarks',
            title: 'Exporting Bookmarks',
            icon: Download,
            content: 'export-bookmarks'
          },
          {
            id: 'import-bookmarks',
            title: 'Importing Bookmarks',
            icon: Upload,
            content: 'import-bookmarks'
          }
        ]
      }
    ]
  },
  {
    id: 'customization',
    title: 'Customization',
    icon: Palette,
    children: [
      {
        id: 'appearance',
        title: 'Appearance',
        icon: Palette,
        children: [
          {
            id: 'themes',
            title: 'Light & Dark Themes',
            icon: Monitor,
            content: 'themes'
          },
          {
            id: 'view-modes',
            title: 'Grid & List Views',
            icon: Grid,
            content: 'view-modes'
          }
        ]
      },
      {
        id: 'settings',
        title: 'Settings',
        icon: Settings,
        children: [
          {
            id: 'user-preferences',
            title: 'User Preferences',
            icon: User,
            content: 'user-preferences'
          },
          {
            id: 'default-category',
            title: 'Default Category',
            icon: Folder,
            content: 'default-category'
          },
          {
            id: 'session-timeout',
            title: 'Session Timeout',
            icon: Clock,
            content: 'session-timeout'
          }
        ]
      }
    ]
  },
  {
    id: 'extensions',
    title: 'Extensions & Integrations',
    icon: Chrome,
    children: [
      {
        id: 'chrome-extension',
        title: 'Chrome Extension',
        icon: Chrome,
        children: [
          {
            id: 'install-extension',
            title: 'Installing the Extension',
            icon: Chrome,
            content: 'install-extension'
          },
          {
            id: 'extension-usage',
            title: 'Using the Extension',
            icon: Plus,
            content: 'extension-usage'
          }
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: HelpCircle,
    children: [
      {
        id: 'common-issues',
        title: 'Common Issues',
        icon: AlertCircle,
        content: 'common-issues'
      },
      {
        id: 'performance',
        title: 'Performance Tips',
        icon: Zap,
        content: 'performance'
      },
      {
        id: 'support',
        title: 'Getting Support',
        icon: Users,
        content: 'support'
      }
    ]
  }
];

interface DocumentationContent {
  [key: string]: string;
}

export default function DocumentationPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    'getting-started',
    'core-features',
    'bookmarks',
    'categories',
    'search-filter',
    'ai-features',
    'link-management',
    'visual-features',
    'data-management',
    'sharing-collaboration',
    'settings',
    'extensions',
    'chrome-extension',
    'troubleshooting'
  ]));
  const [selectedContent, setSelectedContent] = useState<string>('overview');
  const [content, setContent] = useState<DocumentationContent>({});
  const { user } = useAuth();

  // No need for stats query in documentation page

  useEffect(() => {
    // Load documentation content from markdown files
    const loadContent = async () => {
      try {
        const response = await fetch('/api/documentation');
        if (response.ok) {
          const data = await response.json();
          setContent(data);
        }
      } catch (error) {
        console.error('Failed to load documentation:', error);
      }
    };
    loadContent();
  }, []);

  // Handle URL hash on component mount and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the # symbol
      if (hash && hash !== selectedContent) {
        setSelectedContent(hash);
        // Auto-expand parent sections for the selected content
        expandParentSections(hash);
      }
    };

    // Check for hash on initial load
    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      setSelectedContent(initialHash);
      // Auto-expand parent sections for the initial content
      expandParentSections(initialHash);
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectedContent]);

  // Function to expand parent sections for a given content ID
  const expandParentSections = (contentId: string) => {
    const findParentSections = (sections: DocumentationSection[], targetId: string, parentIds: string[] = []): string[] => {
      for (const section of sections) {
        if (section.content === targetId) {
          return parentIds;
        }
        if (section.children) {
          const found = findParentSections(section.children, targetId, [...parentIds, section.id]);
          if (found.length > 0) {
            return found;
          }
        }
      }
      return [];
    };

    const parentIds = findParentSections(documentationSections, contentId);
    if (parentIds.length > 0) {
      setExpandedSections(prev => {
        const newSet = new Set(prev);
        parentIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const selectContent = (contentId: string) => {
    setSelectedContent(contentId);
    // Update URL hash to reflect the selected content
    window.history.pushState(null, '', `#${contentId}`);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const renderSection = (section: DocumentationSection, level = 0) => {
    const isExpanded = expandedSections.has(section.id);
    const hasChildren = section.children && section.children.length > 0;
    const Icon = section.icon;

    // Check if this section or any of its children is selected
    const isSelected = selectedContent === section.id ||
      (hasChildren && section.children?.some(child =>
        child.content === selectedContent ||
        (child.children && child.children.some(grandChild => grandChild.content === selectedContent))
      ));

    return (
      <div key={section.id} className="select-none">
        <div
          className={`mt-1 flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer hover:bg-slate-100 transition-colors ${level === 0 ? 'font-semibold text-slate-900 text-sm' : level === 1 ? 'font-medium text-sm text-slate-700' : 'text-sm text-slate-600'
            } ${isSelected ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' : ''}`}
          onClick={() => {
            if (hasChildren) {
              toggleSection(section.id);
            } else if (section.content) {
              selectContent(section.content);
            }
          }}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{section.title}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {section.children!.map(child => renderSection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    const contentText = content[selectedContent] || 'Content not available.';

    return (
      <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold mb-4 mt-6 text-slate-900 border-b border-slate-200 pb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-semibold mb-3 mt-5 text-slate-800">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xl font-medium mb-2 mt-4 text-slate-700">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-lg font-medium mb-2 mt-3 text-slate-700">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="mb-4 text-slate-600 leading-relaxed">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="ml-6 mb-4 space-y-2">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="ml-6 mb-4 space-y-2">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-slate-600 leading-relaxed">
                {children}
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-800">
                {children}
              </strong>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              ) : (
                <code className={className}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto mb-4">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 mb-4">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border border-slate-200 rounded-lg">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-slate-200 px-4 py-2 bg-slate-50 font-semibold text-slate-800 text-left">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-slate-200 px-4 py-2 text-slate-600">
                {children}
              </td>
            ),
          }}
        >
          {contentText}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Documentation"
        description="Complete guide to using Memorize Vault - your personal bookmark management system."
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-900">
                <Button variant="ghost" size="sm" className="px-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">Home</span>
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <h1 className="text-xl font-semibold text-slate-900">Documentation</h1>
            </div>
            <div className="flex items-center gap-4 hidden sm:flex">
              <div className="text-sm text-slate-500">Signed in as {user?.username}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="lg:hidden"
                aria-controls="documentation-sidebar"
                aria-expanded={isSidebarOpen}
                aria-label="Toggle table of contents"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 sm:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="lg:hidden"
                aria-controls="documentation-sidebar"
                aria-expanded={isSidebarOpen}
                aria-label="Toggle table of contents"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Documentation Sidebar */}
        <aside
          id="documentation-sidebar"
          className={`fixed inset-x-4 top-20 bottom-4 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-in-out transform ${isSidebarOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-2 opacity-0 pointer-events-none'} lg:static lg:inset-auto lg:z-auto lg:h-[calc(100vh-4rem)] lg:w-80 lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto lg:rounded-none lg:border-r lg:shadow-none`}
        >
          <div className="h-full overflow-y-auto">
            <div className="p-5 sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Table of Contents</h2>
                <p className="text-sm text-slate-600">Complete guide to all features</p>
              </div>
              <div className="space-y-0.5">
                {documentationSections.map(section => renderSection(section))}
              </div>
            </div>
          </div>
        </aside>

        {/* Documentation Content */}
        <div className="flex-1 bg-slate-50 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <div className="max-w-5xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 lg:p-12 min-h-[400px]">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
