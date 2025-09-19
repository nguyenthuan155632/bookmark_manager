import { Suspense, lazy } from 'react';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/lib/protected-route';
import { ThemeProvider } from '@/components/theme-provider';

const LazyBookmarks = lazy(() => import('@/pages/bookmarks'));
const LazyAuthPage = lazy(() => import('@/pages/auth-page'));
const LazyNotFound = lazy(() => import('@/pages/not-found'));
const LazySharedBookmark = lazy(() => import('@/pages/shared-bookmark').then((module) => ({
  default: module.SharedBookmark,
}))); 
const LazySettingsPage = lazy(() => import('@/pages/settings'));
const LazyDomainTagsPage = lazy(() => import('@/pages/domain-tags'));
const LazyDocumentationPage = lazy(() => import('@/pages/documentation'));
const LazyBookmarkDiscovery = lazy(() => import('@/pages/bookmark-discovery'));
const LazyCategoryDiscovery = lazy(() => import('@/pages/category-discovery'));

const BookmarksRoute = () => <LazyBookmarks />;
const AuthRoute = () => <LazyAuthPage />;
const NotFoundRoute = () => <LazyNotFound />;
const SharedBookmarkRoute = () => <LazySharedBookmark />;
const SettingsRoute = () => <LazySettingsPage />;
const DomainTagsRoute = () => <LazyDomainTagsPage />;
const DocumentationRoute = () => <LazyDocumentationPage />;
const BookmarkDiscoveryRoute = () => <LazyBookmarkDiscovery />;
const CategoryDiscoveryRoute = () => <LazyCategoryDiscovery />;

function Router() {
  return (
    <Switch>
      {/* Public discovery pages (for SEO) */}
      <Route path="/discover" component={() => <LazyBookmarkDiscovery />} />
      <Route path="/discover/category/:slug" component={() => <LazyCategoryDiscovery />} />

      {/* Protected routes */}
      <ProtectedRoute path="/" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/favorites" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/category/:slug" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/domain-tags" component={() => <LazyDomainTagsPage />} />
      <ProtectedRoute path="/settings" component={() => <LazySettingsPage />} />

      {/* Public routes */}
      <Route path="/documentation" component={() => <LazyDocumentationPage />} />
      <Route path="/auth" component={() => <LazyAuthPage />} />
      <Route path="/shared/:shareId" component={() => <LazySharedBookmark />} />

      <Route component={() => <LazyNotFound />} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ThemeProvider>
            <Suspense fallback={null}>
              <Router />
            </Suspense>
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
