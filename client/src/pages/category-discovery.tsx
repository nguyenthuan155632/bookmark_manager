import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { SEO } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/structured-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, Star, Folder, Globe } from 'lucide-react';

interface Bookmark {
  id: number;
  name: string;
  description?: string;
  url: string;
  createdAt: string;
  screenshotUrl?: string;
  isFavorite: boolean;
  tags?: string[];
  category?: { name: string };
}

interface CategoryData {
  name: string;
  bookmarkCount?: number;
}

interface CategoryDiscoveryData {
  title: string;
  description: string;
  category: CategoryData;
  bookmarks: Bookmark[];
  totalBookmarks: number;
  structuredData: any;
}

export default function CategoryDiscovery() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<CategoryDiscoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/bookmarks/discovery/category/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Category not found');
            return;
          }
          throw new Error('Failed to fetch category data');
        }
        const categoryData = await response.json();
        setData(categoryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error === 'Category not found' ? 'Category Not Found' : 'Unable to Load Category'}
          </h1>
          <p className="text-gray-600 mb-6">
            {error === 'Category not found'
              ? 'This category may not exist or has no shared bookmarks.'
              : error
            }
          </p>
          <div className="space-x-4">
            <Button asChild variant="outline">
              <Link to="/discover">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Discovery
              </Link>
            </Button>
            <Button asChild>
              <Link to="/">Return Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={data.title}
        description={data.description}
        structuredData={[
          generateBreadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Discover', url: '/discover' },
            { name: data.category.name, url: `/discover/category/${slug}` }
          ]),
          data.structuredData
        ]}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/discover">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Discovery
              </Link>
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {data.category.name} Resources
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {data.description}
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-full">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{data.totalBookmarks}</div>
                <div className="text-sm text-gray-600">Bookmarks</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 bg-green-100 rounded-full">
                <Folder className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{data.category.name}</div>
                <div className="text-sm text-gray-600">Category</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bookmarks */}
        {data.bookmarks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto gap-6">
            {data.bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="break-inside-avoid mb-6">
                <Card className="hover:shadow-md transition-shadow bg-white border-gray-200">
                  <CardContent className="p-6">
                    {/* Screenshot */}
                    {bookmark.screenshotUrl && (
                      <div className="w-full bg-gray-100 rounded-md mb-4 overflow-hidden">
                        <img
                          src={bookmark.screenshotUrl}
                          alt={`Preview for ${bookmark.name}`}
                          className="w-full object-cover"
                          loading="lazy"
                          style={{ maxHeight: '200px' }}
                        />
                      </div>
                    )}

                    {/* Title */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1 pr-2">
                        {bookmark.name}
                      </h3>
                      {bookmark.isFavorite && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                      )}
                    </div>

                    {/* Description */}
                    {bookmark.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {bookmark.description}
                      </p>
                    )}

                    {/* URL */}
                    <div className="text-xs text-gray-500 mb-3">
                      {getDomain(bookmark.url)}
                    </div>

                    {/* Tags */}
                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {bookmark.tags.slice(0, 3).map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {bookmark.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                            +{bookmark.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Visit Button */}
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <span>Visit</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Folder className="h-16 w-16 mx-auto text-slate-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Shared Bookmarks Yet
            </h2>
            <p className="text-gray-600 mb-6">
              This category doesn't have any shared bookmarks yet.
            </p>
            <Button asChild>
              <Link to="/discover">Explore Other Categories</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}