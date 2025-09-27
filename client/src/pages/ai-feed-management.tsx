import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/lib/seo';
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

type AiCrawlerSettings = {
  id: number;
  userId: string;
  maxFeedsPerSource: number;
  isEnabled: boolean;
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
  createdAt: string;
  updatedAt: string;
};

type AiFeedSource = {
  id: number;
  url: string;
  userId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRunAt?: string;
  crawlInterval: number;
  isActive: boolean;
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
  const [newSourceInterval, setNewSourceInterval] = useState(60);
  const [editingSource, setEditingSource] = useState<AiFeedSource | null>(null);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [editSourceInterval, setEditSourceInterval] = useState(60);

  const settings = settingsData?.settings?.[0];
  const preferences = settingsData?.preferences;

  // Create new feed source
  const createSourceMutation = useMutation({
    mutationFn: async (data: { url: string; crawlInterval: number; isActive: boolean }) => {
      const res = await apiRequest('POST', '/api/ai-feeds/sources', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      setNewSourceUrl('');
      setNewSourceInterval(60);
      toast({ description: 'Feed source created successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error?.message || 'Failed to create feed source' });
    },
  });

  // Update feed source
  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { url?: string; crawlInterval?: number; isActive?: boolean } }) => {
      const res = await apiRequest('PUT', `/api/ai-feeds/sources/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-feeds/status'] });
      setEditingSource(null);
      toast({ description: 'Feed source updated successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error?.message || 'Failed to update feed source' });
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
      toast({ variant: 'destructive', description: error?.message || 'Failed to delete feed source' });
    },
  });

  // Update crawler settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { maxFeedsPerSource?: number; isEnabled?: boolean }) => {
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
      toast({ variant: 'destructive', description: error?.message || 'Failed to trigger feed processing' });
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
        description: 'Share link copied to clipboard!'
      });

      // Copy share URL to clipboard
      if (data.shareUrl) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard.writeText(fullUrl).catch(() => {
          toast({
            variant: 'destructive',
            description: 'Failed to copy share URL to clipboard'
          });
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to share article'
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
        description: error?.message || 'Failed to delete article'
      });
    },
  });

  const handleCreateSource = () => {
    if (!newSourceUrl.trim()) return;
    createSourceMutation.mutate({
      url: newSourceUrl.trim(),
      crawlInterval: newSourceInterval,
      isActive: true,
    });
  };

  const handleStartEdit = (source: AiFeedSource) => {
    setEditingSource(source);
    setEditSourceUrl(source.url);
    setEditSourceInterval(source.crawlInterval);
  };

  const handleSaveEdit = () => {
    if (!editingSource || !editSourceUrl.trim()) return;
    updateSourceMutation.mutate({
      id: editingSource.id,
      data: {
        url: editSourceUrl.trim(),
        crawlInterval: editSourceInterval,
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditSourceUrl('');
    setEditSourceInterval(60);
  };

  const handleDeleteSource = (id: number) => {
    if (confirm('Are you sure you want to delete this feed source? This will also delete all articles from this source.')) {
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
        onCreateFolder={() => { }}
        stats={stats}
      />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
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

        <div className="w-full p-6 overflow-y-auto px-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sources">Feed Sources</TabsTrigger>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rss className="h-5 w-5" />
                    Feed Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add New Source */}
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <h3 className="text-sm font-medium">Add New Feed Source</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="lg:col-span-2">
                        <Input
                          placeholder="Feed URL (Atom)"
                          value={newSourceUrl}
                          onChange={(e) => setNewSourceUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="Interval (minutes)"
                          value={newSourceInterval}
                          onChange={(e) => setNewSourceInterval(parseInt(e.target.value) || 60)}
                          min={1}
                          max={1440}
                        />
                      </div>
                      <Button
                        onClick={handleCreateSource}
                        disabled={!newSourceUrl.trim() || createSourceMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Source
                      </Button>
                    </div>
                  </div>

                  {/* Sources List */}
                  <div className="space-y-4">
                    {sources.map((source) => (
                      <div key={source.id} className="border rounded-lg p-4 space-y-3">
                        {editingSource?.id === source.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Editing Source</span>
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
                                  disabled={updateSourceMutation.isPending || !editSourceUrl.trim()}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <Label className="text-xs">Feed URL</Label>
                                <Input
                                  value={editSourceUrl}
                                  onChange={(e) => setEditSourceUrl(e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Interval (minutes)</Label>
                                <Input
                                  type="number"
                                  value={editSourceInterval}
                                  onChange={(e) => setEditSourceInterval(parseInt(e.target.value) || 60)}
                                  className="text-sm"
                                  min={1}
                                  max={1440}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(source.status)}
                                  <span className="text-sm font-medium">{source.status}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Rss className="h-4 w-4 text-muted-foreground" />
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium hover:underline flex items-center gap-1"
                                  >
                                    {source.url}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTriggerSource(source.id)}
                                  disabled={triggerSourceMutation.isPending || source.status === 'running'}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
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
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last run: {formatLastRun(source.lastRunAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Interval: {source.crawlInterval} minutes
                              </span>
                              <Badge variant={source.isActive ? 'default' : 'secondary'}>
                                {source.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {sources.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Rss className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No feed sources configured yet.</p>
                        <p className="text-sm">Add your first Atom feed source above.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="articles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    AI Processed Articles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {articlesData?.articles?.map((article) => (
                      <div key={article.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <h3 className="text-lg font-medium mb-2">{article.title}</h3>
                            {article.summary && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                                {article.summary}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {article.publishedAt
                                ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
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
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-border/60">
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
                            onClick={() => shareArticleMutation.mutate(article.id)}
                            disabled={shareArticleMutation.isPending}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share Article
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteArticle(article.id)}
                            disabled={deleteArticleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!articlesData?.articles || articlesData.articles.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No articles processed yet.</p>
                        <p className="text-sm">Add feed sources and wait for the AI to process them.</p>
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
                  {settings && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Max Articles per Source</Label>
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
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isEnabled"
                          checked={settings.isEnabled}
                          onChange={(e) => {
                            updateSettingsMutation.mutate({
                              isEnabled: e.target.checked,
                            });
                          }}
                        />
                        <Label htmlFor="isEnabled">Enable AI Crawler</Label>
                      </div>
                    </div>
                  )}

                  {preferences && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">AI Processing Preferences</h3>
                        <div className="space-y-2">
                          <Label>Default AI Language</Label>
                          <div className="text-sm text-muted-foreground">
                            {preferences.defaultAiLanguage === 'auto' ? 'Auto Detect' : preferences.defaultAiLanguage}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            This setting is configured in the main Settings page
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">System Status</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm font-medium">Total Sources</div>
                        <div className="text-2xl font-bold">{sources.length}</div>
                      </div>
                      {statusData?.stats && (
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm font-medium">Total Articles</div>
                          <div className="text-2xl font-bold">{statusData.stats.totalArticles}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
