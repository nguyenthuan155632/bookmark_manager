import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Bookmarks from '@/pages/bookmarks';
import AuthPage from '@/pages/auth-page';
import NotFound from '@/pages/not-found';
import { SharedBookmark } from '@/pages/shared-bookmark';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/lib/protected-route';
import { ThemeProvider } from '@/components/theme-provider';
import SettingsPage from '@/pages/settings';

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Bookmarks} />
      <ProtectedRoute path="/favorites" component={Bookmarks} />
      <ProtectedRoute path="/category/:slug" component={Bookmarks} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/shared/:shareId" component={SharedBookmark} />
      <Route component={NotFound} />
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
            <Router />
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
