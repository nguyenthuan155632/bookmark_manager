import { useState, useEffect } from 'react';
import { X, Plus, Lock, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertBookmarkSchema } from '@shared/schema';
import type { InsertBookmark, Category } from '@shared/schema';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MarkdownEditor } from '@/components/markdown-editor';

// Create a permissive validation schema - detailed validation is handled in onSubmit
const createFormSchema = () => {
  return insertBookmarkSchema
    .extend({
      tagInput: z.string().optional(),
      passcode: z.string().optional(), // Make passcode always optional at form level
    })
    .omit({ passcode: true })
    .extend({
      passcode: z
        .string()
        .optional()
        .refine(
          (val) => {
            // Only validate length if passcode is provided
            return !val || val.trim().length >= 4;
          },
          {
            message: 'Passcode must be at least 4 characters long if provided',
          },
        ),
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
  const [tagInput, setTagInput] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [autoTagsGenerated, setAutoTagsGenerated] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  const { data: preferences } = useQuery<{ defaultCategoryId?: number | null; autoTagSuggestionsEnabled?: boolean }>({
    queryKey: ['/api/preferences'],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema()),
    defaultValues: {
      name: '',
      description: '',
      url: '',
      categoryId: undefined,
      isFavorite: false,
      tags: [],
      tagInput: '',
      passcode: '',
    },
  });

  // Clear passcode errors when protection state changes
  useEffect(() => {
    if (!isProtected && form.formState.errors.passcode) {
      form.clearErrors('passcode');
    }
  }, [isProtected, form]);

  // Reset form when editingBookmark changes
  useEffect(() => {
    if (editingBookmark) {
      // Check if bookmark has existing passcode protection
      const hasPasscode = editingBookmark.hasPasscode || false;
      setIsProtected(hasPasscode);

      form.reset({
        name: editingBookmark.name || '',
        description: editingBookmark.description || '',
        url: editingBookmark.url || '',
        categoryId: editingBookmark.categoryId || undefined,
        isFavorite: editingBookmark.isFavorite || false,
        tags: editingBookmark.tags || [],
        tagInput: '',
        passcode: '', // Always start with empty passcode for security
      });
      setTags(editingBookmark.tags || []);
      setSuggestedTags((editingBookmark as any)?.suggestedTags || []);
      setAutoTagsGenerated(!!(editingBookmark as any)?.suggestedTags?.length);
    } else {
      setIsProtected(false);
      form.reset({
        name: '',
        description: '',
        url: '',
        categoryId: (preferences?.defaultCategoryId as any) || undefined,
        isFavorite: false,
        tags: [],
        tagInput: '',
        passcode: '',
      });
      setTags([]);
      setSuggestedTags([]);
      setAutoTagsGenerated(false);
    }
  }, [editingBookmark, form, preferences?.defaultCategoryId]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertBookmark) => {
      const url = editingBookmark ? `/api/bookmarks/${editingBookmark.id}` : '/api/bookmarks';
      const method = editingBookmark ? 'PATCH' : 'POST';
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries();
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        description: editingBookmark
          ? 'Bookmark updated successfully!'
          : 'Bookmark saved successfully!',
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error.message || 'Failed to save bookmark',
      });
    },
  });

  // Auto-tagging mutations
  const generateAutoTagsMutation = useMutation({
    mutationFn: async ({ bookmarkId, passcode }: { bookmarkId?: number; passcode?: string }) => {
      if (bookmarkId) {
        // For existing bookmarks
        return await apiRequest('POST', `/api/bookmarks/${bookmarkId}/auto-tags`, { passcode });
      } else {
        // For new bookmarks, use the URL, name and description directly
        const currentUrl = form.getValues('url');
        const currentName = form.getValues('name');
        const currentDescription = form.getValues('description');

        if (!currentUrl) {
          throw new Error('URL is required to generate tag suggestions');
        }

        // Call generateAutoTags directly from storage (we'll simulate with the existing endpoint)
        // For now, we'll create a temporary bookmark to get suggestions
        const response = await fetch('/api/bookmarks/preview-auto-tags', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: currentUrl,
            name: currentName || '',
            description: currentDescription || '',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate tag suggestions');
        }

        return await response.json();
      }
    },
    onSuccess: (data: any) => {
      const suggestions = data.suggestedTags || [];
      setSuggestedTags(suggestions);
      setAutoTagsGenerated(true);
      toast({
        description: `Generated ${suggestions.length} tag suggestions${suggestions.length === 0 ? ' (none found)' : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error.message || 'Failed to generate tag suggestions',
      });
    },
  });

  const acceptSuggestedTagsMutation = useMutation({
    mutationFn: async ({
      bookmarkId,
      tags,
      passcode,
    }: {
      bookmarkId: number;
      tags: string[];
      passcode?: string;
    }) => {
      return await apiRequest('PATCH', `/api/bookmarks/${bookmarkId}/tags/accept`, {
        tags,
        passcode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        description: 'Tags accepted successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error.message || 'Failed to accept suggested tags',
      });
    },
  });

  // Watch URL changes for auto-tagging (debounced)
  const watchedUrl = form.watch('url');
  useEffect(() => {
    if (editingBookmark) return;
    const timeoutId = setTimeout(() => {
      const currentUrl = watchedUrl;
      const allowAuto = preferences?.autoTagSuggestionsEnabled ?? true;
      if (allowAuto && currentUrl && !autoTagsGenerated) {
        try {
          new URL(currentUrl); // Validate URL
          setIsGeneratingSuggestions(true);
          generateAutoTagsMutation.mutate({
            passcode: isProtected ? form.getValues('passcode') || undefined : undefined,
          });
        } catch {
          // Invalid URL, no-op
        }
      }
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [watchedUrl, editingBookmark, autoTagsGenerated, generateAutoTagsMutation, isProtected, form, preferences?.autoTagSuggestionsEnabled]);

  // Reset loading state when mutation completes
  useEffect(() => {
    if (!generateAutoTagsMutation.isPending) {
      setIsGeneratingSuggestions(false);
    }
  }, [generateAutoTagsMutation.isPending]);

  const handleClose = () => {
    form.reset();
    setTags([]);
    setTagInput('');
    setIsProtected(false);
    setSuggestedTags([]);
    setAutoTagsGenerated(false);
    setIsGeneratingSuggestions(false);
    onClose();
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Handle manual tag suggestions
  const handleGenerateSuggestions = () => {
    const currentUrl = form.getValues('url');
    if (!currentUrl) {
      toast({
        variant: 'destructive',
        description: 'Please enter a URL first to generate tag suggestions',
      });
      return;
    }

    try {
      new URL(currentUrl); // Validate URL
      setIsGeneratingSuggestions(true);
      const passcode = isProtected ? form.getValues('passcode') || undefined : undefined;
      generateAutoTagsMutation.mutate({
        bookmarkId: editingBookmark?.id,
        passcode,
      });
    } catch {
      toast({
        variant: 'destructive',
        description: 'Please enter a valid URL to generate tag suggestions',
      });
    }
  };

  // Handle accepting individual suggested tags
  const handleAcceptSuggestedTag = (tagToAccept: string) => {
    if (editingBookmark) {
      // For existing bookmarks, use the API
      const passcode = isProtected ? form.getValues('passcode') || undefined : undefined;
      acceptSuggestedTagsMutation.mutate({
        bookmarkId: editingBookmark.id,
        tags: [tagToAccept],
        passcode,
      });
    } else {
      // For new bookmarks, add to local state
      if (!tags.includes(tagToAccept)) {
        setTags((prev) => [...prev, tagToAccept]);
      }
    }

    // Remove from suggested tags
    setSuggestedTags((prev) => prev.filter((tag) => tag !== tagToAccept));
  };

  // Handle accepting all suggested tags
  const handleAcceptAllSuggestedTags = () => {
    if (suggestedTags.length === 0) return;

    if (editingBookmark) {
      // For existing bookmarks, use the API
      const passcode = isProtected ? form.getValues('passcode') || undefined : undefined;
      acceptSuggestedTagsMutation.mutate({
        bookmarkId: editingBookmark.id,
        tags: suggestedTags,
        passcode,
      });
    } else {
      // For new bookmarks, add to local state
      const newTags = suggestedTags.filter((tag) => !tags.includes(tag));
      setTags((prev) => [...prev, ...newTags]);
    }

    // Clear all suggested tags
    setSuggestedTags([]);
  };

  const onSubmit = (data: FormData) => {
    // Comprehensive pre-submit validation guards for all scenarios

    if (!editingBookmark) {
      // SCENARIO: Creating new bookmark
      if (isProtected && (!data.passcode || data.passcode.trim().length < 4)) {
        form.setError('passcode', {
          type: 'manual',
          message:
            'Passcode is required when protection is enabled and must be at least 4 characters long',
        });
        return;
      }
    } else {
      // SCENARIO: Editing existing bookmark
      const wasProtected = editingBookmark.hasPasscode || false;

      if (isProtected && !wasProtected) {
        // CRITICAL FIX: Transitioning from unprotected → protected REQUIRES passcode
        if (!data.passcode || data.passcode.trim().length < 4) {
          form.setError('passcode', {
            type: 'manual',
            message: 'A passcode is required when enabling protection on this bookmark',
          });
          return;
        }
      } else if (isProtected && wasProtected) {
        // Transitioning from protected → protected: allow empty (keeps existing) or new passcode
        if (data.passcode && data.passcode.trim().length > 0 && data.passcode.trim().length < 4) {
          form.setError('passcode', {
            type: 'manual',
            message: 'Passcode must be at least 4 characters long',
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
      <DialogContent
        className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto border border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70"
        data-testid="modal-add-bookmark"
      >
        <DialogHeader>
          <DialogTitle data-testid="modal-title">
            {editingBookmark ? 'Edit Bookmark' : 'Add New Bookmark'}
          </DialogTitle>
          <DialogDescription>
            {editingBookmark
              ? 'Update bookmark details. Protected bookmarks can be edited without re-entering the passcode.'
              : 'Create a new bookmark with optional password protection.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              URL *
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              {...form.register('url')}
              data-testid="input-url"
            />
            {form.formState.errors.url && (
              <p className="text-sm text-destructive" data-testid="error-url">
                {form.formState.errors.url.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name *
            </Label>
            <Input
              id="name"
              placeholder="Bookmark title"
              {...form.register('name')}
              data-testid="input-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive" data-testid="error-name">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <MarkdownEditor
            id="description"
            value={form.watch('description') || ''}
            onChange={(value) => form.setValue('description', value)}
            placeholder="Optional description with markdown support..."
            error={form.formState.errors.description?.message}
            data-testid="input-description"
          />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Folder</Label>
            <div className="flex gap-2 items-center">
              <Select
                value={form.watch('categoryId')?.toString() || 'none'}
                onValueChange={(value) => {
                  form.setValue('categoryId', value === 'none' ? undefined : parseInt(value));
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
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                onClick={async () => {
                  const id = form.getValues('categoryId');
                  await apiRequest('PATCH', '/api/preferences', { defaultCategoryId: id ?? null });
                  queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
                }}
                disabled={form.getValues('categoryId') == null}
                title="Set current category as default"
              >
                Set as default
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Tags</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateSuggestions}
                disabled={isGeneratingSuggestions || generateAutoTagsMutation.isPending}
                data-testid="button-suggest-tags"
                className="flex items-center space-x-1"
              >
                <Sparkles size={14} className={isGeneratingSuggestions ? 'animate-spin' : ''} />
                <span>
                  {isGeneratingSuggestions
                    ? 'Generating...'
                    : autoTagsGenerated
                      ? 'Regenerate Tags'
                      : 'Suggest Tags'}
                </span>
              </Button>
            </div>
            <Input
              placeholder="Add tags (press Enter to add)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              data-testid="input-tags"
            />

            {/* Suggested Tags Section */}
            {(suggestedTags.length > 0 || isGeneratingSuggestions) && (
              <div className="border border-border rounded-md p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles size={14} className="text-muted-foreground" />
                    <Label className="text-sm font-medium text-muted-foreground">
                      {isGeneratingSuggestions
                        ? 'Generating tag suggestions...'
                        : `Suggested Tags (${suggestedTags.length})`}
                    </Label>
                  </div>
                  {suggestedTags.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAcceptAllSuggestedTags}
                      disabled={acceptSuggestedTagsMutation.isPending}
                      data-testid="button-accept-all-suggested"
                      className="text-xs"
                    >
                      Accept All
                    </Button>
                  )}
                </div>

                {isGeneratingSuggestions ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Sparkles size={16} className="animate-spin" />
                      <span>Analyzing URL and content...</span>
                    </div>
                  </div>
                ) : suggestedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {suggestedTags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center space-x-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        onClick={() => handleAcceptSuggestedTag(tag)}
                        data-testid={`suggested-tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <span>{tag}</span>
                        <Plus size={12} className="text-blue-500" />
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No tag suggestions found for this URL
                  </div>
                )}
              </div>
            )}

            {/* Current Tags */}
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
              checked={form.watch('isFavorite') || false}
              onCheckedChange={(checked) => form.setValue('isFavorite', !!checked)}
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
                    form.setValue('passcode', '');
                  }
                  // Clear all form errors when toggling protection
                  form.clearErrors();
                }}
                data-testid="switch-protection"
              />
            </div>

            {isProtected && (
              <div className="space-y-2">
                <Label htmlFor="passcode" className="text-sm font-medium">
                  Passcode {!editingBookmark && '*'}
                </Label>
                <Input
                  id="passcode"
                  type="password"
                  placeholder={
                    editingBookmark
                      ? 'Enter new passcode or leave empty to keep current'
                      : 'Enter a secure passcode (required)'
                  }
                  {...form.register('passcode')}
                  data-testid="input-passcode"
                />
                {form.formState.errors.passcode && (
                  <p className="text-sm text-destructive" data-testid="error-passcode">
                    {form.formState.errors.passcode.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {editingBookmark
                    ? 'Must be 4-64 characters long. Leave empty to keep current passcode.'
                    : 'Must be 4-64 characters long. Required for protection.'}
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
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save">
              {createMutation.isPending
                ? 'Saving...'
                : editingBookmark
                  ? 'Update Bookmark'
                  : 'Save Bookmark'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
