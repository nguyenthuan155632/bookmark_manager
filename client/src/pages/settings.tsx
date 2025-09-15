import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/lib/theme';
import { apiRequest } from '@/lib/queryClient';
import type { Category } from '@shared/schema';
// import { formatDistanceToNow } from 'date-fns';
import { Sidebar } from '@/components/sidebar';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Grid as GridIcon, List as ListIcon, Moon as MoonIcon, Sun as SunIcon, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SEO } from '@/lib/seo';

export default function SettingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: preferences } = useQuery<{
    theme?: 'light' | 'dark';
    viewMode?: 'grid' | 'list';
    defaultCategoryId?: number | null;
    sessionTimeoutMinutes?: number;
    linkCheckIntervalMinutes?: number;
    linkCheckBatchSize?: number;
    autoTagSuggestionsEnabled?: boolean;
    aiTaggingEnabled?: boolean;
  }>({ queryKey: ['/api/preferences'] });

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['/api/categories'] });

  type PrefUpdate = {
    theme?: 'light' | 'dark';
    viewMode?: 'grid' | 'list';
    defaultCategoryId?: number | null;
    sessionTimeoutMinutes?: number;
    linkCheckIntervalMinutes?: number;
    linkCheckBatchSize?: number;
    autoTagSuggestionsEnabled?: boolean;
    aiTaggingEnabled?: boolean;
  };

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: PrefUpdate) => {
      return await apiRequest('PATCH', '/api/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
      toast({ description: 'Preferences updated' });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', description: e?.message || 'Failed to update preferences' });
    },
  });

  // Username state
  const [newUsername, setNewUsername] = useState(user?.username || '');
  useEffect(() => setNewUsername(user?.username || ''), [user?.username]);

  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest('PATCH', '/api/user/username', { username });
      return (await res.json()) as { id: string; username: string };
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(['/api/user'], updated);
      toast({ description: 'Username updated' });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', description: e?.message || 'Failed to update username' });
    },
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePasswordMutation = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest('PATCH', '/api/user/password', payload);
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ description: 'Password changed successfully' });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', description: e?.message || 'Failed to change password' });
    },
  });

  const viewMode = preferences?.viewMode || 'grid';
  const defaultCategoryId = preferences?.defaultCategoryId ?? null;
  const sessionTimeout = preferences?.sessionTimeoutMinutes ?? 30;
  // const linkInterval = preferences?.linkCheckIntervalMinutes ?? 30;
  // const linkBatch = preferences?.linkCheckBatchSize ?? 25;
  const autoTagEnabled = preferences?.autoTagSuggestionsEnabled ?? true;
  const aiTaggingEnabled = preferences?.aiTaggingEnabled ?? false;
  // const linkEnabled = preferences?.linkCheckEnabled ?? false;
  // const { data: linkStatus } = useQuery<{
  //   enabled: boolean;
  //   isRunning?: boolean;
  //   isChecking?: boolean;
  //   intervalMinutes: number;
  //   batchSize: number;
  //   lastRunAt?: string | null;
  //   nextRunAt?: string | null;
  // }>({ queryKey: ['/api/user/link-checker/status'] });
  // const runNowMutation = useMutation({
  //   mutationFn: async () => {
  //     await apiRequest('POST', '/api/user/link-checker/run-now');
  //   },
  //   onSuccess: async () => {
  //     await queryClient.invalidateQueries({ queryKey: ['/api/user/link-checker/status'] });
  //     const status = await queryClient.fetchQuery({
  //       queryKey: ['/api/user/link-checker/status'],
  //       queryFn: async () => {
  //         const res = await fetch('/api/user/link-checker/status', { credentials: 'include' });
  //         if (!res.ok) throw new Error('status fetch failed');
  //         return res.json();
  //       },
  //     });
  //     const lastText = status?.lastRunAt
  //       ? `last ${formatDistanceToNow(new Date(status.lastRunAt), { addSuffix: true })}`
  //       : 'last run not available yet';
  //     const nextText = status?.nextRunAt
  //       ? `next ${formatDistanceToNow(new Date(status.nextRunAt), { addSuffix: true })}`
  //       : '';
  //     toast({ description: `Link check started — ${lastText}${nextText ? `, ${nextText}` : ''}` });
  //   },
  //   onError: () => {
  //     toast({ variant: 'destructive', description: 'Failed to start link check' });
  //   },
  // });
  const [exportCategoryId, setExportCategoryId] = useState<string>('');
  const [importCategoryId, setImportCategoryId] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[] | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [tagsDelimiter, setTagsDelimiter] = useState<string>('|');

  function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const out: string[][] = [];
    const parseLine = (line: string): string[] => {
      const res: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          res.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      res.push(cur);
      return res.map((s) => s.trim());
    };
    const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
    for (let i = 1; i < lines.length; i++) {
      out.push(parseLine(lines[i]).map((v) => v.replace(/^"|"$/g, '')));
    }
    return { headers, rows: out };
  }

  // Stats for sidebar badges
  const { data: stats = { total: 0, favorites: 0, categories: 0, tags: [] as string[] } } =
    useQuery<{
      total: number;
      favorites: number;
      categories: number;
      tags: string[];
      linkStats?: { total: number; working: number; broken: number; timeout: number; unknown: number };
    }>({ queryKey: ['/api/stats'] });

  return (
    <div className="flex h-screen overflow-hidden">
      <SEO title="Settings" description="Adjust theme, layout, defaults, export/import, and support options for your Memorize account." />
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
            <h1 className="text-xl font-semibold truncate">Settings</h1>
          </div>
          <div className="text-sm text-muted-foreground">Signed in as {user?.username}</div>
        </div>

        <div className="w-full p-6 space-y-6 overflow-x-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2 min-w-0">
                  <div className="font-medium">Contact Email</div>
                  <div className="text-sm text-muted-foreground">
                    Reach out for questions or support requests.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                  <a
                    href="mailto:nt.apple.it@gmail.com?subject=Memorize%20Support%20Request"
                    className="underline text-primary break-all"
                    title="Open your email client"
                  >
                    nt.apple.it@gmail.com
                  </a>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText('nt.apple.it@gmail.com');
                        toast({ description: 'Email copied to clipboard' });
                      } catch {
                        toast({ variant: 'destructive', description: 'Failed to copy email' });
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2 min-w-0">
                  <div className="font-medium">Donate</div>
                  <div className="text-sm text-muted-foreground">
                    I work independently as a freelancer, building free applications for the
                    community. Your kind donation helps me continue improving and keeping these
                    tools free for all. Thank you!
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                  <a
                    href="https://paypal.me/vensera2022"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button>
                      <span className="mr-2 inline-flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M9 2h6a5 5 0 0 1 0 10H12l-1 6H7L9 2z" fill="#003087" />
                          <path d="M13.5 4H18a4 4 0 1 1 0 8h-3.5l-1 6H9.5L11.5 4z" fill="#0070BA" />
                        </svg>
                      </span>
                      Donate via PayPal
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText('https://paypal.me/vensera2022');
                        toast({ description: 'Link copied to clipboard' });
                      } catch {
                        toast({ variant: 'destructive', description: 'Failed to copy link' });
                      }
                    }}
                  >
                    Copy Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2">
                  <div className="font-medium">Default Category</div>
                  <div className="text-sm text-muted-foreground">Applied when creating new bookmarks</div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Select
                    value={defaultCategoryId != null ? String(defaultCategoryId) : 'none'}
                    onValueChange={(val) =>
                      updatePreferencesMutation.mutate({
                        defaultCategoryId: val === 'none' ? null : Number(val),
                      })
                    }
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme toggle */}
              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2">
                  <div className="font-medium">Theme</div>
                  <div className="text-sm text-muted-foreground">Toggle between light and dark mode</div>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <SunIcon className={`h-4 w-4 ${theme === 'light' ? 'text-foreground' : 'text-muted-foreground'}`} />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    aria-label="Toggle dark mode"
                  />
                  <MoonIcon className={`h-4 w-4 ${theme === 'dark' ? 'text-foreground' : 'text-muted-foreground'}`} />
                </div>
              </div>

              <Separator />

              {/* Layout segmented control */}
              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2">
                  <div className="font-medium">Layout</div>
                  <div className="text-sm text-muted-foreground">Choose list or grid view</div>
                </div>
                <div className="flex sm:justify-end">
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(val) => {
                      if (val === 'list' || val === 'grid') {
                        updatePreferencesMutation.mutate({ viewMode: val });
                      }
                    }}
                    className="flex"
                  >
                    <ToggleGroupItem value="list" aria-label="List view">
                      <ListIcon className="h-4 w-4 mr-1" /> List
                    </ToggleGroupItem>
                    <ToggleGroupItem value="grid" aria-label="Grid view">
                      <GridIcon className="h-4 w-4 mr-1" /> Grid
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Change Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="New username"
                  />
                  <Button
                    onClick={() => updateUsernameMutation.mutate(newUsername)}
                    disabled={!newUsername || newUsername.trim().length < 3 || updateUsernameMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Change Password</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="New password (min 4)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      updatePasswordMutation.mutate({ currentPassword, newPassword })
                    }
                    disabled={
                      !currentPassword ||
                      newPassword.length < 4 ||
                      newPassword !== confirmPassword ||
                      updatePasswordMutation.isPending
                    }
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                  <div className="sm:col-span-2">
                    <div className="font-medium">Export Bookmarks</div>
                    <div className="text-sm text-muted-foreground">Download your data</div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                    <Select value={exportCategoryId || 'all'} onValueChange={setExportCategoryId}>
                      <SelectTrigger className="w-56" title="Scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const scope = exportCategoryId && exportCategoryId !== 'all' ? `&categoryId=${exportCategoryId}` : '';
                        const res = await fetch(`/api/bookmarks/export?format=json${scope}`, { credentials: 'include' });
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'bookmarks.json';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const scope = exportCategoryId && exportCategoryId !== 'all' ? `&categoryId=${exportCategoryId}` : '';
                        const res = await fetch(`/api/bookmarks/export?format=csv${scope}`, { credentials: 'include' });
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'bookmarks.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      CSV
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="font-medium">Import Bookmarks (JSON or CSV)</div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="text-sm">Target category:</label>
                    <select
                      className="border rounded-md px-3 py-2 bg-background"
                      value={importCategoryId}
                      onChange={(e) => setImportCategoryId(e.target.value)}
                    >
                      <option value="">Keep per-record / None</option>
                      <option value="uncategorized">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="file"
                      accept="application/json,.json,text/csv,.csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        if (file.name.toLowerCase().endsWith('.csv')) {
                          try {
                            const parsed = parseCsv(text);
                            setCsvHeaders(parsed.headers);
                            setCsvRows(parsed.rows);
                            // initialize mapping guesses
                            const guesses: Record<string, string> = {};
                            parsed.headers.forEach((h) => {
                              const key = h.toLowerCase();
                              if (key.includes('name') || key.includes('title')) guesses[h] = 'name';
                              else if (key.includes('url') || key.includes('link')) guesses[h] = 'url';
                              else if (key.includes('desc')) guesses[h] = 'description';
                              else if (key.includes('tag')) guesses[h] = 'tags';
                              else if (key.includes('fav')) guesses[h] = 'isFavorite';
                              else if (key.includes('category') || key === 'folder') guesses[h] = 'category';
                            });
                            setMapping(guesses);
                            toast({ description: 'CSV loaded. Map columns below.' });
                          } catch (err) {
                            toast({ variant: 'destructive', description: 'Invalid CSV file' });
                          }
                        } else {
                          try {
                            const data = JSON.parse(text);
                            const scope = importCategoryId ? `?categoryId=${importCategoryId}` : '';
                            await apiRequest('POST', `/api/bookmarks/import${scope}`, data);
                            toast({ description: 'Import completed' });
                            queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] });
                          } catch (err) {
                            toast({ variant: 'destructive', description: 'Invalid JSON file' });
                          }
                        }
                      }}
                    />
                  </div>

                  {csvHeaders && (
                    <div className="space-y-3 border rounded-md p-3">
                      <div className="text-sm font-medium">Map CSV columns</div>
                      <div className="grid md:grid-cols-2 gap-2">
                        {csvHeaders.map((h) => (
                          <div key={h} className="flex items-center justify-between gap-2">
                            <span className="text-sm">{h}</span>
                            <select
                              className="border rounded-md px-2 py-1 bg-background"
                              value={mapping[h] || ''}
                              onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                            >
                              <option value="">Ignore</option>
                              <option value="name">Name</option>
                              <option value="url">URL</option>
                              <option value="description">Description</option>
                              <option value="tags">Tags</option>
                              <option value="isFavorite">Is Favorite</option>
                              <option value="category">Category</option>
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Tags delimiter</Label>
                        <Input className="w-24" value={tagsDelimiter} onChange={(e) => setTagsDelimiter(e.target.value)} />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={async () => {
                            // Build JSON from mapping
                            const colIndex: Record<string, number> = {};
                            csvHeaders.forEach((h, idx) => {
                              const field = mapping[h];
                              if (field) colIndex[field] = idx;
                            });
                            const data = csvRows.map((row) => {
                              const name = colIndex.name != null ? row[colIndex.name] : '';
                              const url = colIndex.url != null ? row[colIndex.url] : '';
                              const description = colIndex.description != null ? row[colIndex.description] : '';
                              const tagsStr = colIndex.tags != null ? row[colIndex.tags] : '';
                              const category = colIndex.category != null ? row[colIndex.category] : '';
                              const favStr = colIndex.isFavorite != null ? row[colIndex.isFavorite] : '';
                              const tags = tagsStr ? tagsStr.split(tagsDelimiter).map((t) => t.trim()).filter(Boolean) : [];
                              const isFavorite = ['1', 'true', 'yes', 'y'].includes(String(favStr).toLowerCase());
                              return { name, url, description, tags, isFavorite, category };
                            }).filter((i) => i.name && i.url);
                            const scope = importCategoryId ? `?categoryId=${importCategoryId}` : '';
                            await apiRequest('POST', `/api/bookmarks/import${scope}`, data);
                            setCsvHeaders(null);
                            setCsvRows([]);
                            setMapping({});
                            toast({ description: 'CSV import completed' });
                            queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] });
                          }}
                        >
                          Import CSV
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                  <div className="sm:col-span-2">
                    <div className="font-medium">Session Timeout</div>
                    <div className="text-sm text-muted-foreground">Minutes of inactivity before logout (min 1)</div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      defaultValue={sessionTimeout}
                      onBlur={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '30', 10));
                        updatePreferencesMutation.mutate({ sessionTimeoutMinutes: v });
                      }}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>

                {/* <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Link Check Schedule</div>
                    <div className="text-sm text-muted-foreground">
                      Enable and configure background checks (min 1 min)
                      {linkStatus && (
                        <>
                          {' '}
                          • Status: {linkStatus.enabled ? (linkStatus.isChecking ? 'checking…' : linkStatus.isRunning ? 'scheduled' : 'idle') : 'off'}
                          {linkStatus.nextRunAt && (
                            <> • Next run {formatDistanceToNow(new Date(linkStatus.nextRunAt), { addSuffix: true })}</>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {linkStatus && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {linkStatus.lastRunAt && (
                        <span>
                          Last run: {new Date(linkStatus.lastRunAt).toLocaleString()} •
                        </span>
                      )}
                      {linkStatus.nextRunAt && (
                        <span className="ml-1">
                          Next run: {new Date(linkStatus.nextRunAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 items-center">
                    <Button
                      variant={linkEnabled ? 'default' : 'outline'}
                      onClick={() => updatePreferencesMutation.mutate({ linkCheckEnabled: true })}
                    >
                      On
                    </Button>
                    <Button
                      variant={!linkEnabled ? 'default' : 'outline'}
                      onClick={() => updatePreferencesMutation.mutate({ linkCheckEnabled: false })}
                    >
                      Off
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => runNowMutation.mutate()}
                      disabled={!linkEnabled || runNowMutation.isPending || linkStatus?.isChecking}
                      title={!linkEnabled ? 'Enable schedule first' : 'Run a check immediately'}
                    >
                      {runNowMutation.isPending || linkStatus?.isChecking ? 'Running…' : 'Run now'}
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      defaultValue={linkInterval}
                      onBlur={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '30', 10));
                        updatePreferencesMutation.mutate({ linkCheckIntervalMinutes: v });
                      }}
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      defaultValue={linkBatch}
                      onBlur={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '25', 10));
                        updatePreferencesMutation.mutate({ linkCheckBatchSize: v });
                      }}
                    />
                    <span className="text-sm text-muted-foreground">batch</span>
                  </div>
                </div> */}

              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2">
                  <div className="font-medium">Auto-tag Suggestions</div>
                  <div className="text-sm text-muted-foreground">Suggest tags when adding new bookmarks</div>
                </div>
                <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                  <Button
                    variant={autoTagEnabled ? 'default' : 'outline'}
                    onClick={() => updatePreferencesMutation.mutate({ autoTagSuggestionsEnabled: true })}
                  >
                    On
                  </Button>
                  <Button
                    variant={!autoTagEnabled ? 'default' : 'outline'}
                    onClick={() => updatePreferencesMutation.mutate({ autoTagSuggestionsEnabled: false })}
                  >
                    Off
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                <div className="sm:col-span-2">
                  <div className="font-medium">Use AI for Tagging</div>
                  <div className="text-sm text-muted-foreground">
                    Generate smarter tags using OpenAI. Requires server to be configured with an API key.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                  <Button
                    variant={aiTaggingEnabled ? 'default' : 'outline'}
                    onClick={() => updatePreferencesMutation.mutate({ aiTaggingEnabled: true })}
                  >
                    On
                  </Button>
                  <Button
                    variant={!aiTaggingEnabled ? 'default' : 'outline'}
                    onClick={() => updatePreferencesMutation.mutate({ aiTaggingEnabled: false })}
                  >
                    Off
                  </Button>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
