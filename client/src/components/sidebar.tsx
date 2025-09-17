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
  GripVertical,
  Edit2,
  Check,
  X,
  MoreVertical,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { categorySlug } from '@/lib/slug';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SortableCategoryItemProps {
  category: Category & { bookmarkCount: number };
  isActive: boolean;
  onDelete: (category: Category & { bookmarkCount: number }) => void;
  onRename: (categoryId: number, newName: string) => Promise<void>;
  onClose: () => void;
  formatCount: (n: number | undefined) => number;
}

function SortableCategoryItem({
  category,
  isActive,
  onDelete,
  onRename,
  onClose,
  formatCount
}: SortableCategoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync editName with category.name when category changes
  useEffect(() => {
    if (!isEditing) {
      setEditName(category.name);
    }
  }, [category.name, isEditing]);


  const handleStartEdit = () => {
    setIsEditing(true);
    setEditName(category.name);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(category.name);
  };

  const handleSaveEdit = async () => {
    if (editName.trim() === category.name || !editName.trim()) {
      handleCancelEdit();
      return;
    }

    setIsRenaming(true);
    try {
      await onRename(category.id, editName.trim());
      // Reset editing state after successful rename
      setIsEditing(false);
      // Update local state to prevent any race conditions
      setEditName(editName.trim());
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Failed to rename category:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center rounded-md px-0.5 py-0.5 transition-all duration-200 ease-in-out ${isActive ? 'bg-primary' : ''
        } ${isDragging ? 'opacity-60 scale-105 shadow-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      {/* Drag Handle - Always visible but subtle */}
      {!isEditing && (
        <div className="w-5 flex-shrink-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 text-slate-300 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white transition-all duration-200 hover:scale-110 cursor-grab active:cursor-grabbing"
            aria-label={`Drag to reorder ${category.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </Button>
        </div>
      )}

      {/* Folder Icon */}
      <Folder size={16} className="shrink-0 mr-1 text-slate-600 dark:text-slate-400 mr-2" />

      {/* Folder Name - Takes up most space */}
      <div className="flex-1 min-w-0 flex items-center">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            className="w-full h-6 text-sm border-0 p-0 bg-transparent focus:ring-0 focus:ring-offset-0"
            disabled={isRenaming}
          />
        ) : (
          <Link href={`/category/${categorySlug(category)}`} className="block" onClick={onClose}>
            <span className={`block whitespace-normal break-words hyphens-auto leading-tight text-sm ${isActive
              ? 'text-primary-foreground'
              : 'text-slate-900 dark:text-slate-100'
              }`}>
              {category.name}
            </span>
          </Link>
        )}
      </div>

      {/* Badge Count */}
      <div className="ml-1 flex-shrink-0">
        <span
          className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${isActive
            ? 'bg-primary-foreground text-primary'
            : 'bg-secondary text-secondary-foreground'
            }`}
        >
          {formatCount(category.bookmarkCount)}
        </span>
      </div>

      {/* More Menu or Edit Actions */}
      <div className="ml-0 flex-shrink-0">
        {isEditing ? (
          <div className="flex items-center space-x-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              aria-label="Save changes"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSaveEdit();
              }}
              disabled={isRenaming}
              data-testid={`button-save-category-${category.id}`}
            >
              <Check size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-600 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground"
              aria-label="Cancel editing"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancelEdit();
              }}
              disabled={isRenaming}
              data-testid={`button-cancel-category-${category.id}`}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-0 text-slate-300 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white transition-colors"
                aria-label={`More actions for ${category.name}`}
              >
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStartEdit();
                }}
                className="cursor-pointer"
              >
                <Edit2 size={14} className="mr-2" />
                Edit folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(category);
                }}
                className="cursor-pointer text-destructive focus:text-destructive text-red-500"
              >
                <Trash2 size={14} className="mr-2" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
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

  const updateSortOrderMutation = useMutation({
    mutationFn: async (sortOrders: { id: number; sortOrder: number }[]) => {
      return apiRequest('PATCH', '/api/categories/sort-order', { sortOrders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories?withCounts=true'] });
      toast({ description: 'Folder order updated' });
    },
    onError: (error: any) => {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to update folder order';
      toast({ variant: 'destructive', description: message });
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest('PATCH', `/api/categories/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories?withCounts=true'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ description: 'Folder renamed successfully' });
    },
    onError: (error: any) => {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to rename folder';
      toast({ variant: 'destructive', description: message });
      throw error; // Re-throw to handle in component
    },
  });

  const handleRenameCategory = async (categoryId: number, newName: string) => {
    await renameCategoryMutation.mutateAsync({ id: categoryId, name: newName });
  };

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = categories.findIndex((category) => category.id === active.id);
      const newIndex = categories.findIndex((category) => category.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedCategories = arrayMove(categories, oldIndex, newIndex);
        const sortOrders = reorderedCategories.map((category, index) => ({
          id: category.id,
          sortOrder: index,
        }));
        updateSortOrderMutation.mutate(sortOrders);
      }
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
    {
      path: '/documentation',
      icon: BookOpen,
      label: 'Documentation',
      active: isActive('/documentation'),
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
                className={`w-full justify-start space-x-1 pr-0.5 ${item.active
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
                    className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${item.active
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
                className={`group flex items-center rounded-md px-0.5 py-0.5 transition-all duration-200 ease-in-out ml-0 mr-1 pl-2 ${isCategoryActive('hidden') ? 'bg-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                {/* Lock Icon */}
                <Lock size={16} className="shrink-0 mr-2 text-slate-600 dark:text-slate-400" />

                {/* Folder Name - Takes up most space */}
                <div className="flex-1 min-w-0 flex items-center">
                  <Link href={`/category/hidden`} className="block" onClick={onClose}>
                    <span className={`block whitespace-normal break-words hyphens-auto leading-tight text-sm bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent font-medium ${isCategoryActive('hidden')
                      ? 'text-primary-foreground'
                      : 'text-slate-900 dark:text-slate-100'
                      }`}>
                      Hidden
                    </span>
                  </Link>
                </div>

                {/* Badge Count */}
                <div className="ml-1 flex-shrink-0">
                  <span
                    className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${isCategoryActive('hidden')
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-secondary text-secondary-foreground'
                      }`}
                  >
                    {formatCount(hiddenCount)}
                  </span>
                </div>

                {/* Reserve space for more menu to keep alignment with other rows */}
                <div className="ml-0 flex-shrink-0">
                  <div className="h-5 w-5" aria-hidden />
                </div>
              </div>

              {/* Default uncategorized folder (synthetic, non-deletable, pinned on top) */}
              <div
                className={`group flex items-center rounded-md px-0.5 py-0.5 transition-all duration-200 ease-in-out ml-0 mr-1 pl-2 ${isCategoryActive('uncategorized') ? 'bg-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                {/* Folder Icon */}
                <Folder size={16} className="shrink-0 mr-2 text-slate-600 dark:text-slate-400" />

                {/* Folder Name - Takes up most space */}
                <div className="flex-1 min-w-0 flex items-center">
                  <Link href={`/category/uncategorized`} className="block" onClick={onClose}>
                    <span className={`block whitespace-normal break-words hyphens-auto leading-tight text-sm bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text font-medium ${isCategoryActive('uncategorized')
                      ? 'text-primary-foreground'
                      : 'text-slate-900 dark:text-slate-100'
                      }`}>
                      Uncategorized
                    </span>
                  </Link>
                </div>

                {/* Badge Count */}
                <div className="ml-1 flex-shrink-0">
                  <span
                    className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${isCategoryActive('uncategorized')
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-secondary text-secondary-foreground'
                      }`}
                  >
                    {formatCount(uncategorizedCount)}
                  </span>
                </div>

                {/* Reserve space for more menu to keep alignment with other rows */}
                <div className="ml-0 flex-shrink-0">
                  <div className="h-5 w-5" aria-hidden />
                </div>
              </div>

              <Separator className="!my-4" />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((category) => (
                    <SortableCategoryItem
                      key={category.id}
                      category={category}
                      isActive={isCategoryActive(categorySlug(category))}
                      onDelete={handleDeleteCategory}
                      onRename={handleRenameCategory}
                      onClose={onClose}
                      formatCount={formatCount}
                    />
                  ))}
                </SortableContext>
              </DndContext>

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

