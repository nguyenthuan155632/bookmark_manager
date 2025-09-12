import { useState } from "react";
import { Trash2, FolderOpen, CheckSquare, Square, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { Category } from "@shared/schema";

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkMove: (categoryId: number | null) => void;
  onExitBulkMode: () => void;
  isLoading?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkMove,
  onExitBulkMode,
  isLoading = false
}: BulkActionToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch categories for move operation
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  const handleDeleteClick = () => {
    if (selectedCount === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onBulkDelete();
    setShowDeleteDialog(false);
  };

  const handleMoveToCategory = (value: string) => {
    if (selectedCount === 0) return;
    const categoryId = value === "uncategorized" ? null : parseInt(value);
    onBulkMove(categoryId);
  };

  return (
    <>
      {/* Bulk Action Toolbar */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1" data-testid="bulk-selection-count">
                {selectedCount} of {totalCount} selected
              </Badge>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAllToggle}
                className="h-8"
                data-testid="button-select-all-toggle"
              >
                {isAllSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                <span className="ml-2">
                  {isAllSelected ? "Deselect All" : "Select All"}
                </span>
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Move to Category */}
              <Select onValueChange={handleMoveToCategory} disabled={selectedCount === 0 || isLoading}>
                <SelectTrigger className="w-48 h-8" data-testid="select-move-category">
                  <FolderOpen size={14} className="mr-2" />
                  <SelectValue placeholder="Move to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete Selected */}
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteClick}
                disabled={selectedCount === 0 || isLoading}
                className="h-8"
                data-testid="button-bulk-delete"
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin mr-2" />
                ) : (
                  <Trash2 size={14} className="mr-2" />
                )}
                Delete ({selectedCount})
              </Button>
            </div>
          </div>

          {/* Exit Bulk Mode */}
          <Button
            size="sm"
            variant="outline"
            onClick={onExitBulkMode}
            className="h-8"
            data-testid="button-exit-bulk-mode"
          >
            <X size={14} className="mr-2" />
            Exit
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="bulk-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Bookmarks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} bookmark{selectedCount === 1 ? '' : 's'}? 
              This action cannot be undone.
              {selectedCount > 5 && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive-foreground">
                  <strong>Warning:</strong> You're about to delete {selectedCount} bookmarks at once.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete {selectedCount} Bookmark{selectedCount === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}