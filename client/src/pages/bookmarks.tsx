import { useState, useMemo, useEffect } from "react";
import {
  Menu,
  Search,
  Grid,
  List,
  Plus,
  Moon,
  Sun,
  Filter,
  X,
  LogOut,
  CheckSquare,
  Square,
  CheckCircle,
  XCircle,
  HelpCircle,
  Link,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { BookmarkCard } from "@/components/bookmark-card";
import { AddBookmarkModal } from "@/components/add-bookmark-modal";
import { AddCategoryModal } from "@/components/add-category-modal";
import { PasscodeModal } from "@/components/passcode-modal";
import { BookmarkDetailsModal } from "@/components/bookmark-details-modal";
import { BulkActionToolbar } from "@/components/bulk-action-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { Bookmark, Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function BookmarksContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<any>(null);
  const [viewingBookmark, setViewingBookmark] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLinkStatus, setSelectedLinkStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "isFavorite">(
    "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Passcode modal state
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [selectedProtectedBookmark, setSelectedProtectedBookmark] = useState<
    (Bookmark & { category?: Category; hasPasscode?: boolean }) | null
  >(null);

  // Track unlocked bookmarks in session (bookmark IDs that have been unlocked)
  const [unlockedBookmarks, setUnlockedBookmarks] = useState<Set<number>>(
    new Set(),
  );

  // Store passcodes for unlocked protected bookmarks
  const [unlockedPasscodes, setUnlockedPasscodes] = useState<Record<number, string>>({});

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPasscodes, setBulkPasscodes] = useState<Record<string, string>>({});
  const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  const { logoutMutation } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch preferences from database
  const { data: preferences } = useQuery<{
    theme?: "light" | "dark";
    viewMode?: "grid" | "list";
  }>({
    queryKey: ["/api/preferences"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: {
      theme?: "light" | "dark";
      viewMode?: "grid" | "list";
    }) => {
      return await apiRequest("PATCH", "/api/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    },
  });

  const [location] = useLocation();
  const [match, params] = useRoute("/category/:id");

  // Initialize view mode from database preferences
  useEffect(() => {
    if (preferences?.viewMode) {
      setViewMode(preferences.viewMode);
    }
  }, [preferences]);

  // Extract category ID from URL and handle special routes
  useEffect(() => {
    if (match && params?.id) {
      setSelectedCategory(params.id);
    } else {
      setSelectedCategory("");
    }
  }, [match, params, location]);

  // Handle view mode change with database persistence
  const handleSetViewMode = (newViewMode: "grid" | "list") => {
    setViewMode(newViewMode);
    updatePreferencesMutation.mutate({ viewMode: newViewMode });
  };

  // Fetch stats
  const { data: stats } = useQuery<{
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
    linkStats?: {
      total: number;
      working: number;
      broken: number;
      timeout: number;
      unknown: number;
    };
  }>({
    queryKey: ["/api/stats"],
  });

  // Fetch bookmarks with filters

  const { data: bookmarks = [], isLoading } = useQuery<
    (Bookmark & { category?: Category; hasPasscode?: boolean })[]
  >({
    queryKey: ["/api/bookmarks", {
      search: searchQuery || undefined,
      categoryId: selectedCategory || undefined,
      tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
      linkStatus: selectedLinkStatus || undefined,
      isFavorite: location === "/favorites" ? "true" : undefined,
      sortBy,
      sortOrder
    }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, Record<string, any>];
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, String(value));
        }
      });

      const url = `/api/bookmarks${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }

      return response.json();
    },
  });

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((bookmark) => {
      if (selectedTags.length > 0) {
        return selectedTags.some((tag) =>
          bookmark.tags?.some((bookmarkTag) =>
            bookmarkTag.toLowerCase().includes(tag.toLowerCase()),
          ),
        );
      }
      return true;
    });
  }, [bookmarks, selectedTags]);

  const handleEdit = (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    setEditingBookmark(bookmark);
    setIsAddModalOpen(true);
  };

  const handleView = (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    setViewingBookmark(bookmark);
  };

  // Handle protected bookmark unlock
  const handleUnlockBookmark = (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    setSelectedProtectedBookmark(bookmark);
    setIsPasscodeModalOpen(true);
  };

  // Handle protected bookmark lock
  const handleLockBookmark = (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    // Remove bookmark ID from unlocked set to lock it again
    setUnlockedBookmarks((prev) => {
      const newSet = new Set(prev);
      newSet.delete(bookmark.id);
      return newSet;
    });
    // Remove stored passcode
    setUnlockedPasscodes((prev) => {
      const { [bookmark.id]: removed, ...rest } = prev;
      return rest;
    });
  };

  // Share bookmark mutation
  const shareBookmarkMutation = useMutation({
    mutationFn: async ({ bookmarkId, isShared }: { bookmarkId: number; isShared: boolean }): Promise<Bookmark> => {
      const response = await apiRequest("PATCH", `/api/bookmarks/${bookmarkId}/share`, {
        isShared
      });
      return response.json();
    },
    onMutate: async ({ bookmarkId, isShared }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/bookmarks"] });

      // Snapshot the previous value for rollback on error
      const previousBookmarks = queryClient.getQueryData(["/api/bookmarks", {
        search: searchQuery || undefined,
        categoryId: selectedCategory || undefined,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
        linkStatus: selectedLinkStatus || undefined,
        isFavorite: location === "/favorites" ? "true" : undefined,
        sortBy,
        sortOrder
      }]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/bookmarks", {
        search: searchQuery || undefined,
        categoryId: selectedCategory || undefined,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
        linkStatus: selectedLinkStatus || undefined,
        isFavorite: location === "/favorites" ? "true" : undefined,
        sortBy,
        sortOrder
      }], (old: any) => {
        if (!old) return old;
        return old.map((bookmark: any) =>
          bookmark.id === bookmarkId
            ? { ...bookmark, isShared, shareId: isShared ? (bookmark.shareId || 'pending') : null }
            : bookmark
        );
      });

      // Return a context object with the snapshotted value
      return { previousBookmarks };
    },
    onError: (error: any, { bookmarkId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBookmarks) {
        queryClient.setQueryData(["/api/bookmarks", {
          search: searchQuery || undefined,
          categoryId: selectedCategory || undefined,
          tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
          linkStatus: selectedLinkStatus || undefined,
          isFavorite: location === "/favorites" ? "true" : undefined,
          sortBy,
          sortOrder
        }], context.previousBookmarks);
      }

      const errorMessage = error?.response?.data?.message || "Failed to update bookmark sharing";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    },
    onSuccess: (updatedBookmark: Bookmark) => {
      // Update the cache with the actual server response
      queryClient.setQueryData(["/api/bookmarks", {
        search: searchQuery || undefined,
        categoryId: selectedCategory || undefined,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
        linkStatus: selectedLinkStatus || undefined,
        isFavorite: location === "/favorites" ? "true" : undefined,
        sortBy,
        sortOrder
      }], (old: any) => {
        if (!old) return old;
        return old.map((bookmark: any) =>
          bookmark.id === updatedBookmark.id ? { ...bookmark, ...updatedBookmark } : bookmark
        );
      });

      // Also invalidate all bookmark queries to ensure consistency across different views
      queryClient.invalidateQueries({
        queryKey: ["/api/bookmarks"],
        exact: false
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      if (updatedBookmark.isShared && updatedBookmark.shareId) {
        // Copy share URL to clipboard
        const shareUrl = `${window.location.origin}/shared/${updatedBookmark.shareId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast({
            description: "Share link copied to clipboard! Bookmark is now public.",
          });
        }).catch(() => {
          toast({
            description: `Bookmark is now shared! Share URL: ${shareUrl}`,
          });
        });
      } else {
        toast({
          description: "Bookmark sharing disabled",
        });
      }
    }
  });

  const handleShare = (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    // Toggle sharing status
    const newSharingStatus = !bookmark.isShared;
    shareBookmarkMutation.mutate({
      bookmarkId: bookmark.id,
      isShared: newSharingStatus
    });
  };

  // Copy share link for already shared bookmarks
  const handleCopyShareLink = async (
    bookmark: Bookmark & { category?: Category; hasPasscode?: boolean },
  ) => {
    if (!bookmark.isShared || !bookmark.shareId) {
      toast({
        variant: "destructive",
        description: "This bookmark is not shared or has no share ID",
      });
      return;
    }

    const shareUrl = `${window.location.origin}/shared/${bookmark.shareId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        description: "Share link copied to clipboard!",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      toast({
        description: `Share URL: ${shareUrl}`,
      });
    }
  };

  // Bulk link checking mutation
  const bulkCheckLinksMutation = useMutation({
    mutationFn: async ({ ids, passcodes }: { ids?: number[]; passcodes?: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/bookmarks/bulk/check-links", {
        ids: ids || [],
        passcodes
      });
      const data = await response.json();
      return {
        checked: data.checkedIds.length,
        results: data.failed
      };
    },
    onSuccess: (result: { checked: number; results: any[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        description: `Checked ${result.checked} bookmark(s)`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to check links";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    }
  });

  // Bulk operations mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, passcodes }: { ids: number[]; passcodes?: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/bookmarks/bulk/delete", {
        ids,
        passcodes
      });
      return response.json();
    },
    onSuccess: (result: { deletedIds: number[]; failed: { id: number; reason: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      // Clear selections and exit bulk mode
      setSelectedIds([]);
      setBulkPasscodes({});

      const { deletedIds, failed } = result;
      if (deletedIds.length > 0) {
        toast({
          description: `Successfully deleted ${deletedIds.length} bookmark(s)`,
        });
      }

      if (failed.length > 0) {
        toast({
          variant: "destructive",
          description: `Failed to delete ${failed.length} bookmark(s): ${failed.map(f => f.reason).join(", ")}`,
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to delete bookmarks";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    }
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, categoryId, passcodes }: { ids: number[]; categoryId: number | null; passcodes?: Record<string, string> }) => {
      const response = await apiRequest("PATCH", "/api/bookmarks/bulk/move", {
        ids,
        categoryId,
        passcodes
      });
      return response.json();
    },
    onSuccess: (result: { movedIds: number[]; failed: { id: number; reason: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      // Clear selections and exit bulk mode
      setSelectedIds([]);
      setBulkPasscodes({});

      const { movedIds, failed } = result;
      if (movedIds.length > 0) {
        toast({
          description: `Successfully moved ${movedIds.length} bookmark(s)`,
        });
      }

      if (failed.length > 0) {
        toast({
          variant: "destructive",
          description: `Failed to move ${failed.length} bookmark(s): ${failed.map(f => f.reason).join(", ")}`,
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to move bookmarks";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    }
  });

  // Bulk selection handlers
  const handleBulkModeToggle = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      // Exiting bulk mode - clear selections
      setSelectedIds([]);
      setBulkPasscodes({});
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredBookmarks.length) {
      // Deselect all
      setSelectedIds([]);
    } else {
      // Select all
      setSelectedIds(filteredBookmarks.map(b => b.id));
    }
  };

  const handleSelectBookmark = (bookmarkId: number, isSelected: boolean) => {
    if (isSelected) {
      setSelectedIds(prev => [...prev, bookmarkId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== bookmarkId));
      // Remove passcode if unselecting
      setBulkPasscodes(prev => {
        const { [bookmarkId.toString()]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    confirmBulkDelete();
  };

  const confirmBulkDelete = () => {
    if (selectedIds.length === 0) return;

    setIsBulkOperationLoading(true);
    bulkDeleteMutation.mutate(
      { ids: selectedIds, passcodes: Object.keys(bulkPasscodes).length > 0 ? bulkPasscodes : undefined },
      {
        onSettled: () => {
          setIsBulkOperationLoading(false);
        }
      }
    );
  };

  const handleBulkMove = (categoryId: number | null) => {
    if (selectedIds.length === 0) return;

    setIsBulkOperationLoading(true);
    bulkMoveMutation.mutate(
      { ids: selectedIds, categoryId, passcodes: Object.keys(bulkPasscodes).length > 0 ? bulkPasscodes : undefined },
      {
        onSettled: () => {
          setIsBulkOperationLoading(false);
        }
      }
    );
  };

  // Handle successful passcode verification
  const handlePasscodeSuccess = (passcode: string) => {
    if (selectedProtectedBookmark) {
      // Add bookmark ID to unlocked set
      setUnlockedBookmarks(
        (prev) =>
          new Set(Array.from(prev).concat(selectedProtectedBookmark.id)),
      );

      // Store the verified passcode for future operations
      setUnlockedPasscodes((prev) => ({
        ...prev,
        [selectedProtectedBookmark.id]: passcode,
      }));

      // Close modal and clear selected bookmark
      setIsPasscodeModalOpen(false);
      setSelectedProtectedBookmark(null);
    }
  };

  // Handle passcode modal close
  const handlePasscodeModalClose = () => {
    setIsPasscodeModalOpen(false);
    setSelectedProtectedBookmark(null);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingBookmark(null);
  };

  const handleCloseViewModal = () => {
    setViewingBookmark(null);
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleBulkCheckLinks = () => {
    if (selectedIds.length > 0) {
      // Check only selected bookmarks
      bulkCheckLinksMutation.mutate({ ids: selectedIds, passcodes: bulkPasscodes });
    } else {
      // Check all bookmarks
      bulkCheckLinksMutation.mutate({ ids: [] }); // Empty array means check all
    }
  };

  // Helper function to get link status info for filtering
  const getLinkStatusDisplayInfo = (status: string) => {
    switch (status) {
      case 'ok':
        return {
          label: 'Working Links',
          icon: CheckCircle,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'broken':
        return {
          label: 'Broken Links',
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'timeout':
        return {
          label: 'Timeout Links',
          icon: AlertCircle,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          borderColor: 'border-orange-200 dark:border-orange-800'
        };
      case 'unknown':
        return {
          label: 'Unchecked Links',
          icon: HelpCircle,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedTags([]);
    setSelectedLinkStatus("");
  };

  const hasActiveFilters =
    searchQuery || selectedCategory || selectedTags.length > 0 || selectedLinkStatus;

  if (!stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-foreground mb-2">Memorize</h2>
          <p className="text-sm text-muted-foreground">
            Loading your bookmarks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onCreateFolder={() => setIsAddCategoryModalOpen(true)}
        stats={stats}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="bg-card border-b border-border px-6 py-4"
          data-testid="header"
        >
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="relative flex-1 max-w-4xl">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  placeholder="Search anything"
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                size="sm"
                variant={bulkMode ? "default" : "outline"}
                onClick={handleBulkModeToggle}
                data-testid="button-bulk-mode-toggle"
              >
                {bulkMode ? <CheckSquare size={16} /> : <Square size={16} />}
                <span className="ml-2">Bulk Select</span>
              </Button>

              <div className="flex items-center bg-muted rounded-md p-1">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  className="p-2 border-solid"
                  onClick={() => handleSetViewMode("grid")}
                  data-testid="button-grid-view"
                >
                  <Grid size={16} />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  className="p-2"
                  onClick={() => handleSetViewMode("list")}
                  data-testid="button-list-view"
                >
                  <List size={16} />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                data-testid="button-theme-toggle"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                title="Logout"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden space-y-3">
            {/* Top Row: Menu + Theme */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                data-testid="button-mobile-menu"
              >
                <Menu size={20} />
              </Button>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  data-testid="button-theme-toggle"
                >
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                  title="Logout"
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>

            {/* Bottom Section: Search Bar */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                placeholder="Search anything"
                className="pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div
          className="bg-card border-b border-border px-6 py-3"
          data-testid="filter-bar"
        >
          {/* Desktop Layout - Single Line */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {/* Link Status Filter Dropdown */}
                <Select
                  value={selectedLinkStatus}
                  onValueChange={setSelectedLinkStatus}
                >
                  <SelectTrigger className="w-40" data-testid="select-link-status">
                    <SelectValue placeholder="Link Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center space-x-2">
                        <Filter size={14} className="text-muted-foreground" />
                        <span>All Links</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ok">
                      <div className="flex items-center space-x-2">
                        <CheckCircle size={14} className="text-green-600" />
                        <span>Working</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="broken">
                      <div className="flex items-center space-x-2">
                        <XCircle size={14} className="text-red-600" />
                        <span>Broken</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="timeout">
                      <div className="flex items-center space-x-2">
                        <AlertCircle size={14} className="text-orange-600" />
                        <span>Timeout</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="unknown">
                      <div className="flex items-center space-x-2">
                        <HelpCircle size={14} className="text-gray-600" />
                        <span>Unchecked</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Active Link Status Filter Badge */}
                {selectedLinkStatus && (() => {
                  const statusInfo = getLinkStatusDisplayInfo(selectedLinkStatus);
                  if (!statusInfo) return null;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <Badge
                      className={`${statusInfo.color} ${statusInfo.bgColor} ${statusInfo.borderColor} flex items-center space-x-1 border`}
                      data-testid={`active-filter-link-status-${selectedLinkStatus}`}
                    >
                      <StatusIcon size={12} />
                      <span>{statusInfo.label}</span>
                      <button
                        onClick={() => setSelectedLinkStatus("")}
                        className="text-current/80 hover:text-current"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  );
                })()}

                {/* Active Tags */}
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary text-primary-foreground flex items-center space-x-1"
                    data-testid={`active-filter-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-primary-foreground/80 hover:text-primary-foreground"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                    data-testid="button-clear-filters"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Bulk Check Links Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkCheckLinks}
                disabled={bulkCheckLinksMutation.isPending}
                className="flex items-center space-x-2"
                data-testid="button-bulk-check-links"
                title={selectedIds.length > 0 ? `Check ${selectedIds.length} selected links` : "Check all links"}
              >
                {bulkCheckLinksMutation.isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Link size={14} />
                )}
                <span>{selectedIds.length > 0 ? `Check ${selectedIds.length}` : "Check All"}</span>
              </Button>

              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [newSortBy, newSortOrder] = value.split("-") as [
                    typeof sortBy,
                    typeof sortOrder,
                  ];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
              >
                <SelectTrigger className="w-56" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">
                    Sort by Date Added
                  </SelectItem>
                  <SelectItem value="name-asc">Sort by Name</SelectItem>
                  <SelectItem value="isFavorite-desc">
                    Sort by Favorites
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Enhanced Bookmark Count with Link Stats */}
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <span data-testid="bookmark-count">
                    {filteredBookmarks.length}
                  </span>
                  <span>bookmarks</span>
                </div>
                {stats?.linkStats && stats.linkStats.broken > 0 && (
                  <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                    <XCircle size={12} />
                    <span data-testid="broken-links-count">{stats.linkStats.broken}</span>
                    <span>broken</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Layout - Two Lines */}
          <div className="sm:hidden space-y-2">
            {/* Line 1: Filters Label + Tag Input + Active Filter Tags */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary text-primary-foreground flex items-center space-x-1"
                    data-testid={`active-filter-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-primary-foreground/80 hover:text-primary-foreground"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                    data-testid="button-clear-filters"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            {/* Line 2: Sort Select + Bookmark Count */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span data-testid="bookmark-count">
                  {filteredBookmarks.length}
                </span>
                <span>bookmarks</span>
              </div>

              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [newSortBy, newSortOrder] = value.split("-") as [
                    typeof sortBy,
                    typeof sortOrder,
                  ];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
              >
                <SelectTrigger className="w-48" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">
                    Sort by Date Added
                  </SelectItem>
                  <SelectItem value="name-asc">Sort by Name</SelectItem>
                  <SelectItem value="isFavorite-desc">
                    Sort by Favorites
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Bulk Action Toolbar */}
          {bulkMode && (
            <BulkActionToolbar
              selectedCount={selectedIds.length}
              totalCount={filteredBookmarks.length}
              isAllSelected={selectedIds.length === filteredBookmarks.length && filteredBookmarks.length > 0}
              onSelectAll={handleSelectAll}
              onDeselectAll={() => setSelectedIds([])}
              onBulkDelete={handleBulkDelete}
              onBulkMove={handleBulkMove}
              onExitBulkMode={handleBulkModeToggle}
              isLoading={isBulkOperationLoading}
            />
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <div className="flex space-x-1">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 mb-3">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-1 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>

                    <div className="flex gap-1 mb-3">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>

                    <Skeleton className="h-4 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredBookmarks.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-4"
              }
            >
              {filteredBookmarks.map((bookmark) => {
                const isUnlocked = unlockedBookmarks.has(bookmark.id);
                const isProtected = bookmark.hasPasscode && !isUnlocked;
                const passcode = unlockedPasscodes[bookmark.id];

                return (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    onView={handleView}
                    onShare={handleShare}
                    onCopyShareLink={handleCopyShareLink}
                    isProtected={isProtected}
                    onUnlock={() => handleUnlockBookmark(bookmark)}
                    onLock={() => handleLockBookmark(bookmark)}
                    bulkMode={bulkMode}
                    isSelected={selectedIds.includes(bookmark.id)}
                    onSelect={handleSelectBookmark}
                    passcode={passcode}
                    isShareLoading={shareBookmarkMutation.isPending}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12" data-testid="empty-state">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="text-muted-foreground" size={32} />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No bookmarks found
              </h3>
              <p className="text-muted-foreground mb-6">
                {hasActiveFilters
                  ? "Try adjusting your search criteria or clearing filters."
                  : "Get started by adding your first bookmark."}
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                Add Your First Bookmark
              </Button>
            </div>
          )}
        </div>

        {/* Floating Action Button */}
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-md hover:scale-110 transition-all duration-300 ease-out z-50 p-0 flex items-center justify-center"
          data-testid="button-add-bookmark-fab"
        >
          <Plus size={24} />
        </Button>
      </main>

      <AddBookmarkModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        editingBookmark={editingBookmark}
      />

      <BookmarkDetailsModal
        isOpen={!!viewingBookmark}
        onClose={handleCloseViewModal}
        bookmark={viewingBookmark}
      />

      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
      />

      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={handlePasscodeModalClose}
        bookmark={selectedProtectedBookmark || undefined}
        onSuccess={handlePasscodeSuccess}
      />
    </div>
  );
}

export default function Bookmarks() {
  return (
    <ThemeProvider>
      <BookmarksContent />
    </ThemeProvider>
  );
}
