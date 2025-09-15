import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { ExternalLink, Calendar, Tag, Folder, Globe, ArrowLeft } from 'lucide-react';
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
  const [bookmark, setBookmark] = useState<(Bookmark & { category?: Category }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
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

  const timeAgo = formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={bookmark.name}
        description={
          bookmark.description
            ? bookmark.description.slice(0, 160)
            : `${bookmark.name} — ${bookmark.url}`
        }
        canonicalPath={`/shared/${params?.shareId}`}
        ogImage={bookmark.screenshotUrl || undefined}
      />
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1
                className="text-3xl font-bold text-foreground"
                data-testid="shared-bookmark-title"
              >
                {bookmark.name}
              </h1>
              <p className="text-sm text-muted-foreground">Shared bookmark • {timeAgo}</p>
            </div>
            <Button
              onClick={handleVisit}
              aria-label="Visit Website"
              title="Visit Website"
              variant="ghost"
              className="flex items-center justify-center gap-2 h-12 w-12 p-0 sm:h-11 sm:w-auto sm:px-4"
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
            <CardContent className="space-y-6">
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
                        {bookmark.url}
                      </p>
                      <p
                        className="text-xs text-muted-foreground mt-2"
                        data-testid="shared-bookmark-domain"
                      >
                        {getDomain(bookmark.url)}
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
                        alt={bookmark.name}
                        className="w-full h-auto object-cover"
                        loading="lazy"
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
    </div>
  );
}
