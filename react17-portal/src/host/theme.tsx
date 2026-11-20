import React, { createContext, useContext, useMemo, useState } from 'react';
import type { HostProps } from '../mfe/contract';

type Theme = HostProps['theme'];
interface ThemeValue {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
