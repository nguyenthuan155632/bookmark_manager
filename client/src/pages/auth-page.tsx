// Authentication page with username + password UI (multi-character)
import { useState, useEffect, useRef } from 'react';
import { useAuth, getStoredUsername } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { Bookmark, Shield, Users, Search, Eye, EyeOff, Lock } from 'lucide-react';

// Removed the old 4-digit passcode UI in favor of standard password field

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showUsernameInput, setShowUsernameInput] = useState(true);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Check for stored username on component mount
  useEffect(() => {
    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setUsername(storedUsername);
      setShowUsernameInput(false); // Skip username input if already stored
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

  // Password strength helper
  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 4) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    // Normalize to 0-3 for UI
    const normalized = Math.min(3, Math.max(0, Math.floor((score / 5) * 3)));
    const label = ['Weak', 'Medium', 'Strong'][normalized];
    const percent = [33, 66, 100][normalized];
    const color = ['bg-red-500', 'bg-amber-500', 'bg-emerald-500'][normalized];
    return { label, percent, color } as const;
  };
  const strength = getStrength(password);

  const handleModeSwitch = () => {
    const nextMode = !isRegisterMode;
    setIsRegisterMode(nextMode);
    setPassword(''); // Clear password when switching modes

    // Show username input for registration or if no stored username for login
    const storedUsername = getStoredUsername();
    setShowUsernameInput(nextMode ? true : !storedUsername);
  };

  const handleUsernameChange = () => {
    setShowUsernameInput(true);
    setUsername('');
  };

  // Manage default focus: username when visible, otherwise password
  useEffect(() => {
    if (showUsernameInput) {
      usernameInputRef.current?.focus();
    } else {
      passwordInputRef.current?.focus();
    }
  }, [showUsernameInput]);

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex">
      {/* Left Column - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isRegisterMode ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription>
              {isRegisterMode
                ? 'Create your account to start organizing your bookmarks'
                : 'Sign in to access your bookmark collection'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input - Show conditionally */}
              {showUsernameInput && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    ref={usernameInputRef}
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    data-testid="input-username"
                  />
                </div>
              )}

              {/* Show current username as a clean label */}
              {!showUsernameInput && (
                <div className="space-y-2">
                  <Label>Signing in as</Label>
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded-md select-none"
                    tabIndex={-1}
                  >
                    <span className="font-medium" data-testid="text-current-username">
                      {username}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUsernameChange}
                      disabled={loginMutation.isPending || registerMutation.isPending}
                      data-testid="button-change-username"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    ref={passwordInputRef}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLockOn((e as any).getModifierState && (e as any).getModifierState('CapsLock'))}
                    placeholder={isRegisterMode ? 'Create a password' : 'Enter your password'}
                    required
                    minLength={4}
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    data-testid="input-password"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loginMutation.isPending || registerMutation.isPending}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Strength: {strength.label}</span>
                      {capsLockOn && (
                        <span className="text-amber-600 dark:text-amber-400">Caps Lock is on</span>
                      )}
                    </div>
                  </div>
                )}
                {password.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Use at least 4 characters. You can use letters, numbers, and symbols.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!username || password.length < 4 || loginMutation.isPending || registerMutation.isPending}
                data-testid={isRegisterMode ? 'button-register' : 'button-login'}
              >
                {loginMutation.isPending || registerMutation.isPending
                  ? 'Please wait...'
                  : isRegisterMode
                    ? 'Create Account'
                    : 'Sign In'}
              </Button>
            </form>

            <div className="text-center">
              <Button variant="link" onClick={handleModeSwitch} data-testid="button-switch-mode">
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Hero Section */}
      <div className="flex-1 bg-primary text-primary-foreground p-8 flex flex-col justify-center">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary-foreground/10 rounded-lg">
              <Bookmark className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold">Memorize</h1>
          </div>

          <h2 className="text-4xl font-bold mb-6">Organize Your Digital Life</h2>

          <p className="text-xl text-primary-foreground/80 mb-8">
            Keep all your important bookmarks organized, searchable, and secure in one place.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-primary-foreground/60" />
              <span>Powerful search and filtering</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary-foreground/60" />
              <span>Organize with categories and tags</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary-foreground/60" />
              <span>Secure with passcode protection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
