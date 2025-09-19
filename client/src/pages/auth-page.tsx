// Authentication page with username + password UI (multi-character)
import { useState, useEffect, useRef } from 'react';
import { useAuth, getStoredUsername } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Bookmark, Shield, Users, Search, Lock, Brain, Sparkles, Share, User } from 'lucide-react';
import { SEO } from '@/lib/seo';

// Removed the old 4-digit passcode UI in favor of standard password field

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Check for stored username on component mount
  useEffect(() => {
    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegisterMode) {
      registerMutation.mutate({ username, password });
    } else {
      loginMutation.mutate({ username, password });
    }
  };

  const handleModeSwitch = () => {
    const nextMode = !isRegisterMode;
    setIsRegisterMode(nextMode);
    setPassword(''); // Clear password when switching modes
  };

  // Focus username on mount for quicker input
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col lg:flex-row">
      <SEO
        title={
          isRegisterMode
            ? 'Create Account | Memorize Vault – AI Bookmark Manager'
            : 'Sign In | Memorize Vault – AI Bookmark Manager'
        }
        description={
          isRegisterMode
            ? 'Create your Memorize Vault account to build an AI-assisted bookmark manager and shared knowledge base for your team.'
            : 'Sign in to Memorize Vault to manage your AI-powered bookmark manager, shared knowledge base, and organized research library.'
        }
        noindex
      />
      {/* Left Column - Auth Form */}
      <div className="order-1 w-full flex items-start justify-center px-4 py-6 sm:px-10 lg:flex-1 lg:py-10">
        <Card className="relative w-full max-w-md overflow-hidden border border-emerald-200/70 bg-white/90 text-slate-900 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-colors duration-300 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/90 before:via-slate-100/70 before:to-emerald-100/40 before:opacity-95 before:content-[''] after:pointer-events-none after:absolute after:-top-32 after:right-0 after:h-56 after:w-56 after:rounded-full after:bg-emerald-200/50 after:blur-3xl after:opacity-40 dark:border-emerald-500/25 dark:bg-slate-900/55 dark:text-slate-100 dark:before:from-white/12 dark:before:via-white/5 dark:before:to-emerald-400/12 dark:after:bg-emerald-500/25">
          <CardHeader className="relative z-10 space-y-1 pb-3 text-center">
            <CardTitle className="text-2xl font-semibold">
              {isRegisterMode
                ? 'Create Your Memorize Vault Account'
                : 'Sign In to Memorize Vault'}
            </CardTitle>
            {isRegisterMode ? (
              <CardDescription>Start organizing your bookmarks in moments.</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-600/20 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-100">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  ref={usernameInputRef}
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Username"
                  required
                  data-testid="input-username"
                  className="pl-12 border-emerald-500/25 bg-white/95 text-slate-900 placeholder:text-slate-500 shadow-sm focus-visible:ring-emerald-500/50 focus-visible:ring-offset-0 dark:border-emerald-500/25 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-emerald-400/50"
                />
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-600/20 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-100">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegisterMode ? 'Create a password' : 'Password'}
                  required
                  minLength={4}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  data-testid="input-password"
                  className="pl-12 border-emerald-500/25 bg-white/95 text-slate-900 placeholder:text-slate-500 shadow-sm focus-visible:ring-emerald-500/50 focus-visible:ring-offset-0 dark:border-emerald-500/25 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-emerald-400/50"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !username ||
                  password.length < 4 ||
                  loginMutation.isPending ||
                  registerMutation.isPending
                }
                data-testid={isRegisterMode ? 'button-register' : 'button-login'}
              >
                {loginMutation.isPending || registerMutation.isPending
                  ? 'Please wait...'
                  : isRegisterMode
                    ? 'Create Account'
                    : 'Sign In'}
              </Button>
            </form>

            <div className="pt-1 text-center">
              <Button
                variant="link"
                size="sm"
                className="text-sm"
                onClick={handleModeSwitch}
                data-testid="button-switch-mode"
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Hero Section */}
      <div className="relative order-2 w-full overflow-hidden rounded-t-3xl bg-primary text-white px-6 py-8 sm:px-12 sm:py-12 lg:order-2 lg:flex-1 lg:rounded-none lg:px-16 dark:text-slate-100">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-emerald-400/30 opacity-80 dark:from-white/10 dark:via-transparent dark:to-emerald-400/20"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary-foreground/20 blur-3xl lg:h-72 lg:w-72 dark:bg-white/5"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-white/15 backdrop-blur dark:bg-white/10">
              <Bookmark className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Memorize Vault – AI Bookmark Manager
            </h1>
          </div>

          <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Build a Collaborative Knowledge Base in Minutes
          </h2>

          <p className="mt-6 text-base text-white/80 sm:text-lg dark:text-slate-200">
            Keep critical bookmarks organized, searchable, and secure. Let AI categorize links,
            generate summaries, and keep your team’s research library always up to date.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm dark:bg-white/10">
              <Search className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                Powerful search and filtering
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm dark:bg-white/10">
              <Users className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                Organize with categories and tags
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm dark:bg-white/10">
              <Brain className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                AI-powered auto-tagging and descriptions
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm dark:bg-white/10">
              <Sparkles className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                Smart content analysis and suggestions
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm sm:col-span-2 dark:bg-white/10">
              <Share className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                Shareable bookmark collections for your team
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm sm:col-span-2 dark:bg-white/10">
              <Shield className="h-5 w-5 text-white/80 dark:text-slate-100" />
              <span className="text-sm text-white/90 sm:text-base dark:text-slate-100/90">
                Secure with passcode protection
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
