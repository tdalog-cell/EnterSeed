import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: ThemePreference; setTheme: (theme: ThemePreference) => void } | null>(null);
const KEY = 'enterseed_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, updateTheme] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* Browser storage may be unavailable. */ }
    return 'system';
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const setTheme = (value: ThemePreference) => {
    updateTheme(value);
    try { localStorage.setItem(KEY, value); } catch { /* Still apply for this visit. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}
