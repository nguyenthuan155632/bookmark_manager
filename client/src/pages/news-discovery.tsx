import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  Flame,
  Loader2,
  Search,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';

interface Article {
  id: number;
  sourceId: number;
  title: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  shareId?: string;
  isShared: boolean;
  sourceUrl: string;
}

interface SourceFilter {
  url: string;
  articleCount: number;
}

interface DiscoveryData {
  articles: Article[];
  sources: SourceFilter[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function NewsDiscoveryPage() {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() !== searchTerm) {
        setSearchTerm(searchInput.trim());
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [searchInput, searchTerm]);

  const PAGE_SIZE = 20;

  // Use infinite query for infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DiscoveryData>({
    queryKey: ['/api/ai-feeds/discovery', { sourceFilter, searchTerm }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set('page', String(pageParam));
      params.set('limit', String(PAGE_SIZE));

      if (sourceFilter !== 'all') {
        params.set('sourceUrl', sourceFilter);
      }

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const response = await fetch(`/api/ai-feeds/discovery?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      return response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  // Merge all pages into a single array
  const allArticles = useMemo(() => {
    return data?.pages.flatMap((page) => page.articles) || [];
  }, [data]);

  // Get sources from first page
  const sources = useMemo(() => {
    return data?.pages[0]?.sources || [];
  }, [data]);

  // Get total count from first page
  const totalCount = useMemo(() => {
    return data?.pages[0]?.pagination.total || 0;
  }, [data]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getSourceDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleSourceChange = (value: string) => {
    setSourceFilter(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20">
      {/* Hero Header */}
      <header className="border-b border-purple-200/50 dark:border-purple-800/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  Discover
                </h1>
                <p className="text-sm text-muted-foreground font-medium">
                  What's trending right now 🔥
                </p>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 h-11 border-purple-200 dark:border-purple-800 focus-visible:ring-purple-500 rounded-xl bg-white dark:bg-gray-800"
                />
              </div>
              <Select value={sourceFilter} onValueChange={handleSourceChange}>
                <SelectTrigger className="sm:w-[240px] h-11 border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-800">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      All Sources
                    </div>
                  </SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.url} value={source.url}>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{getSourceDomain(source.url)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({source.articleCount})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Bar */}
        {totalCount > 0 && (
          <div className="mb-6 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 px-4 py-2 shadow-sm backdrop-blur">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">{totalCount} articles</span>
            </div>
            {sourceFilter !== 'all' && (
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-4 py-2">
                Filtered by: <span className="font-semibold">{getSourceDomain(sourceFilter)}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-96 rounded-3xl bg-white/50 dark:bg-gray-800/50 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-3xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-semibold">
              Oops! Something went wrong 😕
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Failed to load articles'}
            </p>
          </div>
        )}

        {/* Articles Grid */}
        {allArticles.length > 0 && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/shared-article/${article.shareId}`}
                  className="group"
                >
                  <article className="h-full overflow-hidden rounded-3xl border border-purple-200/50 dark:border-purple-800/30 bg-white dark:bg-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-400 dark:hover:border-purple-600">
                    {/* Image */}
                    {article.imageUrl ? (
                      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 flex items-center justify-center">
                        <Sparkles className="h-16 w-16 text-white/80" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-5 flex flex-col gap-3">
                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(article.createdAt)}
                        </div>
                        <div className="truncate max-w-[120px] text-muted-foreground">
                          {getSourceDomain(article.sourceUrl)}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-lg font-bold leading-tight text-foreground line-clamp-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {article.title}
                      </h2>

                      {/* Summary */}
                      {article.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {article.summary}
                        </p>
                      )}

                      {/* Read More */}
                      <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 group-hover:gap-3 transition-all">
                        <span>Read more</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {/* Load More Trigger (Intersection Observer) */}
            <div ref={loadMoreRef} className="mt-12 flex justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-3 rounded-full bg-purple-100 dark:bg-purple-900/30 px-6 py-3 text-purple-600 dark:text-purple-400 font-semibold">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading more articles...</span>
                </div>
              )}
              {!hasNextPage && allArticles.length > 0 && (
                <div className="text-center text-muted-foreground">
                  <p className="text-sm font-medium">
                    You've reached the end! 🎉
                  </p>
                  <p className="text-xs mt-1">
                    {allArticles.length} articles loaded
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading && allArticles.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-white/50 dark:bg-gray-800/50 p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Search className="h-10 w-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">No articles found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter to find what you're looking for
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-purple-200/50 dark:border-purple-800/30 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-semibold">Powered by Memorize Vault</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
