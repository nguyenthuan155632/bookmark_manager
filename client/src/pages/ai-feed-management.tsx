import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/lib/seo';
import { normaliseTimezone, TIMEZONE_OPTIONS } from '@/lib/timezones';
import { BOOKMARK_LANGUAGE_LABELS, BookmarkLanguage } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Save,
  Settings,
  Share2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';

const SCHEDULE_HOUR_OPTIONS = ['1', '2', '3', '4', '6', '8', '12', '24'];
const SCHEDULE_DAILY_TIMES = [
  '00:00',
  '01:00',
  '02:00',
  '03:00',
  '04:00',
  '05:00',
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
];

const TAB_KEYS = ['sources', 'articles', 'settings'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const isTabKey = (value: string): value is TabKey =>
  TAB_KEYS.includes(value as TabKey);

const ARTICLES_PER_PAGE = 20;

const getArticlesPageFromSearch = (): number => {
  if (typeof window === 'undefined') {
    return 1;
  }

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('articlesPage');
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const getArticlesSourceFromSearch = (): string => {
  if (typeof window === 'undefined') {
    return 'all';
  }

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('articlesSource');
  if (!raw) {
    return 'all';
  }

  return /^\d+$/.test(raw) ? raw : 'all';
};

const syncArticlesSearchParams = (page: number, source: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete('articlesPage');
  } else {
    url.searchParams.set('articlesPage', String(page));
  }

  if (!source || source === 'all') {
    url.searchParams.delete('articlesSource');
  } else {
    url.searchParams.set('articlesSource', source);
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

type AiCrawlerSettings = {
  id: number;
  userId: string;
  maxFeedsPerSource: number;
  isEnabled: boolean;
  crawlScheduleMode: 'every_hours' | 'daily';
  crawlScheduleValue: string;
  createdAt: string;
};

type UserPreferences = {
  id: number;
  userId: string;
  theme?: 'light' | 'dark';
  viewMode?: 'grid' | 'list';
  defaultCategoryId?: number | null;
  sessionTimeoutMinutes?: number;
  linkCheckEnabled?: boolean;
  linkCheckIntervalMinutes?: number;
  linkCheckBatchSize?: number;
  autoTagSuggestionsEnabled?: boolean;
  aiTaggingEnabled?: boolean;
  autoDescriptionEnabled?: boolean;
  aiDescriptionEnabled?: boolean;
  aiUsageLimit?: number | null;
  defaultAiLanguage?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
};

type AiFeedSource = {
  id: number;
  url: string;
  userId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRunAt?: string;
  isActive: boolean;
  crawlScheduleMode?: 'inherit' | 'every_hours' | 'daily';
  crawlScheduleValue?: string;
  createdAt: string;
};

type AiFeedArticle = {
  id: number;
  sourceId: number;
  title: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  notificationContent?: string;
  notificationSent: boolean;
  publishedAt?: string;
  createdAt: string;
  sourceUrl?: string;
  shareId?: string;
  isShared?: boolean;
};

export default function AiFeedManagementPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') {
      return 'sources';
    }
    const initialHash = window.location.hash.slice(1);
    return isTabKey(initialHash) ? initialHash : 'sources';
  });
  const [articlesPage, setArticlesPage] = useState<number>(() => getArticlesPageFromSearch());
  const [articlesSourceFilter, setArticlesSourceFilter] = useState<string>(
    () => getArticlesSourceFromSearch(),
  );
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle hash-based tab navigation
  useEffect(() => {
    const syncHashToTab = () => {
      const hash = window.location.hash.slice(1);
      setActiveTab(isTabKey(hash) ? hash : 'sources');

      if (hash === 'articles') {
        const currentPage = getArticlesPageFromSearch();
        setArticlesPage((prev) => (prev === currentPage ? prev : currentPage));
        const currentSource = getArticlesSourceFromSearch();
        setArticlesSourceFilter((prev) => (prev === currentSource ? prev : currentSource));
      }
    };

    syncHashToTab();
    window.addEventListener('hashchange', syncHashToTab);
    return () => window.removeEventListener('hashchange', syncHashToTab);
  }, []);

  useEffect(() => {
    if (activeTab !== 'articles') {
      return;
    }

    const currentPage = getArticlesPageFromSearch();
    setArticlesPage((prev) => (prev === currentPage ? prev : currentPage));
    const currentSource = getArticlesSourceFromSearch();
    setArticlesSourceFilter((prev) => (prev === currentSource ? prev : currentSource));
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePopState = () => {
      if (window.location.hash.slice(1) !== 'articles') {
        return;
      }
      const currentPage = getArticlesPageFromSearch();
      setArticlesPage((prev) => (prev === currentPage ? prev : currentPage));
      const currentSource = getArticlesSourceFromSearch();
      setArticlesSourceFilter((prev) => (prev === currentSource ? prev : currentSource));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activeTab !== 'articles') {
      return;
    }
    syncArticlesSearchParams(articlesPage, articlesSourceFilter);
  }, [articlesPage, activeTab, articlesSourceFilter]);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    if (isTabKey(value)) {
      setActiveTab(value);
      if (typeof window !== 'undefined') {
        window.location.hash = value;
      }
    }
  };

  const { data: settingsData } = useQuery<{
    settings: AiCrawlerSettings[];
    preferences: UserPreferences | null;
  }>({ queryKey: ['/api/ai-feeds/settings'] });

  const { data: sourcesData } = useQuery<{
    sources: AiFeedSource[];
  }>({ queryKey: ['/api/ai-feeds/sources'] });

  const sources = sourcesData?.sources || [];

  const sourceFilterParam =
    articlesSourceFilter !== 'all' && /^\d+$/.test(articlesSourceFilter)
      ? articlesSourceFilter
      : null;
  const articleQueryString = `?page=${articlesPage}&limit=${ARTICLES_PER_PAGE}${sourceFilterParam ? `&sourceId=${sourceFilterParam}` : ''}`;

  const {
    data: articlesData,
    isFetching: isFetchingArticles,
    isLoading: isLoadingArticles,
  } = useQuery<{
    articles: AiFeedArticle[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ['/api/ai-feeds/articles', articleQueryString],
    enabled: activeTab === 'articles',
  });

  useEffect(() => {
    if (!articlesData?.pagination) {
      return;
    }

    const total = Math.max(articlesData.pagination.totalPages, 1);
    if (articlesPage > total) {
      setArticlesPage(total);
    }
  }, [articlesData?.pagination, articlesPage]);

  useEffect(() => {
    if (!sourcesData || articlesSourceFilter === 'all') {
      return;
    }

    const hasMatch = sourcesData.sources.some((source) => String(source.id) === articlesSourceFilter);
    if (!hasMatch) {
      setArticlesSourceFilter('all');
    }
  }, [articlesSourceFilter, sourcesData]);

  const { data: statusData } = useQuery<{
    sources: AiFeedSource[];
    stats: {
      totalArticles: number;
      unreadArticles: number;
    };
  }>({ queryKey: ['/api/ai-feeds/status'] });

  const { data: pushStatus } = useQuery<{ subscribed: boolean; supported: boolean }>({
    queryKey: ['/api/push-subscriptions/status'],
  });

  // Form states
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [editingSource, setEditingSource] = useState<AiFeedSource | null>(null);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [newSourceScheduleMode, setNewSourceScheduleMode] = useState<
    'inherit' | 'every_hours' | 'daily'
  >('inherit');
  const [newSourceScheduleValue, setNewSourceScheduleValue] = useState('6');
  const [editSourceScheduleMode, setEditSourceScheduleMode] = useState<
    'inherit' | 'every_hours' | 'daily'
  >('inherit');
  const [editSourceScheduleValue, setEditSourceScheduleValue] = useState('6');
  useEffect(() => {
    if (newSourceScheduleMode === 'daily' && !newSourceScheduleValue.includes(':')) {
      setNewSourceScheduleValue('07:00');
    }
    if (newSourceScheduleMode === 'every_hours' && newSourceScheduleValue.includes(':')) {
      setNewSourceScheduleValue('6');
    }
  }, [newSourceScheduleMode, newSourceScheduleValue]);
  useEffect(() => {
    if (editSourceScheduleMode === 'daily' && !editSourceScheduleValue.includes(':')) {
      setEditSourceScheduleValue('07:00');
    }
    if (editSourceScheduleMode === 'every_hours' && editSourceScheduleValue.includes(':')) {
      setEditSourceScheduleValue('6');
    }
  }, [editSourceScheduleMode, editSourceScheduleValue]);

  const settings = settingsData?.settings?.[0];
  const preferences = settingsData?.preferences;
  const scheduleMode = settings?.crawlScheduleMode || 'every_hours';
  const scheduleValue = settings?.crawlScheduleValue || (scheduleMode === 'daily' ? '08:00' : '6');
  const userTimezone = normaliseTimezone(preferences?.timezone);
  const timezoneLabel =
    TIMEZONE_OPTIONS.find((option) => option.value === userTimezone)?.label || userTimezone;
  const describeSchedule = (
    sourceMode?: string,
    sourceValue?: string,
    globalMode?: string,
    globalValue?: string,
    timezoneLabel?: string,
  ) => {
    const effectiveMode =
      sourceMode && sourceMode !== 'inherit' ? sourceMode : globalMode || 'every_hours';
    const rawValue = sourceMode && sourceMode !== 'inherit' ? sourceValue || '' : globalValue || '';

    if (effectiveMode === 'every_hours') {
      const hours = rawValue && !rawValue.includes(':') ? rawValue : '6';
      const base = `Every ${hours} hour${hours === '1' ? '' : 's'}`;
      return sourceMode === 'inherit' ? `Using global schedule — ${base}` : base;
    }

    const time = rawValue && rawValue.includes(':') ? rawValue : '07:00';
    const zone = timezoneLabel || 'UTC';
    const base = `Daily at ${time} ${zone}`;
    return sourceMode === 'inherit' ? `Using global schedule — ${base}` : base;
  };

  // Create new feed source
  const createSourceMutation = useMutation({
    mutationFn: async (data: {
      url: string;
      isActive: boolean;
      crawlScheduleMode?: 'inherit' | 'every_hours' | 'daily';
      crawlScheduleValue?: string;
    }) => {
      const res = await apiRequest('POST', '/api/ai-feeds/sources', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      setNewSourceUrl('');
      setNewSourceScheduleMode('inherit');
      setNewSourceScheduleValue('6');
      toast({ description: 'Feed source created successfully' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to create feed source',
      });
    },
  });

  // Update feed source
  const updateSourceMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        url?: string;
        isActive?: boolean;
        crawlScheduleMode?: 'inherit' | 'every_hours' | 'daily';
        crawlScheduleValue?: string;
      };
    }) => {
      const res = await apiRequest('PUT', `/api/ai-feeds/sources/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      setEditingSource(null);
      setEditSourceScheduleMode('inherit');
      setEditSourceScheduleValue('6');
      toast({ description: 'Feed source updated successfully' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to update feed source',
      });
    },
  });

  // Delete feed source
  const deleteSourceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/ai-feeds/sources/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/articles'] });
      toast({ description: 'Feed source deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to delete feed source',
      });
    },
  });

  // Update crawler settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      maxFeedsPerSource?: number;
      isEnabled?: boolean;
      crawlScheduleMode?: 'daily' | 'every_hours';
      crawlScheduleValue?: string;
    }) => {
      const res = await apiRequest('PUT', '/api/ai-feeds/settings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/settings'] });
      toast({ description: 'Settings updated successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error?.message || 'Failed to update settings' });
    },
  });

  // Trigger feed processing
  const triggerSourceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/ai-feeds/sources/${id}/trigger`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      toast({ description: 'Feed processing triggered' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to trigger feed processing',
      });
    },
  });

  // Share article
  const shareArticleMutation = useMutation({
    mutationFn: async (articleId: number) => {
      const res = await apiRequest('POST', `/api/ai-feeds/articles/${articleId}/share`);
      return res.json();
    },
    onSuccess: (data, _articleId) => {
      toast({
        title: 'Article Shared',
        description: 'Share link copied to clipboard!',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/articles'] });

      // Copy share URL to clipboard
      if (data.shareUrl) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard
          .writeText(fullUrl)
          .then(() => {
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
          })
          .catch(() => {
            toast({
              variant: 'destructive',
              description: 'Failed to copy share URL to clipboard',
            });
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
          });
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to share article',
      });
    },
  });

  // Delete article
  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: number) => {
      const res = await apiRequest('DELETE', `/api/ai-feeds/articles/${articleId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      toast({ description: 'Article deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to delete article',
      });
    },
  });

  const [sendingArticleId, setSendingArticleId] = useState<number | null>(null);

  const sendPushMutation = useMutation({
    mutationFn: async ({ articleId }: { articleId: number }) => {
      const res = await apiRequest('POST', `/api/push/articles/${articleId}/send`);
      return res.json();
    },
    onMutate: ({ articleId }) => {
      setSendingArticleId(articleId);
    },
    onSuccess: () => {
      toast({ description: 'Push notification sent' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to send push notification',
      });
    },
    onSettled: () => {
      setSendingArticleId(null);
    },
  });

  const handleCreateSource = () => {
    if (!newSourceUrl.trim()) return;
    createSourceMutation.mutate({
      url: newSourceUrl.trim(),
      isActive: true,
      crawlScheduleMode: newSourceScheduleMode,
      crawlScheduleValue:
        newSourceScheduleMode === 'inherit'
          ? ''
          : newSourceScheduleMode === 'every_hours'
            ? newSourceScheduleValue
            : newSourceScheduleValue,
    });
  };

  const handleStartEdit = (source: AiFeedSource) => {
    setEditingSource(source);
    setEditSourceUrl(source.url);
    const mode = source.crawlScheduleMode || 'inherit';
    setEditSourceScheduleMode(mode);
    if (mode === 'every_hours') {
      setEditSourceScheduleValue(
        source.crawlScheduleValue && !source.crawlScheduleValue.includes(':')
          ? source.crawlScheduleValue
          : '6',
      );
    } else if (mode === 'daily') {
      setEditSourceScheduleValue(
        source.crawlScheduleValue && source.crawlScheduleValue.includes(':')
          ? source.crawlScheduleValue
          : '07:00',
      );
    } else {
      setEditSourceScheduleValue('6');
    }
  };

  const handleSaveEdit = () => {
    if (!editingSource || !editSourceUrl.trim()) return;
    updateSourceMutation.mutate({
      id: editingSource.id,
      data: {
        url: editSourceUrl.trim(),
        crawlScheduleMode: editSourceScheduleMode,
        crawlScheduleValue:
          editSourceScheduleMode === 'inherit'
            ? ''
            : editSourceScheduleMode === 'every_hours'
              ? editSourceScheduleValue
              : editSourceScheduleValue,
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditSourceUrl('');
    setEditSourceScheduleMode('inherit');
    setEditSourceScheduleValue('6');
  };

  const handleDeleteSource = (id: number) => {
    if (
      confirm(
        'Are you sure you want to delete this feed source? This will also delete all articles from this source.',
      )
    ) {
      deleteSourceMutation.mutate(id);
    }
  };

  const handleToggleSource = (source: AiFeedSource) => {
    updateSourceMutation.mutate({
      id: source.id,
      data: { isActive: !source.isActive },
    });
  };

  const handleTriggerSource = (id: number) => {
    triggerSourceMutation.mutate(id);
  };

  const handleDeleteArticle = (articleId: number) => {
    if (confirm('Are you sure you want to delete this article?')) {
      deleteArticleMutation.mutate(articleId);
    }
  };

  const handleArticlesPageChange = (page: number) => {
    const totalPages = articlesData?.pagination?.totalPages || 1;
    const nextPage = Math.max(1, Math.min(page, totalPages));
    setArticlesPage(nextPage);
  };

  const handleArticlesSourceFilterChange = (value: string) => {
    setArticlesSourceFilter(value);
    setArticlesPage(1);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatLastRun = (lastRunAt?: string) => {
    if (!lastRunAt) return 'Never';
    return formatDistanceToNow(new Date(lastRunAt), { addSuffix: true });
  };

  // Stats for sidebar badges
  const { data: stats = { total: 0, favorites: 0, categories: 0, tags: [] as string[] } } =
    useQuery<{
      total: number;
      favorites: number;
      categories: number;
      tags: string[];
    }>({ queryKey: ['/api/stats'] });

  const totalArticlePages = articlesData?.pagination?.totalPages ?? 1;
  const totalArticles = articlesData?.pagination?.total ?? 0;
  const canGoToPreviousArticlePage = articlesPage > 1;
  const canGoToNextArticlePage = articlesPage < totalArticlePages;
  const isInitialArticlesLoad = activeTab === 'articles' && isLoadingArticles && !articlesData;
  const isRefreshingArticles = activeTab === 'articles' && isFetchingArticles && !!articlesData;
  const canSendPushNotifications = Boolean(pushStatus?.supported && pushStatus?.subscribed);

  const articlePageItems = useMemo(() => {
    const total = totalArticlePages;
    if (total <= 1) {
      return [] as Array<number | 'ellipsis'>;
    }

    const current = Math.min(Math.max(articlesPage, 1), total);
    const pages: Array<number | 'ellipsis'> = [];

    const pushPage = (value: number | 'ellipsis') => {
      if (pages[pages.length - 1] !== value) {
        pages.push(value);
      }
    };

    pushPage(1);

    if (total <= 5) {
      for (let page = 2; page <= total; page += 1) {
        pushPage(page);
      }
      return pages;
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      pushPage('ellipsis');
    }

    for (let page = start; page <= end; page += 1) {
      pushPage(page);
    }

    if (end < total - 1) {
      pushPage('ellipsis');
    }

    pushPage(total);

    return pages;
  }, [articlesPage, totalArticlePages]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SEO
        title="AI Feed Management"
        description="Manage AI feed sources, settings, and view processed articles."
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onCreateFolder={() => { }}
        stats={stats}
      />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-muted/10">
        <div className="border-b bg-card/60 backdrop-blur px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/">
                <Button variant="ghost" size="sm" className="px-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">Home</span>
                </Button>
              </Link>
              <h1 className="text-xl font-semibold truncate">AI Feed Management</h1>
            </div>
            <div className="text-sm text-muted-foreground">Signed in as {user?.username}</div>
          </div>
        </div>

        <div className="w-full overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <div className="pb-1">
                <TabsList className="grid w-full grid-cols-3 gap-2 rounded-xl border bg-card/80 p-0 shadow-sm">
                  <TabsTrigger
                    value="sources"
                    aria-label="Feed Sources"
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Rss className="h-4 w-4" />
                    <span className="hidden sm:inline">Feed Sources</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="articles"
                    aria-label="Articles"
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Articles</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    aria-label="Settings"
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="sources" className="space-y-6">
                <Card className="shadow-sm border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Rss className="h-5 w-5" />
                      Feed Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add New Source */}
                    <div className="space-y-4 rounded-xl border border-dashed bg-muted/40 p-4 sm:p-5">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Add New Feed Source
                      </h3>
                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="md:col-span-7">
                          <Input
                            placeholder="Feed URL (Atom)"
                            value={newSourceUrl}
                            onChange={(e) => setNewSourceUrl(e.target.value)}
                            className="h-11"
                          />
                        </div>
                        <div className="md:col-span-5">
                          <Button
                            onClick={handleCreateSource}
                            disabled={!newSourceUrl.trim() || createSourceMutation.isPending}
                            className="w-full h-11 flex items-center justify-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="md:col-span-4 space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Schedule
                          </Label>
                          <Select
                            value={newSourceScheduleMode}
                            onValueChange={(value: 'inherit' | 'every_hours' | 'daily') =>
                              setNewSourceScheduleMode(value)
                            }
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Use global" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Use global schedule</SelectItem>
                              <SelectItem value="every_hours">Run every N hours</SelectItem>
                              <SelectItem value="daily">Run daily at time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newSourceScheduleMode === 'every_hours' && (
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Interval (hours)
                            </Label>
                            <Select
                              value={
                                newSourceScheduleValue.includes(':') ? '6' : newSourceScheduleValue
                              }
                              onValueChange={(value) => setNewSourceScheduleValue(value)}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select interval" />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_HOUR_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    Every {option} hours
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {newSourceScheduleMode === 'daily' && (
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Daily time ({timezoneLabel})
                            </Label>
                            <Select
                              value={
                                newSourceScheduleValue.includes(':')
                                  ? newSourceScheduleValue
                                  : '07:00'
                              }
                              onValueChange={(value) => setNewSourceScheduleValue(value)}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_DAILY_TIMES.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sources List */}
                    <div className="grid gap-4 xl:grid-cols-2">
                      {sources.map((source) => {
                        const isEditingSource = editingSource?.id === source.id;
                        return (
                          <div
                            key={source.id}
                            className={`rounded-xl border bg-card p-5 shadow-sm space-y-4 ${isEditingSource ? 'xl:col-span-2' : ''}`}
                          >
                            {isEditingSource ? (
                              <div className="space-y-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Settings className="h-4 w-4" />
                                    Editing Source
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEdit}
                                      disabled={updateSourceMutation.isPending}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleSaveEdit}
                                      disabled={
                                        updateSourceMutation.isPending || !editSourceUrl.trim()
                                      }
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                      Feed URL
                                    </Label>
                                    <Input
                                      value={editSourceUrl}
                                      onChange={(e) => setEditSourceUrl(e.target.value)}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                      Schedule
                                    </Label>
                                    <Select
                                      value={editSourceScheduleMode}
                                      onValueChange={(value: 'inherit' | 'every_hours' | 'daily') =>
                                        setEditSourceScheduleMode(value)
                                      }
                                    >
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Use global schedule" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="inherit">Use global schedule</SelectItem>
                                        <SelectItem value="every_hours">
                                          Run every N hours
                                        </SelectItem>
                                        <SelectItem value="daily">Run daily at time</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {editSourceScheduleMode === 'every_hours' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Interval (hours)
                                      </Label>
                                      <Select
                                        value={
                                          editSourceScheduleValue.includes(':')
                                            ? '6'
                                            : editSourceScheduleValue
                                        }
                                        onValueChange={(value) => setEditSourceScheduleValue(value)}
                                      >
                                        <SelectTrigger className="h-10">
                                          <SelectValue placeholder="Select interval" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SCHEDULE_HOUR_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                              Every {option} hours
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {editSourceScheduleMode === 'daily' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Daily time ({timezoneLabel})
                                      </Label>
                                      <Select
                                        value={
                                          editSourceScheduleValue.includes(':')
                                            ? editSourceScheduleValue
                                            : '07:00'
                                        }
                                        onValueChange={(value) => setEditSourceScheduleValue(value)}
                                      >
                                        <SelectTrigger className="h-10">
                                          <SelectValue placeholder="Select time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SCHEDULE_DAILY_TIMES.map((option) => (
                                            <SelectItem key={option} value={option}>
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {getStatusIcon(source.status)}
                                    <span className="capitalize">{source.status}</span>
                                  </div>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline break-all"
                                  >
                                    <Rss className="h-4 w-4" />
                                    {source.url}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  <div className="text-xs text-muted-foreground">
                                    {describeSchedule(
                                      source.crawlScheduleMode,
                                      source.crawlScheduleValue,
                                      scheduleMode,
                                      scheduleValue,
                                      timezoneLabel,
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    Last run: {formatLastRun(source.lastRunAt)}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                  <Badge
                                    variant={source.isActive ? 'default' : 'secondary'}
                                    className="uppercase tracking-wide w-fit"
                                  >
                                    {source.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                  <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <TooltipProvider delayDuration={150}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTriggerSource(source.id)}
                                            disabled={
                                              triggerSourceMutation.isPending ||
                                              source.status === 'running' ||
                                              !source.isActive
                                            }
                                          >
                                            <RefreshCw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs text-xs">
                                          Run now ignores the scheduled interval and queues the
                                          source immediately.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleSource(source)}
                                    >
                                      {source.isActive ? 'Disable' : 'Enable'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStartEdit(source)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteSource(source.id)}
                                      disabled={deleteSourceMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sources.length === 0 && (
                        <div className="rounded-xl border bg-muted/20 p-8 text-center text-muted-foreground xl:col-span-2">
                          <Rss className="h-12 w-12 mx-auto mb-4 opacity-60" />
                          <p className="font-medium mb-1">No feed sources configured yet.</p>
                          <p className="text-sm">Add your first Atom feed source above.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="articles" className="space-y-6">
                <Card className="shadow-sm border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Articles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Filter by source
                      </span>
                      <Select
                        value={articlesSourceFilter}
                        onValueChange={handleArticlesSourceFilterChange}
                      >
                        <SelectTrigger className="w-full sm:w-[260px]">
                          <SelectValue placeholder="All sources" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sources</SelectItem>
                          {sources.map((source) => (
                            <SelectItem
                              key={source.id}
                              value={String(source.id)}
                              className="max-w-full truncate"
                            >
                              {source.url}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isInitialArticlesLoad && (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {!isInitialArticlesLoad && articlesData?.articles && articlesData.articles.length > 0 && (
                      <ArticlesNewsLayout
                        articles={articlesData.articles}
                        canSendPush={canSendPushNotifications}
                        pushStatus={pushStatus}
                        onShare={(id) => shareArticleMutation.mutate(id)}
                        onSendPush={(id) => sendPushMutation.mutate({ articleId: id })}
                        onDelete={(id) => handleDeleteArticle(id)}
                        isSendingPush={(id) => sendPushMutation.isPending && sendingArticleId === id}
                      />
                    )}

                    {!isInitialArticlesLoad && (!articlesData?.articles || articlesData.articles.length === 0) && (
                      <div className="rounded-xl border bg-muted/20 p-10 text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-60" />
                        <p className="font-medium mb-1">No articles processed yet.</p>
                        <p className="text-sm">Add feed sources and wait for the AI to process them.</p>
                      </div>
                    )}

                    {totalArticlePages > 1 && !isInitialArticlesLoad && (
                      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground text-center sm:text-left">
                          Page {articlesPage} of {totalArticlePages}
                          {totalArticles ? ` · ${totalArticles} articles` : ''}
                          {isRefreshingArticles ? ' · Updating…' : ''}
                        </p>
                        <Pagination className="w-full justify-center sm:justify-end">
                          <PaginationContent className="flex items-center gap-2 sm:hidden">
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (canGoToPreviousArticlePage) {
                                    handleArticlesPageChange(articlesPage - 1);
                                  }
                                }}
                                className={!canGoToPreviousArticlePage ? 'pointer-events-none opacity-50' : undefined}
                              />
                            </PaginationItem>
                            <PaginationItem>
                              <span className="px-2 text-sm text-muted-foreground">
                                {articlesPage} / {totalArticlePages}
                              </span>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (canGoToNextArticlePage) {
                                    handleArticlesPageChange(articlesPage + 1);
                                  }
                                }}
                                className={!canGoToNextArticlePage ? 'pointer-events-none opacity-50' : undefined}
                              />
                            </PaginationItem>
                          </PaginationContent>

                          <PaginationContent className="hidden items-center gap-1 sm:flex">
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (canGoToPreviousArticlePage) {
                                    handleArticlesPageChange(articlesPage - 1);
                                  }
                                }}
                                className={!canGoToPreviousArticlePage ? 'pointer-events-none opacity-50' : undefined}
                              />
                            </PaginationItem>
                            {articlePageItems.map((item, index) => (
                              <PaginationItem key={`${item}-${index}`}>
                                {item === 'ellipsis' ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    href="#"
                                    isActive={item === articlesPage}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      if (item !== articlesPage) {
                                        handleArticlesPageChange(item);
                                      }
                                    }}
                                  >
                                    {item}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (canGoToNextArticlePage) {
                                    handleArticlesPageChange(articlesPage + 1);
                                  }
                                }}
                                className={!canGoToNextArticlePage ? 'pointer-events-none opacity-50' : undefined}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      AI Crawler Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                      {settings && (
                        <div className="rounded-xl border bg-card/80 p-5 shadow-sm space-y-5">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              Crawler Behaviour
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Control how many items are queued per crawl and whether the crawler is
                              active.
                            </p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Max Articles per Source
                              </Label>
                              <Input
                                type="number"
                                value={settings.maxFeedsPerSource}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (value >= 1 && value <= 50) {
                                    updateSettingsMutation.mutate({
                                      maxFeedsPerSource: value,
                                    });
                                  }
                                }}
                                min={1}
                                max={50}
                                className="h-10"
                              />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Crawl Schedule
                              </Label>
                              <Select
                                value={scheduleMode}
                                onValueChange={(value) => {
                                  const fallback = value === 'daily' ? '08:00' : '6';
                                  updateSettingsMutation.mutate({
                                    crawlScheduleMode: value as 'daily' | 'every_hours',
                                    crawlScheduleValue:
                                      value === scheduleMode ? scheduleValue : fallback,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-10 w-[220px]">
                                  <SelectValue placeholder="Select schedule" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="every_hours">Run every N hours</SelectItem>
                                  <SelectItem value="daily">Run at specific time daily</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {scheduleMode === 'daily' ? (
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Daily time ({timezoneLabel})
                                </Label>
                                <Select
                                  value={scheduleValue.includes(':') ? scheduleValue : '08:00'}
                                  onValueChange={(value) =>
                                    updateSettingsMutation.mutate({
                                      crawlScheduleValue: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-10 w-[180px]">
                                    <SelectValue placeholder="Select time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SCHEDULE_DAILY_TIMES.map((time) => (
                                      <SelectItem key={time} value={time}>
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Interval (hours)
                                </Label>
                                <Select
                                  value={!scheduleValue.includes(':') ? scheduleValue : '6'}
                                  onValueChange={(value) =>
                                    updateSettingsMutation.mutate({
                                      crawlScheduleValue: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-10 w-[180px]">
                                    <SelectValue placeholder="Select hours" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SCHEDULE_HOUR_OPTIONS.map((hour) => (
                                      <SelectItem key={hour} value={hour}>
                                        Every {hour} hours
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 rounded-lg bg-muted/30">
                            <input
                              type="checkbox"
                              id="isEnabled"
                              checked={settings.isEnabled}
                              onChange={(e) => {
                                updateSettingsMutation.mutate({
                                  isEnabled: e.target.checked,
                                });
                              }}
                              className="h-4 w-4"
                            />
                            <div className="space-y-1">
                              <Label htmlFor="isEnabled" className="text-sm font-medium">
                                Enable AI crawler
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Pause crawling at any time without removing feed sources.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-6">
                        {preferences && (
                          <div className="rounded-xl border bg-card/80 p-5 shadow-sm space-y-3">
                            <h3 className="text-sm font-semibold text-foreground">
                              AI Preferences
                            </h3>
                            <div className="space-y-1">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Default AI language
                              </Label>
                              <div className="text-sm text-foreground">
                                {preferences.defaultAiLanguage === 'auto'
                                  ? 'Auto Detect'
                                  : preferences.defaultAiLanguage
                                    ? BOOKMARK_LANGUAGE_LABELS[
                                    preferences.defaultAiLanguage as BookmarkLanguage
                                    ]
                                    : ''}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Change this in Settings → AI Preferences to influence summaries and
                                formatting.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground">System Status</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Rss className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Total sources
                                </div>
                                <div className="text-xl font-semibold text-foreground">
                                  {sources.length}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Total articles
                                </div>
                                <div className="text-xl font-semibold text-foreground">
                                  {statusData?.stats?.totalArticles ?? 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

type ArticlesNewsLayoutProps = {
  articles: AiFeedArticle[];
  canSendPush: boolean;
  pushStatus?: { subscribed: boolean; supported: boolean };
  onShare: (articleId: number) => void;
  onSendPush: (articleId: number) => void;
  onDelete: (articleId: number) => void;
  isSendingPush: (articleId: number) => boolean;
};

function ArticlesNewsLayout({
  articles,
  canSendPush,
  pushStatus,
  onShare,
  onSendPush,
  onDelete,
  isSendingPush,
}: ArticlesNewsLayoutProps) {
  const pushTooltip = !canSendPush
    ? pushStatus?.supported
      ? 'Push notifications not enabled in settings'
      : 'Push notifications not configured'
    : undefined;

  const renderMeta = (article: AiFeedArticle) => (
    <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
        {article.publishedAt ? ` (Published ${formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })})` : ''}
      </span>
      {article.sourceUrl && (
        <span className="flex items-center gap-1">
          <Rss className="h-3 w-3" />
          <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
            Original Source
          </a>
        </span>
      )}
    </div>
  );

  const renderActions = (article: AiFeedArticle) => {
    const sending = isSendingPush(article.id);

    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => window.open(article.url, '_blank')}>
          <Eye className="h-4 w-4" />
          Read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={`inline-flex items-center gap-2 font-medium transition-colors ${article.isShared
            ? 'text-emerald-600 hover:text-emerald-600 hover:bg-emerald-100/60'
            : 'text-muted-foreground hover:text-foreground'
            }`}
          onClick={() => onShare(article.id)}
        >
          <Share2 className="h-4 w-4" />
          Share Article
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onSendPush(article.id)}
          disabled={sending || !canSendPush}
          title={pushTooltip}
        >
          {sending ? 'Sending…' : 'Send Push'}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(article.id)}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {articles.length > 0 && (
        <div className="space-y-6">
          {articles.map((article) => (
            <article key={article.id} className="border-b pb-6 last:border-none last:pb-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                <div className="flex-1 space-y-3 md:pr-6">
                  <h3 className="text-xl font-semibold leading-snug text-foreground md:text-2xl md:mr-8">
                    {article.title}
                  </h3>
                  {renderMeta(article)}
                  {truncateSummary(article.summary) && (
                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {truncateSummary(article.summary)}
                    </p>
                  )}
                  {renderActions(article)}
                </div>
                {article.imageUrl && (
                  <div className="order-first md:order-last md:ml-auto md:pl-4">
                    <div className="h-32 w-full overflow-hidden rounded-md border md:h-36 md:w-[200px]">
                      <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function truncateSummary(summary?: string, maxLength: number = 220): string {
  if (!summary) {
    return '';
  }
  if (summary.length <= maxLength) {
    return summary;
  }
  return `${summary.slice(0, maxLength).trimEnd()}…`;
}
