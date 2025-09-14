import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeContext, type Theme } from '@/lib/theme';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const queryClient = useQueryClient();
  const [location] = useLocation();

  // Fetch preferences from database
  const { data: preferences } = useQuery<{ theme?: Theme; viewMode?: 'grid' | 'list' } | null, Error>({
    queryKey: ['/api/preferences'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    // Avoid calling preferences on /auth to prevent any 401s during sign-in
    enabled: location !== '/auth',
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: { theme?: Theme; viewMode?: 'grid' | 'list' }) => {
      return await apiRequest('PATCH', '/api/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
    },
  });

  // Initialize theme from database preferences or localStorage fallback
  useEffect(() => {
    if (preferences?.theme) {
      setTheme(preferences.theme);
    } else {
      // Fallback to localStorage for offline support
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, [preferences]);

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Save to localStorage as fallback
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    // Save to database when user manually changes theme
    updatePreferencesMutation.mutate({ theme: newTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
