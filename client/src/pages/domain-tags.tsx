import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Edit, Trash2, Globe, Tag, Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface DomainTag {
  id: number;
  domain: string;
  tags: string[];
  category: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DomainTagsResponse {
  data: DomainTag[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface Category {
  category: string;
  count: number;
}

const normalizeDomainInput = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Invalid domain');
  }

  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  const hostname = url.hostname.toLowerCase();

  if (!hostname || hostname.includes(' ') || !hostname.includes('.')) {
    throw new Error('Invalid domain');
  }

  return hostname;
};

export default function DomainTagsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainTag | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = useMemo(() => user?.username === 'vensera', [user?.username]);

  // Fetch domain tags with infinite query for pagination
  const {
    data: domainTagsData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<DomainTagsResponse>({
    queryKey: [
      '/api/domain-tags',
      {
        search: searchQuery,
        category: selectedCategory,
        isActive: showInactive ? undefined : true,
      },
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (showInactive) params.set('isActive', 'false');
      params.set('limit', '20');
      params.set('offset', (pageParam as number).toString());
      params.set('sortBy', 'createdAt');
      params.set('sortOrder', 'desc');

      const response = await fetch(`/api/domain-tags?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch domain tags');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined;
    },
    initialPageParam: 0,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/domain-tags/categories'],
    queryFn: async () => {
      const response = await fetch('/api/domain-tags/categories', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  // Create domain tag mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<DomainTag>) => {
      const response = await fetch('/api/domain-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create domain tag');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-tags/categories'] });
      setIsCreateDialogOpen(false);
      toast({ description: 'Domain tag created successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    },
  });

  // Update domain tag mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DomainTag> }) => {
      const response = await fetch(`/api/domain-tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update domain tag');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-tags'] });
      setEditingDomain(null);
      toast({ description: 'Domain tag updated successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    },
  });

  // Delete domain tag mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/domain-tags/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete domain tag');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-tags/categories'] });
      toast({ description: 'Domain tag deleted successfully' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    },
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (category: string) => {
    // Ensure category is never empty string
    setSelectedCategory(category || 'all');
  };

  const handleCreate = (data: Partial<DomainTag>) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (id: number, data: Partial<DomainTag>) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this domain tag?')) {
      deleteMutation.mutate(id);
    }
  };

  // Flatten all pages of data
  const domainTags = domainTagsData?.pages.flatMap((page: DomainTagsResponse) => page.data) || [];
  const pagination = domainTagsData?.pages[domainTagsData.pages.length - 1]?.pagination;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Domain Tags</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Contribute domain-to-tag mappings so the community gets better automatic tagging.
            Everyone can add domains; only admins moderate existing entries.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Domain Tag
              </Button>
            </DialogTrigger>
            <CreateDomainTagDialog onSave={handleCreate} />
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search domains, tags, or descriptions..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories
              .filter((cat) => cat.category && cat.category.trim() !== '')
              .map((cat) => (
                <SelectItem key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive">Show inactive</Label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Domains</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {domainTags.filter((dt) => dt.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {domainTags.filter((dt) => !dt.isActive).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Tags List */}
      {isLoading ? (
        <div className="text-center py-8">Loading domain tags...</div>
      ) : domainTags.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No domain tags found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedCategory !== 'all' || showInactive
                ? 'Try adjusting your filters'
                : 'Get started by adding your first domain tag'}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain Tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {domainTags.map((domainTag) => (
            <Card key={domainTag.id} className={!domainTag.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg truncate">{domainTag.domain}</h3>
                      <div className="flex flex-wrap gap-1">
                        {domainTag.category && (
                          <Badge variant="secondary">{domainTag.category}</Badge>
                        )}
                        {!domainTag.isActive && <Badge variant="outline">Inactive</Badge>}
                      </div>
                    </div>
                    {domainTag.description && (
                      <p className="text-muted-foreground text-sm mb-2">{domainTag.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {domainTag.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 sm:ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDomain(domainTag)}
                        className="flex-1 sm:flex-none"
                      >
                        <Edit className="h-4 w-4 sm:mr-0 mr-2" />
                        <span className="sm:hidden">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(domainTag.id)}
                        className="flex-1 sm:flex-none"
                      >
                        <Trash2 className="h-4 w-4 sm:mr-0 mr-2" />
                        <span className="sm:hidden">Delete</span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage || isLoading}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      {editingDomain && (
        <EditDomainTagDialog
          domainTag={editingDomain}
          onSave={(data) => handleUpdate(editingDomain.id, data)}
          onClose={() => setEditingDomain(null)}
        />
      )}
    </div>
  );
}

// Create Domain Tag Dialog Component
function CreateDomainTagDialog({ onSave }: { onSave: (data: Partial<DomainTag>) => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    domain: '',
    tags: [] as string[],
    category: '',
    description: '',
    isActive: true,
  });
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let normalizedDomain: string;
    try {
      normalizedDomain = normalizeDomainInput(formData.domain);
    } catch {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid URL (e.g., https://example.com).',
        variant: 'destructive',
      });
      return;
    }
    if (formData.tags.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one tag is required',
        variant: 'destructive',
      });
      return;
    }
    const payload = { ...formData, domain: normalizedDomain };
    setFormData(payload);
    onSave(payload);
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add Domain Tag</DialogTitle>
        <DialogDescription>
          Create a new domain-to-tags mapping for automatic bookmark tagging.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="domain">Domain</Label><span className="text-red-500">*</span>
          <Input
            id="domain"
            value={formData.domain}
            onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))}
            placeholder="example.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="development, design, etc."
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Optional description"
          />
        </div>
        <div>
          <Label>
            Tags <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <Button type="button" onClick={handleAddTag}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {formData.tags.map((tag: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogContent>
  );
}

// Edit Domain Tag Dialog Component
function EditDomainTagDialog({
  domainTag,
  onSave,
  onClose,
}: {
  domainTag: DomainTag;
  onSave: (data: Partial<DomainTag>) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    domain: domainTag.domain,
    tags: domainTag.tags,
    category: domainTag.category || '',
    description: domainTag.description || '',
    isActive: domainTag.isActive,
  });
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let normalizedDomain: string;
    try {
      normalizedDomain = normalizeDomainInput(formData.domain);
    } catch {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid URL (e.g., https://example.com).',
        variant: 'destructive',
      });
      return;
    }

    if (formData.tags.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one tag is required',
        variant: 'destructive',
      });
      return;
    }
    const payload = { ...formData, domain: normalizedDomain };
    setFormData(payload);
    onSave(payload);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Domain Tag</DialogTitle>
          <DialogDescription>Update the domain-to-tags mapping.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="domain">Domain</Label><span className="text-red-500">*</span>
            <Input
              id="domain"
              value={formData.domain}
              onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))}
              placeholder="example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="development, design, etc."
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div>
            <Label>
              Tags <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" onClick={handleAddTag}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags.map((tag: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
