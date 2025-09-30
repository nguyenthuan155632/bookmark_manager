import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/lib/protected-route';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';

const LazyBookmarks = lazy(() => import('@/pages/bookmarks'));
const LazyAuthPage = lazy(() => import('@/pages/auth-page'));
const LazyNotFound = lazy(() => import('@/pages/not-found'));
const LazySharedBookmark = lazy(() => import('@/pages/shared-bookmark').then((module) => ({
  default: module.SharedBookmark,
})));
const LazySettingsPage = lazy(() => import('@/pages/settings'));
const LazyDomainTagsPage = lazy(() => import('@/pages/domain-tags'));
const LazyDocumentationPage = lazy(() => import('@/pages/documentation'));
const LazyNewsDiscovery = lazy(() => import('@/pages/news-discovery'));
const LazyAiFeedManagement = lazy(() => import('@/pages/ai-feed-management'));
const LazySharedArticle = lazy(() => import('@/pages/shared-article'));

function Router() {
  return (
    <Switch>
      {/* Public discovery page - AI News Feed */}
      <Route path="/discover" component={() => <LazyNewsDiscovery />} />

      {/* Protected routes */}
      <ProtectedRoute path="/" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/favorites" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/category/:slug" component={() => <LazyBookmarks />} />
      <ProtectedRoute path="/domain-tags" component={() => <LazyDomainTagsPage />} />
      <ProtectedRoute path="/settings" component={() => <LazySettingsPage />} />
      <ProtectedRoute path="/ai-feed-management" component={() => <LazyAiFeedManagement />} />

      {/* Public routes */}
      <Route path="/documentation" component={() => <LazyDocumentationPage />} />
      <Route path="/auth" component={() => <LazyAuthPage />} />
      <Route path="/shared/:shareId" component={() => <LazySharedBookmark />} />
      <Route path="/shared-article/:shareId" component={() => <LazySharedArticle />} />

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
