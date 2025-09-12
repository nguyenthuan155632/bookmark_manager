import { useState } from "react";
import { Star, Globe, Edit, Trash2, ExternalLink, Lock, Eye, Share2, Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Bookmark, Category } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface BookmarkCardProps {
  bookmark: Bookmark & { category?: Category; hasPasscode?: boolean };
  onEdit?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  onView?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  onShare?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  isProtected?: boolean;
  onUnlock?: () => void;
  onLock?: () => void;
}

export function BookmarkCard({ bookmark, onEdit, onView, onShare, isProtected = false, onUnlock, onLock }: BookmarkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/bookmarks/${bookmark.id}`, {
        isFavorite: !bookmark.isFavorite
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        description: bookmark.isFavorite 
          ? "Removed from favorites" 
          : "Added to favorites",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to update favorite status",
      });
    }
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/bookmarks/${bookmark.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        description: "Bookmark deleted",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to delete bookmark",
      });
    }
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this bookmark?")) {
      deleteBookmarkMutation.mutate();
    }
  };

  const handleVisit = () => {
    if (isProtected) {
      // Protected and locked - show unlock
      onUnlock?.();
    } else {
      // Unlocked (regardless of hasPasscode) - visit the URL
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      toast({
        description: "URL copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to copy URL",
      });
    }
  };

  const timeAgo = isProtected ? "—" : formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true });

  return (
    <Card 
      className={`group hover:shadow-md transition-shadow ${
        isProtected ? 'border-muted-foreground/20 bg-muted/20' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`bookmark-card-${bookmark.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isProtected && (
                <Lock size={14} className="text-muted-foreground flex-shrink-0" data-testid={`lock-icon-${bookmark.id}`} />
              )}
              <h3 className="font-medium text-foreground line-clamp-2" data-testid={`bookmark-title-${bookmark.id}`}>
                {isProtected ? "••• Protected Bookmark •••" : bookmark.name}
              </h3>
            </div>
            {isProtected ? (
              <p className="text-sm text-muted-foreground italic line-clamp-2" data-testid={`bookmark-protected-text-${bookmark.id}`}>
                Protected content - click to unlock
              </p>
            ) : (
              bookmark.description && (
                <div className="text-sm text-muted-foreground line-clamp-2" data-testid={`bookmark-description-${bookmark.id}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <span className="inline">{children}</span>,
                      h1: ({ children }) => <span className="font-semibold">{children}</span>,
                      h2: ({ children }) => <span className="font-semibold">{children}</span>,
                      h3: ({ children }) => <span className="font-semibold">{children}</span>,
                      h4: ({ children }) => <span className="font-semibold">{children}</span>,
                      h5: ({ children }) => <span className="font-semibold">{children}</span>,
                      h6: ({ children }) => <span className="font-semibold">{children}</span>,
                      strong: ({ children }) => <span className="font-bold">{children}</span>,
                      em: ({ children }) => <span className="italic">{children}</span>,
                      code: ({ children }) => <span className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</span>,
                      a: ({ children, href }) => <span className="text-primary underline">{children}</span>,
                      ul: ({ children }) => <span className="inline">{children}</span>,
                      ol: ({ children }) => <span className="inline">{children}</span>,
                      li: ({ children }) => <span className="inline">{children} • </span>,
                      pre: () => null, // Hide code blocks in card preview
                      blockquote: ({ children }) => <span className="italic border-l-2 border-primary/30 pl-2">{children}</span>
                    }}
                  >
                    {bookmark.description}
                  </ReactMarkdown>
                </div>
              )
            )}
          </div>
          
          <div className={`flex items-center space-x-1 transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-accent"
              onClick={() => toggleFavoriteMutation.mutate()}
              disabled={toggleFavoriteMutation.isPending || isProtected}
              data-testid={`button-favorite-${bookmark.id}`}
            >
              <Star
                size={16}
                className={isProtected ? "" : (bookmark.isFavorite ? "fill-current text-accent" : "")}
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-green-500"
              onClick={handleCopy}
              disabled={isProtected}
              data-testid={`button-copy-${bookmark.id}`}
              title="Copy URL to clipboard"
            >
              <Copy size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onView?.(bookmark)}
              disabled={isProtected}
              data-testid={`button-view-${bookmark.id}`}
            >
              <Eye size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit?.(bookmark)}
              disabled={isProtected}
              data-testid={`button-edit-${bookmark.id}`}
            >
              <Edit size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 text-muted-foreground hover:text-blue-500 ${
                bookmark.isShared ? 'text-blue-500' : ''
              }`}
              onClick={() => onShare?.(bookmark)}
              disabled={isProtected || bookmark.hasPasscode}
              title={bookmark.hasPasscode ? "Protected bookmarks cannot be shared" : (bookmark.isShared ? "Stop sharing" : "Share bookmark")}
              data-testid={`button-share-${bookmark.id}`}
            >
              <Share2 size={16} className={bookmark.isShared ? 'fill-current' : ''} />
            </Button>
            {bookmark.hasPasscode && !isProtected && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500"
                onClick={() => onLock?.()}
                data-testid={`button-lock-${bookmark.id}`}
              >
                <Lock size={16} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteBookmarkMutation.isPending || isProtected}
              data-testid={`button-delete-${bookmark.id}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-3">
          <Globe size={12} />
          <span className="truncate" data-testid={`bookmark-domain-${bookmark.id}`}>
            {isProtected ? "••••••••" : getDomain(bookmark.url)}
          </span>
          <span>•</span>
          <span data-testid={`bookmark-date-${bookmark.id}`}>{timeAgo}</span>
        </div>

        {!isProtected && bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {bookmark.tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs hover:bg-secondary/80 cursor-pointer"
                data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}-${bookmark.id}`}
              >
                {tag}
              </Badge>
            ))}
            {bookmark.isShared && (
              <Badge
                variant="outline"
                className="text-xs text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950"
                data-testid={`shared-badge-${bookmark.id}`}
              >
                <Share2 size={10} className="mr-1" />
                Shared
              </Badge>
            )}
          </div>
        )}
        
        {isProtected && (
          <div className="flex flex-wrap gap-1 mb-3">
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground border-muted-foreground/30"
              data-testid={`protected-badge-${bookmark.id}`}
            >
              <Lock size={10} className="mr-1" />
              Protected
            </Badge>
          </div>
        )}
        
        {!isProtected && !bookmark.tags?.length && bookmark.isShared && (
          <div className="flex flex-wrap gap-1 mb-3">
            <Badge
              variant="outline"
              className="text-xs text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950"
              data-testid={`shared-badge-${bookmark.id}`}
            >
              <Share2 size={10} className="mr-1" />
              Shared
            </Badge>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto text-primary hover:text-primary/80 font-medium"
          onClick={handleVisit}
          data-testid={isProtected ? `button-unlock-${bookmark.id}` : `button-visit-${bookmark.id}`}
        >
          {isProtected ? (
            // Protected and locked - show unlock
            <>
              <span>Unlock</span>
              <Lock size={12} className="ml-1" />
            </>
          ) : (
            // Unlocked (or never protected) - show visit
            <>
              <span>Visit</span>
              <ExternalLink size={12} className="ml-1" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
