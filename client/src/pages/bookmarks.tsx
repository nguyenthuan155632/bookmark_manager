import { useState, useMemo } from "react";
import { Menu, Search, Grid, List, Plus, Moon, Sun, Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/lib/theme";
import { Sidebar } from "@/components/sidebar";
import { BookmarkCard } from "@/components/bookmark-card";
import { AddBookmarkModal } from "@/components/add-bookmark-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bookmark, Category } from "@shared/schema";

function BookmarksContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "isFavorite">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { theme, setTheme } = useTheme();

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
  const { data: bookmarks = [], isLoading } = useQuery<(Bookmark & { category?: Category })[]>({
    queryKey: ["/api/bookmarks", { 
      search: searchQuery, 
      categoryId: selectedCategory ? parseInt(selectedCategory) : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      sortBy,
      sortOrder
    }],
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

  const handleEdit = (bookmark: Bookmark & { category?: Category }) => {
    setEditingBookmark(bookmark);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingBookmark(null);
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedTags([]);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  if (!stats) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        stats={stats}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                data-testid="button-mobile-menu"
              >
                <Menu size={20} />
              </Button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search bookmarks, tags, or descriptions..."
                  className="pl-10 w-80"
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
                  onClick={() => setViewMode("grid")}
                  data-testid="button-grid-view"
                >
                  <Grid size={16} />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  className="p-2"
                  onClick={() => setViewMode("list")}
                  data-testid="button-list-view"
                >
                  <List size={16} />
                </Button>
              </div>

              <Button onClick={() => setIsAddModalOpen(true)} data-testid="button-add-bookmark">
                <Plus size={16} className="mr-2" />
                <span className="hidden sm:inline">Add Bookmark</span>
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
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-card border-b border-border px-6 py-3" data-testid="filter-bar">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Filters:</span>
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
                <SelectTrigger className="w-48" data-testid="select-sort">
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
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredBookmarks.length > 0 ? (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-4"
            }>
              {filteredBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={handleEdit}
                />
              ))}
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
      </main>

      <AddBookmarkModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        editingBookmark={editingBookmark}
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
