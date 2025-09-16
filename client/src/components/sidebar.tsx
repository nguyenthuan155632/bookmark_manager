import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  Home,
  Star,
  Plus,
  BookmarkIcon,
  Trash2,
  Lock,
  Settings,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Category, Bookmark } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { categorySlug } from '@/lib/slug';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: () => void;
  stats: {
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  };
}

export function Sidebar({ isOpen, onClose, onCreateFolder, stats }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<
    (Category & { bookmarkCount: number }) | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: categories = [] } = useQuery<(Category & { bookmarkCount: number })[]>({
    queryKey: ['/api/categories?withCounts=true'],
  });
  const uncategorizedCount = Math.max(
    0,
    stats.total - categories.reduce((sum, c) => sum + (c.bookmarkCount || 0), 0),
  );

  // Count of protected (passcode) bookmarks for Hidden pseudo-folder
  const { data: allBookmarks = [] } = useQuery<
    (Bookmark & { category?: Category; hasPasscode?: boolean })[]
  >({
    queryKey: ['/api/bookmarks'],
  });
  const hiddenCount = allBookmarks.filter((b) => b?.hasPasscode).length;
  // In the All view we hide protected items; reflect that in the badge count
  const visibleTotal = Math.max(0, (stats.total || 0) - hiddenCount);

  const deleteMutation = useMutation({
    mutationFn: async (params: { id: number; strategy?: 'unlink' | 'delete'; name?: string }) => {
      const url = params.strategy
        ? `/api/categories/${params.id}?strategy=${params.strategy}`
        : `/api/categories/${params.id}`;
      return apiRequest('DELETE', url);
    },
    onSuccess: async (_res, variables) => {
      // Invalidate categories and stats
      queryClient.invalidateQueries({ queryKey: ['/api/categories?withCounts=true'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] });
      // If currently viewing this category, navigate home
      const maybeSlug = variables.name
        ? categorySlug({ id: variables.id, name: variables.name })
        : undefined;
      if (
        (maybeSlug && location === `/category/${maybeSlug}`) ||
        location.startsWith(`/category/${variables.id}`)
      )
        setLocation('/');
    },
    onError: async (error: any) => {
      const message = typeof error?.message === 'string' ? error.message : 'Delete failed';
      toast({ variant: 'destructive', description: message });
    },
  });

  const handleDeleteCategory = (category: Category & { bookmarkCount: number }) => {
    if (category.bookmarkCount === 0) {
      // Immediate delete, no confirmation
      deleteMutation.mutate({ id: category.id, name: category.name });
      return;
    }
    setPendingCategory(category);
    setConfirmOpen(true);
  };

  const confirmCategoryAction = async (strategy: 'unlink' | 'delete') => {
    if (!pendingCategory) return;
    try {
      setIsProcessing(true);
      await deleteMutation.mutateAsync({
        id: pendingCategory.id,
        strategy,
        name: pendingCategory.name,
      });
      setConfirmOpen(false);
      setPendingCategory(null);
    } catch (err) {
      // Keep dialog open; errors surface via thrown message from apiRequest
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const isActive = (path: string) => location === path;
  const isCategoryActive = (categorySlug: string) => location === `/category/${categorySlug}`;
  const formatCount = (n: number | undefined) => {
    const num = typeof n === 'number' ? n : 0;
    return Math.max(0, Math.min(99, num));
  };

  const navItems = [
    {
      path: '/',
      icon: Home,
      label: 'All Bookmarks',
      count: visibleTotal,
      active: isActive('/'),
    },
    {
      path: '/favorites',
      icon: Star,
      label: 'Favorites',
      count: stats.favorites,
      active: isActive('/favorites'),
    },
    {
      path: '/domain-tags',
      icon: Globe,
      label: 'Domain Tags',
      active: isActive('/domain-tags'),
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'Settings',
      active: isActive('/settings'),
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`
        w-80 border-r border-border flex flex-col transition-transform duration-300 
        bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60
        -translate-x-full ${isOpen ? 'translate-x-0' : ''} 
        lg:translate-x-0 fixed lg:relative z-30 h-full
      `}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookmarkIcon className="text-primary-foreground" size={16} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-foreground">Memorize</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <Button
                variant={item.active ? 'default' : 'ghost'}
                className={`w-full justify-start space-x-3 pr-2 ${
                  item.active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'
                }`}
                onClick={onClose}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon size={20} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                      item.active
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {formatCount(item.count)}
                  </span>
                )}
              </Button>
            </Link>
          ))}

          <Separator className="my-4" />

          {/* Folders Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-3 pr-2 py-2">
              <h3 className="text-sm font-medium text-slate-600 dark:text-muted-foreground uppercase tracking-wide">
                Folders
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0 text-slate-600 hover:text-slate-800 dark:text-muted-foreground dark:hover:text-foreground"
                onClick={onCreateFolder}
                data-testid="button-create-folder"
              >
                <Plus size={12} />
              </Button>
            </div>

            <div className="space-y-1">
              {/* Hidden protected bookmarks (synthetic, non-deletable) */}
              <div
                className={`group flex items-center rounded-md ${
                  isCategoryActive('hidden') ? 'bg-primary' : ''
                }`}
              >
                <Link href={`/category/hidden`} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start space-x-3 pr-0 hover:pr-2 ${
                      isCategoryActive('hidden')
                        ? 'text-primary-foreground hover:bg-transparent'
                        : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'
                    }`}
                    onClick={onClose}
                    data-testid={`folder-hidden`}
                  >
                    <Lock size={16} />
                    <span className="flex-1 min-w-0 text-left whitespace-normal break-words hyphens-auto leading-tight bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent font-medium">
                      Hidden
                    </span>
                    <span
                      className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                        isCategoryActive('hidden')
                          ? 'bg-primary-foreground text-primary'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {formatCount(hiddenCount)}
                    </span>
                  </Button>
                </Link>
                {/* Reserve space for delete icon to keep alignment with other rows */}
                <div className="h-8 w-8 shrink-0" aria-hidden />
              </div>

              {/* Default uncategorized folder (synthetic, non-deletable, pinned on top) */}
              <div
                className={`group flex items-center rounded-md ${
                  isCategoryActive('uncategorized') ? 'bg-primary' : ''
                }`}
              >
                <Link href={`/category/uncategorized`} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start space-x-3 pr-0 hover:pr-2 ${
                      isCategoryActive('uncategorized')
                        ? 'text-primary-foreground hover:bg-transparent'
                        : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'
                    }`}
                    onClick={onClose}
                    data-testid={`folder-uncategorized`}
                  >
                    <Folder size={16} />
                    <span className="flex-1 min-w-0 text-left whitespace-normal break-words hyphens-auto leading-tight bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent font-medium">
                      Uncategorized
                    </span>
                    <span
                      className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                        isCategoryActive('uncategorized')
                          ? 'bg-primary-foreground text-primary'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {formatCount(uncategorizedCount)}
                    </span>
                  </Button>
                </Link>
                {/* Reserve space for delete icon to keep alignment with other rows */}
                <div className="h-8 w-8 shrink-0" aria-hidden />
              </div>

              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`group flex items-center rounded-md ${
                    isCategoryActive(categorySlug(category)) ? 'bg-primary' : ''
                  }`}
                >
                  <Link href={`/category/${categorySlug(category)}`} className="flex-1">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start space-x-3 pr-0 hover:pr-2 ${
                        isCategoryActive(categorySlug(category))
                          ? 'text-primary-foreground hover:bg-transparent'
                          : 'text-slate-900 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'
                      }`}
                      onClick={onClose}
                      data-testid={`folder-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Folder size={16} />
                      <span className="flex-1 min-w-0 text-left whitespace-normal break-words hyphens-auto leading-tight">
                        {category.name}
                      </span>
                      <span
                        className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                          isCategoryActive(categorySlug(category))
                            ? 'bg-primary-foreground text-primary'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {formatCount(category.bookmarkCount)}
                      </span>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-600 hover:text-destructive dark:text-muted-foreground dark:hover:text-destructive"
                    aria-label={`Delete ${category.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteCategory(category);
                    }}
                    data-testid={`button-delete-category-${category.name
                      .toLowerCase()
                      .replace(/\s+/g, '-')}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}

              {categories.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-muted-foreground px-3 py-2">
                  No folders yet
                </p>
              )}
            </div>
          </div>
        </nav>
      </aside>
      {/* Delete/Unlink Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="category-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCategory?.bookmarkCount
                ? `This folder contains ${pendingCategory.bookmarkCount} bookmark${pendingCategory.bookmarkCount === 1 ? '' : 's'}.`
                : 'This folder is empty.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingCategory?.bookmarkCount ? (
            <div className="text-sm text-muted-foreground -mt-3">
              <div className="mt-2 font-medium text-foreground">Choose an action:</div>
              <div className="mt-1 space-y-1">
                <div>• Unlink: keep bookmarks but remove this folder</div>
                <div>• Delete: remove all bookmarks in this folder (cannot be undone)</div>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <div className="flex gap-2">
              <Button
                onClick={() => confirmCategoryAction('delete')}
                disabled={isProcessing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-category"
              >
                Delete Bookmarks
              </Button>
              <Button
                onClick={() => confirmCategoryAction('unlink')}
                disabled={isProcessing}
                variant="outline"
                data-testid="button-confirm-unlink-category"
              >
                Unlink Bookmarks
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
