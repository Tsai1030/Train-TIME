import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'auto';
export type AccentKey = 'blue' | 'teal' | 'violet' | 'coral';

export interface ThemeConfig {
  theme: ThemeMode;
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

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'auto') {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'light' : 'dark';
  }
  return mode;
}

function applyThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.remove();
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = color;
  document.head.appendChild(m);
}

export function useTheme() {
  const [config, setConfig] = useState<ThemeConfig>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    const resolved = resolveTheme(config.theme);
    document.documentElement.setAttribute('data-theme', resolved);
    const themeColor = resolved === 'dark' ? '#0c0c0f' : '#f4f4f6';
    applyThemeColor(themeColor);
  }, [config]);

  useEffect(() => {
    if (config.theme !== 'auto') return;
    const interval = setInterval(() => {
      const resolved = resolveTheme('auto');
      document.documentElement.setAttribute('data-theme', resolved);
      const themeColor = resolved === 'dark' ? '#0c0c0f' : '#f4f4f6';
      applyThemeColor(themeColor);
    }, 60000);
    return () => clearInterval(interval);
  }, [config.theme]);

  const setTheme = useCallback((theme: ThemeMode) => setConfig(c => ({ ...c, theme })), []);
  const setAccent = useCallback((accent: AccentKey) => setConfig(c => ({ ...c, accent })), []);

  return { config, setConfig, setTheme, setAccent };
}
