import { ExternalLink, Calendar, Tag, Folder, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Bookmark, Category } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';

interface BookmarkDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark & { category?: Category; hasPasscode?: boolean };
}

export function BookmarkDetailsModal({ isOpen, onClose, bookmark }: BookmarkDetailsModalProps) {
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

  if (!bookmark) {
    return null;
  }

  const timeAgo = formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="modal-bookmark-details"
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-xl"
            data-testid="bookmark-details-title"
          >
            {bookmark.hasPasscode && (
              <Lock size={18} className="text-muted-foreground flex-shrink-0" />
            )}
            <span className="line-clamp-2">{bookmark.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ExternalLink size={14} />
                <span className="font-medium">Website</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVisit}
                className="flex items-center gap-2"
                data-testid="button-visit-bookmark"
              >
                <span>Visit</span>
                <ExternalLink size={12} />
              </Button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-mono break-all" data-testid="bookmark-url">
                {bookmark.url}
              </p>
              <p className="text-xs text-muted-foreground mt-1" data-testid="bookmark-domain">
                {getDomain(bookmark.url)}
              </p>
            </div>
          </div>

          {/* Description Section */}
          {bookmark.description && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Description</span>
                </div>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-a:text-primary prose-strong:text-foreground prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-sm prose-blockquote:border-l-primary prose-li:text-sm"
                  data-testid="bookmark-description-rendered"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{bookmark.description}</ReactMarkdown>
                </div>
              </div>
            </>
          )}

          {/* Tags Section */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag size={14} />
                  <span className="font-medium">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bookmark.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs"
                      data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}-details`}
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Folder size={14} />
                  <span className="font-medium">Folder</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-sm"
                  data-testid="bookmark-category-details"
                >
                  {bookmark.category.name}
                </Badge>
              </div>
            </>
          )}

          {/* Metadata Section */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={14} />
              <span className="font-medium">Details</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium" data-testid="bookmark-created-date">
                  {timeAgo}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Favorite:</span>
                <p className="font-medium" data-testid="bookmark-favorite-status">
                  {bookmark.isFavorite ? 'Yes' : 'No'}
                </p>
              </div>
              {bookmark.hasPasscode && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Protection:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Lock size={10} className="mr-1" />
                      Protected with passcode
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
