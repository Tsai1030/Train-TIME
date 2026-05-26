import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';
export type AccentKey = 'blue' | 'teal' | 'violet' | 'coral';

export interface ThemeConfig {
  theme: Theme;
  accent: AccentKey;
}

const STORAGE_KEY = 'pulse-theme';

function load(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { theme: 'dark', accent: 'blue' };
}

export function useTheme() {
  const [config, setConfig] = useState<ThemeConfig>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    document.documentElement.setAttribute('data-theme', config.theme);
  }, [config]);

  const setTheme = useCallback((theme: Theme) => setConfig(c => ({ ...c, theme })), []);
  const setAccent = useCallback((accent: AccentKey) => setConfig(c => ({ ...c, accent })), []);

  return { config, setConfig, setTheme, setAccent };
}
