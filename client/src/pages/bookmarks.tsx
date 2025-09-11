import { useState, useMemo, useEffect } from "react";
import { Menu, Search, Grid, List, Plus, Moon, Sun, Filter, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/lib/theme";
import { Sidebar } from "@/components/sidebar";
import { BookmarkCard } from "@/components/bookmark-card";
import { AddBookmarkModal } from "@/components/add-bookmark-modal";
import { AddCategoryModal } from "@/components/add-category-modal";
import { PasscodeModal } from "@/components/passcode-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { Bookmark, Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

function BookmarksContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "isFavorite">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Passcode modal state
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [selectedProtectedBookmark, setSelectedProtectedBookmark] = useState<(Bookmark & { category?: Category; hasPasscode?: boolean }) | null>(null);
  
  // Track unlocked bookmarks in session (bookmark IDs that have been unlocked)
  const [unlockedBookmarks, setUnlockedBookmarks] = useState<Set<number>>(new Set());
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Fetch preferences from database
  const { data: preferences } = useQuery<{ theme?: "light" | "dark"; viewMode?: "grid" | "list" }>({
    queryKey: ["/api/preferences"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: { theme?: "light" | "dark"; viewMode?: "grid" | "list" }) => {
      return await apiRequest("PATCH", "/api/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
    }
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
  }>({
    queryKey: ["/api/stats"],
  });

  // Fetch bookmarks with filters
  const bookmarkQueryParams = new URLSearchParams();
  if (searchQuery) bookmarkQueryParams.set('search', searchQuery);
  if (selectedCategory) bookmarkQueryParams.set('categoryId', selectedCategory);
  if (selectedTags.length > 0) bookmarkQueryParams.set('tags', selectedTags.join(','));
  if (location === "/favorites") bookmarkQueryParams.set('isFavorite', 'true');
  bookmarkQueryParams.set('sortBy', sortBy);
  bookmarkQueryParams.set('sortOrder', sortOrder);
  
  const { data: bookmarks = [], isLoading } = useQuery<(Bookmark & { category?: Category; hasPasscode?: boolean })[]>({
    queryKey: [`/api/bookmarks?${bookmarkQueryParams.toString()}`],
  });

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter(bookmark => {
      if (selectedTags.length > 0) {
        return selectedTags.some(tag => 
          bookmark.tags?.some(bookmarkTag => 
            bookmarkTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
      }
      return true;
    });
  }, [bookmarks, selectedTags]);

  const handleEdit = (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => {
    setEditingBookmark(bookmark);
    setIsAddModalOpen(true);
  };

  // Handle protected bookmark unlock
  const handleUnlockBookmark = (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => {
    setSelectedProtectedBookmark(bookmark);
    setIsPasscodeModalOpen(true);
  };

  // Handle protected bookmark lock
  const handleLockBookmark = (bookmark: Bookmark & { category?: Category; hasPasscode?: boolean }) => {
    // Remove bookmark ID from unlocked set to lock it again
    setUnlockedBookmarks(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookmark.id);
      return newSet;
    });
  };

  // Handle successful passcode verification
  const handlePasscodeSuccess = () => {
    if (selectedProtectedBookmark) {
      // Add bookmark ID to unlocked set
      setUnlockedBookmarks(prev => new Set(Array.from(prev).concat(selectedProtectedBookmark.id)));
      
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

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleAddTag = () => {
    const trimmedTag = tagInputValue.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags(prev => [...prev, trimmedTag]);
      setTagInputValue("");
    }
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedTags([]);
    setTagInputValue("");
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  if (!stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-foreground mb-2">Memorize</h2>
          <p className="text-sm text-muted-foreground">Loading your bookmarks...</p>
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
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="relative flex-1 max-w-4xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
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
              <div className="flex items-center bg-muted rounded-md p-1">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  className="p-2"
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
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden space-y-3">
            {/* Top Row: Menu + Theme */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                data-testid="button-mobile-menu"
              >
                <Menu size={20} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                data-testid="button-theme-toggle"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </Button>
            </div>

            {/* Bottom Section: Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
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
        <div className="bg-card border-b border-border px-6 py-3" data-testid="filter-bar">
          {/* Desktop Layout - Single Line */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted-foreground">Filters:</span>
                
                {/* Tag Input */}
                <div className="relative">
                  <Input
                    placeholder="Add tag filter"
                    className="w-32 h-8 text-xs"
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    data-testid="input-tag-filter"
                  />
                  {tagInputValue && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-0 top-0 h-8 w-8 p-0"
                      onClick={handleAddTag}
                      data-testid="button-add-tag-filter"
                    >
                      <Plus size={12} />
                    </Button>
                  )}
                </div>
                
                {/* Active Tags */}
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary text-primary-foreground flex items-center space-x-1"
                    data-testid={`active-filter-${tag.toLowerCase().replace(/\s+/g, '-')}`}
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
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}>
                <SelectTrigger className="w-56" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Sort by Date Added</SelectItem>
                  <SelectItem value="name-asc">Sort by Name</SelectItem>
                  <SelectItem value="isFavorite-desc">Sort by Favorites</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span data-testid="bookmark-count">{filteredBookmarks.length}</span>
                <span>bookmarks</span>
              </div>
            </div>
          </div>

          {/* Mobile Layout - Two Lines */}
          <div className="sm:hidden space-y-2">
            {/* Line 1: Filters Label + Tag Input + Active Filter Tags */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground shrink-0">Filters:</span>
              
              {/* Tag Input for Mobile */}
              <div className="relative">
                <Input
                  placeholder="Add tag filter"
                  className="w-28 h-8 text-xs"
                  value={tagInputValue}
                  onChange={(e) => setTagInputValue(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  data-testid="input-tag-filter"
                />
                {tagInputValue && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-0 top-0 h-8 w-8 p-0"
                    onClick={handleAddTag}
                    data-testid="button-add-tag-filter"
                  >
                    <Plus size={12} />
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary text-primary-foreground flex items-center space-x-1"
                    data-testid={`active-filter-${tag.toLowerCase().replace(/\s+/g, '-')}`}
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
                <span data-testid="bookmark-count">{filteredBookmarks.length}</span>
                <span>bookmarks</span>
              </div>
              
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}>
                <SelectTrigger className="w-48" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Sort by Date Added</SelectItem>
                  <SelectItem value="name-asc">Sort by Name</SelectItem>
                  <SelectItem value="isFavorite-desc">Sort by Favorites</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
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
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-4"
            }>
              {filteredBookmarks.map((bookmark) => {
                const isUnlocked = unlockedBookmarks.has(bookmark.id);
                const isProtected = bookmark.hasPasscode && !isUnlocked;
                
                return (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    isProtected={isProtected}
                    onUnlock={() => handleUnlockBookmark(bookmark)}
                    onLock={() => handleLockBookmark(bookmark)}
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
                  : "Get started by adding your first bookmark."
                }
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
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50 p-0 flex items-center justify-center"
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
