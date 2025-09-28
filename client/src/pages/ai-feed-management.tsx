import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useEffect, useState } from 'react';
import { Link } from 'wouter';

const SCHEDULE_HOUR_OPTIONS = ['1', '2', '3', '4', '6', '8', '12', '24'];
const SCHEDULE_DAILY_TIMES = [
  '00:00',
  '02:00',
  '04:00',
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
];

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
  const [activeTab, setActiveTab] = useState('sources');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle hash-based tab navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove the # character
    if (['sources', 'articles', 'settings'].includes(hash)) {
      setActiveTab(hash);
    } else if (!window.location.hash) {
      // Set default tab if no hash
      setActiveTab('sources');
    }
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  const { data: settingsData } = useQuery<{
    settings: AiCrawlerSettings[];
    preferences: UserPreferences | null;
  }>({ queryKey: ['/api/ai-feeds/settings'] });

  const { data: sourcesData } = useQuery<{
    sources: AiFeedSource[];
  }>({ queryKey: ['/api/ai-feeds/sources'] });

  const sources = sourcesData?.sources || [];

  const { data: articlesData } = useQuery<{
    articles: AiFeedArticle[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({ queryKey: ['/api/ai-feeds/articles'] });

  const { data: statusData } = useQuery<{
    sources: AiFeedSource[];
    stats: {
      totalArticles: number;
      unreadArticles: number;
    };
  }>({ queryKey: ['/api/ai-feeds/status'] });

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

  return (
    <div className="flex h-screen overflow-hidden">
      <SEO
        title="AI Feed Management"
        description="Manage AI feed sources, settings, and view processed articles."
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onCreateFolder={() => {}}
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
              <div className="overflow-x-auto pb-1">
                <TabsList className="inline-flex min-w-full justify-start gap-2 rounded-2xl border bg-card/80 p-1.5 shadow-sm">
                  <TabsTrigger
                    value="sources"
                    className="flex min-w-[180px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Rss className="h-4 w-4" />
                    Feed Sources
                  </TabsTrigger>
                  <TabsTrigger
                    value="articles"
                    className="flex min-w-[180px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <FileText className="h-4 w-4" />
                    Articles
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="flex min-w-[180px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
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
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <TooltipProvider delayDuration={150}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTriggerSource(source.id)}
                                            disabled={
                                              triggerSourceMutation.isPending ||
                                              source.status === 'running'
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
                                <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    Last run: {formatLastRun(source.lastRunAt)}
                                  </div>
                                </div>
                                <Badge
                                  variant={source.isActive ? 'default' : 'secondary'}
                                  className="uppercase tracking-wide w-fit"
                                >
                                  {source.isActive ? 'Active' : 'Inactive'}
                                </Badge>
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      AI Processed Articles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {articlesData?.articles?.map((article) => (
                        <div
                          key={article.id}
                          className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col"
                        >
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold leading-snug line-clamp-2">
                              {article.title}
                            </h3>
                            {article.summary && (
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {article.summary}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {article.publishedAt
                                  ? formatDistanceToNow(new Date(article.publishedAt), {
                                      addSuffix: true,
                                    })
                                  : 'No publish date'}
                              </span>
                              {article.sourceUrl && (
                                <span className="flex items-center gap-1">
                                  <Rss className="h-3 w-3" />
                                  <a
                                    href={article.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                  >
                                    View Source
                                  </a>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-end gap-2 pt-3 border-t border-border/60">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(article.url, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                              Read
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`inline-flex items-center gap-2 font-medium transition-colors ${
                                article.isShared
                                  ? 'text-emerald-600 hover:text-emerald-600 hover:bg-emerald-100/60'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              onClick={() => shareArticleMutation.mutate(article.id)}
                              disabled={shareArticleMutation.isPending}
                            >
                              <Share2 className="h-4 w-4" />
                              Share Article
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteArticle(article.id)}
                              disabled={deleteArticleMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!articlesData?.articles || articlesData.articles.length === 0) && (
                        <div className="rounded-xl border bg-muted/20 p-10 text-center text-muted-foreground xl:col-span-2">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-60" />
                          <p className="font-medium mb-1">No articles processed yet.</p>
                          <p className="text-sm">
                            Add feed sources and wait for the AI to process them.
                          </p>
                        </div>
                      )}
                    </div>
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
