// Authentication page with custom 4-digit password UI
import { useState, useEffect, useRef } from 'react';
import { useAuth, getStoredUsername } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { Bookmark, Shield, Users, Search } from 'lucide-react';

// iPhone-style passcode input component
function PasscodeInput({
  value,
  onChange,
  placeholder = 'Enter 4-digit password',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 4);
    onChange(newValue);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    onChange(pastedText);
  };

  const handleCircleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-center block">{placeholder}</Label>
      <div className="relative">
        {/* Hidden input for capture */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={handleInputChange}
          onPaste={handlePaste}
          disabled={disabled}
          className="sr-only"
          autoComplete="one-time-code"
          aria-label="4-digit passcode"
        />

        {/* Visual circles */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < value.length;
            const isActive = index === value.length && value.length < 4;

            return (
              <button
                key={index}
                type="button"
                onClick={handleCircleClick}
                disabled={disabled}
                className={`
                  size-5 rounded-full border bg-background flex items-center justify-center 
                  transition-all duration-150 ring-offset-background
                  ${isActive ? 'ring-1 ring-primary border-primary' : 'border-input'}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-ring cursor-pointer'}
                `}
                data-testid={`dot-password-digit-${index}`}
                data-filled={isFilled}
                aria-hidden="true"
              >
                {isFilled && (
                  <span className="size-1.5 rounded-full bg-foreground transition-transform duration-150 animate-in zoom-in-50" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(true);
  const usernameInputRef = useRef<HTMLInputElement>(null);

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

    if (password.length !== 4) {
      return; // Don't submit if password isn't 4 digits
    }

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

    // Show username input for registration or if no stored username for login
    const storedUsername = getStoredUsername();
    setShowUsernameInput(nextMode ? true : !storedUsername);
  };

  const handleUsernameChange = () => {
    setShowUsernameInput(true);
    setUsername('');
  };

  // Focus username input when it becomes visible
  useEffect(() => {
    if (showUsernameInput && usernameInputRef.current) {
      usernameInputRef.current.focus();
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

              {/* iPhone-style Passcode Input */}
              <PasscodeInput
                value={password}
                onChange={setPassword}
                placeholder={
                  isRegisterMode ? 'Create 4-digit password' : 'Enter your 4-digit password'
                }
                disabled={loginMutation.isPending || registerMutation.isPending}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  password.length !== 4 ||
                  !username ||
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
