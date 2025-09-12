import { useState, useRef, useEffect } from "react";
import { Star, Globe, Edit, Trash2, ExternalLink, Lock, Eye, Share2, Copy, Camera, RefreshCw, AlertCircle, Image as ImageIcon, CheckCircle, XCircle, HelpCircle, Link } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Bookmark, Category } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BookmarkCardProps {
  bookmark: Bookmark & { category?: Category; hasPasscode?: boolean };
  onEdit?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  onView?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  onShare?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  onCopyShareLink?: (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => void;
  isProtected?: boolean;
  onUnlock?: () => void;
  onLock?: () => void;
  // Bulk selection props
  bulkMode?: boolean;
  isSelected?: boolean;
  onSelect?: (bookmarkId: number, isSelected: boolean) => void;
  // Passcode for protected bookmark operations
  passcode?: string;
  // Loading states
  isShareLoading?: boolean;
}

export function BookmarkCard({ 
  bookmark, 
  onEdit, 
  onView, 
  onShare, 
  onCopyShareLink,
  isProtected = false, 
  onUnlock, 
  onLock,
  bulkMode = false,
  isSelected = false,
  onSelect,
  passcode,
  isShareLoading = false
}: BookmarkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [thumbnailRetryCount, setThumbnailRetryCount] = useState(0);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Fetch screenshot status for this bookmark (for real-time updates)
  const { data: screenshotData, refetch: refetchScreenshot } = useQuery<{
    status: string;
    screenshotUrl?: string;
    updatedAt?: string;
  }>({
    queryKey: [`/api/bookmarks/${bookmark.id}/screenshot/status`],
    enabled: !isProtected && (
      bookmark.screenshotStatus === 'pending' || 
      thumbnailRetryCount > 0
    ),
    refetchInterval: (query) => (query.state.data?.status === 'pending') ? 3000 : false,
    staleTime: 30000,
  });

  // Use real-time data if available, otherwise use bookmark data
  const currentScreenshotUrl = screenshotData?.screenshotUrl || bookmark.screenshotUrl;
  const currentScreenshotStatus = screenshotData?.status || bookmark.screenshotStatus || 'idle';

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/bookmarks/${bookmark.id}`, {
        isFavorite: !bookmark.isFavorite
      });
    },
    onSuccess: () => {
      // Invalidate all bookmark queries regardless of parameters
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks"],
        exact: false 
      });
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
      // Include passcode in request body for protected bookmarks
      const body = bookmark.hasPasscode && passcode ? { passcode } : undefined;
      return await apiRequest("DELETE", `/api/bookmarks/${bookmark.id}`, body);
    },
    onSuccess: () => {
      // Invalidate all bookmark queries regardless of parameters
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks"],
        exact: false 
      });
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

  // Screenshot generation mutation
  const generateScreenshotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/bookmarks/${bookmark.id}/screenshot`);
    },
    onSuccess: () => {
      // Invalidate all bookmark queries regardless of parameters
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks"],
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: [`/api/bookmarks/${bookmark.id}/screenshot/status`] });
      setThumbnailRetryCount(prev => prev + 1);
      setTimeout(() => {
        refetchScreenshot();
      }, 2000);
    },
    onError: (error: any) => {
      console.error("Screenshot generation failed:", error);
      toast({
        variant: "destructive",
        description: "Failed to generate screenshot",
      });
    }
  });

  // Link checking mutation
  const checkLinkMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/bookmarks/${bookmark.id}/check-link`);
    },
    onSuccess: () => {
      // Invalidate all bookmark queries regardless of parameters
      queryClient.invalidateQueries({ 
        queryKey: ["/api/bookmarks"],
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        description: "Link status updated",
      });
    },
    onError: (error: any) => {
      console.error("Link check failed:", error);
      toast({
        variant: "destructive",
        description: "Failed to check link status",
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

  const handleGenerateScreenshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isProtected && currentScreenshotStatus !== 'pending') {
      generateScreenshotMutation.mutate();
    }
  };

  const handleCheckLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isProtected && !checkLinkMutation.isPending) {
      checkLinkMutation.mutate();
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
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

  // Helper function to get link status info
  const getLinkStatusInfo = () => {
    if (isProtected) {
      return {
        status: 'unknown',
        icon: HelpCircle,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/20',
        borderColor: 'border-muted-foreground/20',
        label: 'Unknown',
        tooltip: 'Status hidden for protected bookmark'
      };
    }

    const status = bookmark.linkStatus || 'unknown';
    const lastChecked = bookmark.lastLinkCheckAt;
    const lastCheckedText = lastChecked 
      ? `Last checked ${formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}`
      : 'Never checked';

    switch (status) {
      case 'ok':
        return {
          status: 'ok',
          icon: CheckCircle,
          color: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800',
          label: 'Working',
          tooltip: `Link is working • ${lastCheckedText}${bookmark.httpStatus ? ` • HTTP ${bookmark.httpStatus}` : ''}`
        };
      case 'broken':
        return {
          status: 'broken',
          icon: XCircle,
          color: 'text-red-700 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800',
          label: 'Broken',
          tooltip: `Link is broken • ${lastCheckedText}${bookmark.httpStatus ? ` • HTTP ${bookmark.httpStatus}` : ''}`
        };
      case 'timeout':
        return {
          status: 'timeout',
          icon: AlertCircle,
          color: 'text-orange-700 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          borderColor: 'border-orange-200 dark:border-orange-800',
          label: 'Timeout',
          tooltip: `Link timed out • ${lastCheckedText}`
        };
      case 'unknown':
      default:
        return {
          status: 'unknown',
          icon: HelpCircle,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/20',
          borderColor: 'border-muted-foreground/20',
          label: 'Unchecked',
          tooltip: lastCheckedText
        };
    }
  };

  const linkStatusInfo = getLinkStatusInfo();
  const StatusIcon = linkStatusInfo.icon;

  // Link Status Badge Component
  const LinkStatusBadge = () => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`text-xs ${linkStatusInfo.color} ${linkStatusInfo.bgColor} ${linkStatusInfo.borderColor}`}
              data-testid={`link-status-badge-${bookmark.id}`}
            >
              <StatusIcon size={10} className="mr-1" />
              {linkStatusInfo.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{linkStatusInfo.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Thumbnail component for different states
  const ThumbnailDisplay = () => {
    if (isProtected) {
      return (
        <div className="w-full h-32 bg-muted/40 rounded-md flex items-center justify-center" data-testid={`thumbnail-protected-${bookmark.id}`}>
          <Lock size={24} className="text-muted-foreground" />
        </div>
      );
    }

    // Show thumbnail if available and loaded
    if (currentScreenshotUrl && !imageError && isIntersecting) {
      return (
        <div className="relative w-full h-32 bg-muted/20 rounded-md overflow-hidden" data-testid={`thumbnail-container-${bookmark.id}`}>
          {!imageLoaded && (
            <Skeleton className="absolute inset-0 w-full h-full" />
          )}
          <img
            ref={imageRef}
            src={currentScreenshotUrl}
            alt={`Screenshot of ${bookmark.name}`}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
            data-testid={`thumbnail-image-${bookmark.id}`}
          />
          {currentScreenshotStatus === 'pending' && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <RefreshCw size={16} className="text-white animate-spin" />
            </div>
          )}
        </div>
      );
    }

    // Show different states
    const renderPlaceholder = () => {
      switch (currentScreenshotStatus) {
        case 'pending':
          return (
            <div className="w-full h-32 bg-muted/20 rounded-md flex flex-col items-center justify-center space-y-2" data-testid={`thumbnail-pending-${bookmark.id}`}>
              <RefreshCw size={20} className="text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground">Generating...</span>
            </div>
          );
        case 'failed':
          return (
            <div 
              className="w-full h-32 bg-muted/20 rounded-md flex flex-col items-center justify-center space-y-2 group/thumb cursor-pointer hover:bg-muted/30 transition-colors" 
              onClick={handleGenerateScreenshot}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGenerateScreenshot(e as any);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Retry screenshot generation"
              data-testid={`thumbnail-failed-${bookmark.id}`}
            >
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-muted-foreground" />
                <RefreshCw size={14} className="text-muted-foreground group-hover/thumb:rotate-180 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground text-center">Failed to generate<br/>Click to retry</span>
            </div>
          );
        case 'idle':
        default:
          return (
            <div 
              className="w-full h-32 bg-muted/20 rounded-md flex flex-col items-center justify-center space-y-2 group/thumb cursor-pointer hover:bg-muted/30 transition-colors" 
              onClick={handleGenerateScreenshot}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleGenerateScreenshot(e as any);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Generate screenshot preview"
              data-testid={`thumbnail-idle-${bookmark.id}`}
            >
              <div className="flex items-center space-x-2">
                <ImageIcon size={20} className="text-muted-foreground" />
                <Camera size={16} className="text-muted-foreground group-hover/thumb:scale-110 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground text-center">No preview<br/>Click to generate</span>
            </div>
          );
      }
    };

    return renderPlaceholder();
  };

  return (
    <Card 
      ref={cardRef}
      className={`group hover:shadow-md transition-shadow ${
        isProtected ? 'border-muted-foreground/20 bg-muted/20' : ''
      } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''} ${
        bulkMode ? 'cursor-pointer' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={bulkMode ? () => onSelect?.(bookmark.id, !isSelected) : undefined}
      data-testid={`bookmark-card-${bookmark.id}`}
    >
      <CardContent className="p-4">
        {/* Thumbnail Section */}
        <div className="mb-4">
          <ThumbnailDisplay />
        </div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            {bulkMode && (
              <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelect?.(bookmark.id, checked as boolean)}
                  data-testid={`checkbox-select-${bookmark.id}`}
                />
              </div>
            )}
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
          </div>
          
          <div className={`flex items-center space-x-1 transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-accent"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoriteMutation.mutate();
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              data-testid={`button-copy-${bookmark.id}`}
              title="Copy URL to clipboard"
            >
              <Copy size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 text-muted-foreground hover:text-blue-500 ${
                generateScreenshotMutation.isPending ? 'animate-pulse' : ''
              }`}
              onClick={handleGenerateScreenshot}
              disabled={generateScreenshotMutation.isPending || isProtected || currentScreenshotStatus === 'pending'}
              title={currentScreenshotStatus === 'pending' ? 'Generating screenshot...' : 'Generate screenshot'}
              data-testid={`button-screenshot-${bookmark.id}`}
            >
              {generateScreenshotMutation.isPending || currentScreenshotStatus === 'pending' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 text-muted-foreground hover:text-green-500 ${
                checkLinkMutation.isPending ? 'animate-pulse' : ''
              }`}
              onClick={handleCheckLink}
              disabled={checkLinkMutation.isPending || isProtected}
              title={checkLinkMutation.isPending ? 'Checking link...' : 'Check link now'}
              data-testid={`button-check-link-${bookmark.id}`}
            >
              {checkLinkMutation.isPending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Link size={16} />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(bookmark);
              }}
              disabled={isProtected}
              data-testid={`button-view-${bookmark.id}`}
            >
              <Eye size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(bookmark);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                onShare?.(bookmark);
              }}
              disabled={isProtected || bookmark.hasPasscode || isShareLoading}
              title={bookmark.hasPasscode ? "Protected bookmarks cannot be shared" : (bookmark.isShared ? "Stop sharing" : "Share bookmark")}
              data-testid={`button-share-${bookmark.id}`}
            >
              {isShareLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} className={bookmark.isShared ? 'fill-current' : ''} />
              )}
            </Button>
            {bookmark.isShared && bookmark.shareId && !isProtected && !bookmark.hasPasscode && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyShareLink?.(bookmark);
                }}
                title="Copy share link"
                data-testid={`button-copy-share-link-${bookmark.id}`}
              >
                <Link size={16} />
              </Button>
            )}
            {bookmark.hasPasscode && !isProtected && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onLock?.();
                }}
                data-testid={`button-lock-${bookmark.id}`}
              >
                <Lock size={16} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
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

        {!isProtected && (bookmark.tags?.length > 0 || bookmark.isShared || bookmark.linkStatus) && (
          <div className="flex flex-wrap gap-1 mb-3">
            <LinkStatusBadge />
            {bookmark.tags && bookmark.tags.map((tag, index) => (
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
            <LinkStatusBadge />
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
        
        {!isProtected && !bookmark.tags?.length && (bookmark.isShared || bookmark.linkStatus) && (
          <div className="flex flex-wrap gap-1 mb-3">
            <LinkStatusBadge />
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

        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto text-primary hover:text-primary/80 font-medium"
          onClick={(e) => {
            e.stopPropagation();
            handleVisit();
          }}
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
