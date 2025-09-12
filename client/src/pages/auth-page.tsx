// Authentication page with custom 4-digit password UI
import { useState, useEffect } from "react";
import { useAuth, getStoredUsername } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Bookmark, Shield, Users, Search } from "lucide-react";

// Custom 4-digit password input component
function FourDigitPasswordInput({ 
  value, 
  onChange, 
  placeholder = "Enter 4-digit password"
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [inputs, setInputs] = useState<string[]>(["", "", "", ""]);

  useEffect(() => {
    // Update inputs when value changes externally
    const digits = value.padEnd(4, "").slice(0, 4).split("");
    setInputs(digits);
  }, [value]);

  const handleInputChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return; // Only allow digits
    
    const newInputs = [...inputs];
    newInputs[index] = digit.slice(-1); // Only keep last digit
    setInputs(newInputs);
    
    const newValue = newInputs.join("");
    onChange(newValue);

    // Auto-focus next input
    if (digit && index < 3) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace to move to previous input
    if (e.key === "Backspace" && !inputs[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{placeholder}</Label>
      <div className="flex gap-3 justify-center">
        {inputs.map((digit, index) => (
          <div
            key={index}
            className="relative w-14 h-14 rounded-full border-2 border-input bg-background flex items-center justify-center focus-within:border-ring transition-colors"
          >
            <input
              id={`digit-${index}`}
              type="password"
              inputMode="numeric"
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-full h-full bg-transparent text-center text-xl font-bold outline-none"
              maxLength={1}
              aria-label={`Password digit ${index + 1}`}
              data-testid={`input-password-digit-${index}`}
            />
            {/* Show dot if digit is entered */}
            {digit && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-foreground rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showUsernameInput, setShowUsernameInput] = useState(true);

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
      setLocation("/");
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
    setPassword(""); // Clear password when switching modes
    
    // Show username input for registration or if no stored username for login
    const storedUsername = getStoredUsername();
    setShowUsernameInput(nextMode ? true : !storedUsername);
  };

  const handleUsernameChange = () => {
    setShowUsernameInput(true);
    setUsername("");
  };

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
              {isRegisterMode ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {isRegisterMode 
                ? "Create your account to start organizing your bookmarks"
                : "Sign in to access your bookmark collection"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input - Show conditionally */}
              {showUsernameInput && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
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

              {/* Show current username if hidden */}
              {!showUsernameInput && (
                <div className="space-y-2">
                  <Label>Signing in as</Label>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="font-medium" data-testid="text-current-username">{username}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUsernameChange}
                      data-testid="button-change-username"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {/* 4-Digit Password Input */}
              <FourDigitPasswordInput
                value={password}
                onChange={setPassword}
                placeholder={isRegisterMode ? "Create 4-digit password" : "Enter your 4-digit password"}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={password.length !== 4 || !username || loginMutation.isPending || registerMutation.isPending}
                data-testid={isRegisterMode ? "button-register" : "button-login"}
              >
                {(loginMutation.isPending || registerMutation.isPending) 
                  ? "Please wait..." 
                  : (isRegisterMode ? "Create Account" : "Sign In")
                }
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                onClick={handleModeSwitch}
                data-testid="button-switch-mode"
              >
                {isRegisterMode 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Sign up"
                }
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
          
          <h2 className="text-4xl font-bold mb-6">
            Organize Your Digital Life
          </h2>
          
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