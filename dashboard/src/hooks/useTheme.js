import { useState, useEffect } from 'react';

// Single source of truth for all themes across Admin + User + WarRoom
export const THEMES = [
  { id: 'void',   label: '● Void',    desc: 'Deep black (default)' },
  { id: 'aurora', label: '● Aurora',  desc: 'Dark green accents'   },
  { id: 'slate',  label: '● Slate',   desc: 'Dark blue-slate'      },
  { id: 'pure',   label: '○ Light',   desc: 'Light mode'           },
];

const STORAGE_KEY = 'intellistake-theme';

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'void'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Also apply on mount in case another tab set a different theme
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || 'void';
    document.documentElement.setAttribute('data-theme', stored);
  }, []);

  const setTheme = (id) => {
    if (!THEMES.find(t => t.id === id)) return;
    setThemeState(id);
  };

  return { theme, setTheme, themes: THEMES };
}

// Legacy alias — kept so existing imports of THEME_COLORS don't break
export const THEME_COLORS = {
  void:   '#6366F1',
  aurora: '#10B981',
  slate:  '#3B82F6',
  pure:   '#6366F1',
};
