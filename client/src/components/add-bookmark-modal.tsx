import { useState } from "react";
import { X, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertBookmarkSchema } from "@shared/schema";
import type { InsertBookmark, Category } from "@shared/schema";
import { z } from "zod";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = insertBookmarkSchema.extend({
  tagInput: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBookmark?: any;
}

export function AddBookmarkModal({ isOpen, onClose, editingBookmark }: AddBookmarkModalProps) {
  const [tags, setTags] = useState<string[]>(editingBookmark?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingBookmark?.name || "",
      description: editingBookmark?.description || "",
      url: editingBookmark?.url || "",
      categoryId: editingBookmark?.categoryId || undefined,
      isFavorite: editingBookmark?.isFavorite || false,
      tags: editingBookmark?.tags || [],
      tagInput: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertBookmark) => {
      const url = editingBookmark 
        ? `/api/bookmarks/${editingBookmark.id}`
        : "/api/bookmarks";
      const method = editingBookmark ? "PATCH" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        description: editingBookmark 
          ? "Bookmark updated successfully!" 
          : "Bookmark saved successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to save bookmark",
      });
    }
  });

  const handleClose = () => {
    form.reset();
    setTags([]);
    setTagInput("");
    onClose();
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const onSubmit = (data: FormData) => {
    const bookmarkData: InsertBookmark = {
      name: data.name,
      description: data.description || null,
      url: data.url,
      categoryId: data.categoryId || null,
      isFavorite: data.isFavorite || false,
      tags: tags,
    };

    createMutation.mutate(bookmarkData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-add-bookmark">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">
            {editingBookmark ? "Edit Bookmark" : "Add New Bookmark"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              {...form.register("url")}
              data-testid="input-url"
            />
            {form.formState.errors.url && (
              <p className="text-sm text-destructive" data-testid="error-url">
                {form.formState.errors.url.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
            <Input
              id="name"
              placeholder="Bookmark title"
              {...form.register("name")}
              data-testid="input-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive" data-testid="error-name">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description of the bookmark"
              rows={3}
              {...form.register("description")}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Folder</Label>
            <Select
              value={form.watch("categoryId")?.toString() || "none"}
              onValueChange={(value) => {
                form.setValue("categoryId", value === "none" ? undefined : parseInt(value));
              }}
            >
              <SelectTrigger data-testid="select-folder">
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tags</Label>
            <Input
              placeholder="Add tags (press Enter to add)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              data-testid="input-tags"
            />
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-primary text-primary-foreground flex items-center space-x-1"
                    data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-primary-foreground/80 hover:text-primary-foreground"
                      data-testid={`button-remove-tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="favorite"
              checked={form.watch("isFavorite") || false}
              onCheckedChange={(checked) => form.setValue("isFavorite", !!checked)}
              data-testid="checkbox-favorite"
            />
            <Label htmlFor="favorite" className="text-sm font-medium cursor-pointer">
              Mark as favorite
            </Label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending 
                ? "Saving..." 
                : editingBookmark ? "Update Bookmark" : "Save Bookmark"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
