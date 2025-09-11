import { useState, useEffect } from "react";
import { X, Plus, Lock } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Create a conditional validation schema
const createFormSchema = (isProtected: boolean, isEditing: boolean) => {
  return insertBookmarkSchema.extend({
    tagInput: z.string().optional(),
  }).refine((data) => {
    // If protection is enabled, passcode is required for new bookmarks
    // For editing, passcode is only required if changing protection settings
    if (isProtected) {
      if (!isEditing) {
        // Creating new bookmark - passcode required
        return data.passcode && data.passcode.trim().length >= 4;
      }
      // Editing existing bookmark - allow empty passcode to keep existing one
      return !data.passcode || data.passcode.trim().length >= 4;
    }
    return true;
  }, {
    message: "Passcode is required when protection is enabled and must be at least 4 characters long",
    path: ["passcode"]
  });
};

type FormData = z.infer<typeof insertBookmarkSchema> & { tagInput?: string };

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBookmark?: any;
}

export function AddBookmarkModal({ isOpen, onClose, editingBookmark }: AddBookmarkModalProps) {
  const [tags, setTags] = useState<string[]>(editingBookmark?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema(isProtected, !!editingBookmark)),
    defaultValues: {
      name: "",
      description: "",
      url: "",
      categoryId: undefined,
      isFavorite: false,
      tags: [],
      tagInput: "",
      passcode: "",
    },
  });

  // Clear passcode errors when protection state changes
  useEffect(() => {
    if (!isProtected && form.formState.errors.passcode) {
      form.clearErrors("passcode");
    }
  }, [isProtected, form]);

  // Reset form when editingBookmark changes
  useEffect(() => {
    if (editingBookmark) {
      // Check if bookmark has existing passcode protection
      const hasPasscode = editingBookmark.hasPasscode || false;
      setIsProtected(hasPasscode);
      
      form.reset({
        name: editingBookmark.name || "",
        description: editingBookmark.description || "",
        url: editingBookmark.url || "",
        categoryId: editingBookmark.categoryId || undefined,
        isFavorite: editingBookmark.isFavorite || false,
        tags: editingBookmark.tags || [],
        tagInput: "",
        passcode: "", // Always start with empty passcode for security
      });
      setTags(editingBookmark.tags || []);
    } else {
      setIsProtected(false);
      form.reset({
        name: "",
        description: "",
        url: "",
        categoryId: undefined,
        isFavorite: false,
        tags: [],
        tagInput: "",
        passcode: "",
      });
      setTags([]);
    }
  }, [editingBookmark, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertBookmark) => {
      const url = editingBookmark 
        ? `/api/bookmarks/${editingBookmark.id}`
        : "/api/bookmarks";
      const method = editingBookmark ? "PATCH" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries();
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
    setIsProtected(false);
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
    // Comprehensive pre-submit validation guards for all scenarios
    
    if (!editingBookmark) {
      // SCENARIO: Creating new bookmark
      if (isProtected && (!data.passcode || data.passcode.trim().length < 4)) {
        form.setError("passcode", {
          type: "manual",
          message: "Passcode is required when protection is enabled and must be at least 4 characters long"
        });
        return;
      }
    } else {
      // SCENARIO: Editing existing bookmark
      const wasProtected = editingBookmark.hasPasscode || false;
      
      if (isProtected && !wasProtected) {
        // CRITICAL FIX: Transitioning from unprotected → protected REQUIRES passcode
        if (!data.passcode || data.passcode.trim().length < 4) {
          form.setError("passcode", {
            type: "manual",
            message: "A passcode is required when enabling protection on this bookmark"
          });
          return;
        }
      } else if (isProtected && wasProtected) {
        // Transitioning from protected → protected: allow empty (keeps existing) or new passcode
        if (data.passcode && data.passcode.trim().length > 0 && data.passcode.trim().length < 4) {
          form.setError("passcode", {
            type: "manual",
            message: "Passcode must be at least 4 characters long"
          });
          return;
        }
      }
      // protected → unprotected: no validation needed (will be set to null)
    }

    const bookmarkData: InsertBookmark = {
      name: data.name,
      description: data.description || null,
      url: data.url,
      categoryId: data.categoryId || null,
      isFavorite: data.isFavorite || false,
      tags: tags,
    };

    // Handle passcode logic based on scenario
    if (isProtected) {
      if (editingBookmark) {
        const wasProtected = editingBookmark.hasPasscode || false;
        
        if (!wasProtected) {
          // unprotected → protected: use the required new passcode
          bookmarkData.passcode = data.passcode?.trim() || null;
        } else {
          // protected → protected: use new passcode if provided, otherwise omit to keep existing
          if (data.passcode && data.passcode.trim()) {
            bookmarkData.passcode = data.passcode.trim();
          }
          // If no passcode provided, omit field to keep existing passcode
        }
      } else {
        // Create scenario: include the passcode
        bookmarkData.passcode = data.passcode?.trim() || null;
      }
    } else {
      // Protection disabled: explicitly set to null to remove any existing protection
      bookmarkData.passcode = null;
    }

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

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock size={16} className="text-muted-foreground" />
                <div>
                  <Label htmlFor="protection-toggle" className="text-sm font-medium cursor-pointer">
                    Protect with passcode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Require a passcode to view this bookmark
                  </p>
                </div>
              </div>
              <Switch
                id="protection-toggle"
                checked={isProtected}
                onCheckedChange={(checked) => {
                  setIsProtected(checked);
                  if (!checked) {
                    form.setValue("passcode", "");
                    form.clearErrors("passcode");
                  }
                  // Update form resolver when protection state changes
                  form.clearErrors();
                }}
                data-testid="switch-protection"
              />
            </div>

            {isProtected && (
              <div className="space-y-2">
                <Label htmlFor="passcode" className="text-sm font-medium">
                  Passcode {!editingBookmark && "*"}
                </Label>
                <Input
                  id="passcode"
                  type="password"
                  placeholder={editingBookmark ? "Enter new passcode or leave empty to keep current" : "Enter a secure passcode (required)"}
                  {...form.register("passcode")}
                  data-testid="input-passcode"
                />
                {form.formState.errors.passcode && (
                  <p className="text-sm text-destructive" data-testid="error-passcode">
                    {form.formState.errors.passcode.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {editingBookmark 
                    ? "Must be 4-64 characters long. Leave empty to keep current passcode." 
                    : "Must be 4-64 characters long. Required for protection."}
                </p>
              </div>
            )}
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
