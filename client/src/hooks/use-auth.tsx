// Authentication hook based on javascript_auth_all_persistance integration blueprint
import { createContext, ReactNode, useContext } from 'react';
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';
import { User as SelectUser, InsertUser } from '@shared/schema';
import { getQueryFn, apiRequest, queryClient } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, 'username' | 'password'>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest('POST', '/api/login', credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Clear all cached data when switching users
      queryClient.clear();
      queryClient.setQueryData(['/api/user'], user);
      // Refresh preferences to apply user's saved theme
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
      // Store username in localStorage for future logins
      localStorage.setItem('bookmark_manager_username', user.username);
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest('POST', '/api/register', credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Clear all cached data for new user
      queryClient.clear();
      queryClient.setQueryData(['/api/user'], user);
      // Ensure preferences are fresh for new session
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
      // Store username in localStorage for future logins
      localStorage.setItem('bookmark_manager_username', user.username);
      toast({
        title: 'Registration successful',
        description: 'Welcome to Bookmark Manager!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/logout');
    },
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
      queryClient.setQueryData(['/api/user'], null);
      // Keep username in localStorage for future logins
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Logout failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to get stored username
export function getStoredUsername(): string | null {
  return localStorage.getItem('bookmark_manager_username');
}
