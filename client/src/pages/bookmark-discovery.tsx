import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { SEO } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/structured-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Star, Folder, TrendingUp, Users, Globe, Eye } from 'lucide-react';

interface Bookmark {
  id: number;
  name: string;
  description?: string;
  shareId?: string | null;
  url: string;
  createdAt: string;
  screenshotUrl?: string;
  isFavorite: boolean;
  tags?: string[];
  category?: { name: string };
}

interface Category {
  name: string;
  bookmarkCount: number;
}

interface DiscoveryData {
  title: string;
  description: string;
  bookmarks: Bookmark[];
  categories: Category[];
  totalBookmarks: number;
  totalCategories: number;
  structuredData: any;
}

export default function BookmarkDiscovery() {
  const [data, setData] = useState<DiscoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/bookmarks/discovery');
        if (!response.ok) throw new Error('Failed to fetch discovery data');
        const discoveryData = await response.json();
        setData(discoveryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        <SEO
          title="Discover Bookmarks - Memorize Vault"
          description="Explore a curated collection of shared bookmarks from the Memorize Vault community."
        />
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
        <SEO
          title="Discover Bookmarks - Memorize Vault"
          description="Explore a curated collection of shared bookmarks from the Memorize Vault community."
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Discovery</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
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
            { name: 'Discover', url: '/discover' }
          ]),
          data.structuredData
        ]}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Discover Shared Bookmarks
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Explore {data.totalBookmarks} curated resources from the Memorize Vault community
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-full">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{data.totalBookmarks}</div>
                <div className="text-sm text-gray-600">Shared Bookmarks</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 bg-green-100 rounded-full">
                <Folder className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{data.totalCategories}</div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">Community</div>
                <div className="text-sm text-gray-600">Curated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Categories */}
        {data.categories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.categories.map((category) => (
                <Link
                  key={category.name}
                  to={`/discover/category/${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group"
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-white border-gray-200">
                    <CardContent className="p-4 text-center">
                      <Folder className="h-8 w-8 mx-auto mb-2 text-gray-400 group-hover:text-blue-600" />
                      <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {category.bookmarkCount} bookmarks
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Bookmarks */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recently Shared</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4" />
              <span>Updated daily</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto gap-6">
            {data.bookmarks.map((bookmark) => (
              <Card key={bookmark.id} className="hover:shadow-md transition-shadow bg-white border-gray-200">
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

                  {/* Category */}
                  {bookmark.category && (
                    <Link
                      to={`/discover/category/${bookmark.category.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="inline-block mb-3"
                    >
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                        <Folder className="h-3 w-3 mr-1" />
                        {bookmark.category.name}
                      </Badge>
                    </Link>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {bookmark.shareId && (
                      <Link
                        to={`/shared/${bookmark.shareId}`}
                        className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        aria-label={`View shared details for ${bookmark.name}`}
                      >
                        <Eye className="h-3 w-3" />
                        <span>Details</span>
                      </Link>
                    )}
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <span>Visit</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </section>
      </div >
    </div >
  );
}
