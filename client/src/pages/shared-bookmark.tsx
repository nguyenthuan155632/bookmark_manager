import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { ExternalLink, Calendar, Tag, Folder, Globe, ArrowLeft, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Bookmark, Category } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';
import { SEO } from '@/lib/seo';

export function SharedBookmark() {
  const [, params] = useRoute('/shared/:shareId');
  const [bookmark, setBookmark] = useState<
    | (Partial<Bookmark> & { category?: Category | { name: string } | null; hasPasscode?: boolean })
    | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (!params?.shareId) {
      setError('Invalid share link');
      setIsLoading(false);
      return;
    }

    const fetchSharedBookmark = async () => {
      try {
        const response = await fetch(`/api/shared/${params.shareId}`);

        if (response.status === 404) {
          setError('Bookmark not found or is no longer shared');
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load bookmark');
        }

        const data = await response.json();
        setBookmark(data);
        if (data?.hasPasscode) {
          setIsUnlockOpen(true);
        }
      } catch (err) {
        console.error('Error fetching shared bookmark:', err);
        setError('Failed to load bookmark');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedBookmark();
  }, [params?.shareId]);

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleVisit = () => {
    if (bookmark) {
      if (!bookmark.url) return;
      window.open(bookmark.url as string, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">{error || 'Bookmark not found'}</h1>
          <p className="text-muted-foreground">
            This bookmark may have been removed or is no longer shared.
          </p>
          <Button onClick={handleBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const timeAgo = bookmark?.createdAt
    ? formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true })
    : '';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={bookmark.name || 'Protected Bookmark'}
        description={
          bookmark.description
            ? bookmark.description.slice(0, 160)
            : bookmark.url
              ? `${bookmark.name || 'Protected Bookmark'} — ${bookmark.url}`
              : 'This shared bookmark is protected with a passcode.'
        }
        canonicalPath={`/shared/${params?.shareId}`}
        ogImage={bookmark.screenshotUrl || undefined}
      />
      <div className="container max-w-4xl mx-auto px-3 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground"
                data-testid="shared-bookmark-title"
              >
                {bookmark.name || 'Protected Bookmark'}
              </h1>
              <p className="text-sm text-muted-foreground">Shared bookmark • {timeAgo}</p>
            </div>
            <Button
              onClick={handleVisit}
              aria-label="Visit Website"
              title="Visit Website"
              variant="ghost"
              className="flex items-center justify-center gap-2 h-12 w-12 p-0 sm:h-11 sm:w-auto sm:px-4"
              disabled={!bookmark.url}
              data-testid="button-visit-shared-bookmark"
            >
              <span className="hidden sm:inline">Visit Website</span>
              <ExternalLink size={18} />
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe size={18} />
                Website Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-4 md:px-6">
              {/* URL + Thumbnail row (thumbnail on the right, above the first separator) */}
              <div className="md:flex md:items-start md:gap-6">
                {/* URL Section */}
                <div className="flex-1">
                  <div className="space-y-2">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p
                        className="text-sm font-mono break-all text-foreground"
                        data-testid="shared-bookmark-url"
                      >
                        {bookmark.url || '••••••••'}
                      </p>
                      <p
                        className="text-xs text-muted-foreground mt-2"
                        data-testid="shared-bookmark-domain"
                      >
                        {bookmark.url ? getDomain(bookmark.url as string) : ''}
                      </p>
                    </div>
                  </div>
                </div>
                {bookmark.screenshotUrl && (
                  <div className="mt-3 md:mt-0 w-full md:w-40 lg:w-56 xl:w-64 md:shrink-0">
                    <div className="rounded-md border bg-muted/20 overflow-hidden">
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img
                        src={bookmark.screenshotUrl}
                        alt={`Screenshot of ${bookmark.name} - ${bookmark.description || 'shared bookmark preview'}`}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        data-testid="shared-bookmark-screenshot"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description Section */}
              {bookmark.description && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-medium text-foreground">Description</h3>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-a:text-primary prose-strong:text-foreground prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-sm prose-blockquote:border-l-primary prose-li:text-sm"
                      data-testid="shared-bookmark-description"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {bookmark.description}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              )}

              {/* Tags Section */}
              {bookmark.tags && bookmark.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Tag size={16} />
                      <h3 className="font-medium text-foreground">Tags</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bookmark.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                          data-testid={`shared-tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Category Section */}
              {bookmark.category && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Folder size={16} />
                      <h3 className="font-medium text-foreground">Category</h3>
                    </div>
                    <Badge variant="outline" data-testid="shared-bookmark-category">
                      {bookmark.category.name}
                    </Badge>
                  </div>
                </>
              )}

              {/* Metadata */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <h3 className="font-medium text-foreground">Details</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">Shared:</span> {timeAgo}
                  </p>
                  {bookmark?.hasPasscode && (
                    <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Lock size={14} /> Protected — No passcode required
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              This bookmark was shared publicly. Create your own bookmark manager to organize and
              share your links.
            </p>
          </div>
        </div>
      </div>
      {/* Unlock modal */}
      {isUnlockOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-md shadow-xl w-full max-w-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={18} className="text-muted-foreground" />
              <h3 className="font-medium">Protected Share</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Enter the bookmark passcode to view this shared content.
            </p>
            <input
              type="password"
              className="w-full border rounded px-3 py-2 mb-2 bg-background"
              placeholder="Passcode"
              value={unlockPasscode}
              onChange={(e) => {
                setUnlockPasscode(e.target.value);
                setUnlockError('');
              }}
              disabled={isUnlocking}
            />
            {unlockError && <div className="text-sm text-destructive mb-2">{unlockError}</div>}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsUnlockOpen(false)}
                disabled={isUnlocking}
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  setIsUnlocking(true);
                  setUnlockError('');
                  try {
                    const res = await fetch(`/api/shared/${params?.shareId}/verify-passcode`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ passcode: unlockPasscode }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.valid) {
                      setUnlockError('Incorrect passcode. Please try again.');
                    } else {
                      setBookmark(json.bookmark);
                      setIsUnlockOpen(false);
                      setUnlockPasscode('');
                    }
                  } catch (e) {
                    setUnlockError('Failed to verify passcode');
                  } finally {
                    setIsUnlocking(false);
                  }
                }}
                disabled={isUnlocking || !unlockPasscode}
              >
                {isUnlocking ? 'Verifying…' : 'Unlock'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
