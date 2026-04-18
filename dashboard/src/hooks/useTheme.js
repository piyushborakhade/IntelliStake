import { useState, useEffect } from 'react';

const THEMES = {
  indigo:  { accent: '#6366F1', accentDim: 'rgba(99,102,241,0.15)',  accentGlow: 'rgba(99,102,241,0.25)'  },
  emerald: { accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',  accentGlow: 'rgba(16,185,129,0.22)'  },
  amber:   { accent: '#F59E0B', accentDim: 'rgba(245,158,11,0.12)',  accentGlow: 'rgba(245,158,11,0.22)'  },
  violet:  { accent: '#8B5CF6', accentDim: 'rgba(139,92,246,0.15)',  accentGlow: 'rgba(139,92,246,0.25)'  },
};

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('intellistake_theme') || 'indigo'
  );

  useEffect(() => {
    const t = THEMES[theme] || THEMES.indigo;
    const root = document.documentElement;
    root.style.setProperty('--accent-indigo',      t.accent);
    root.style.setProperty('--accent-indigo-dim',  t.accentDim);
    root.style.setProperty('--accent-indigo-glow', t.accentGlow);
    root.style.setProperty('--text-accent',        t.accent);
    // Also update legacy aliases used across existing pages
    root.style.setProperty('--indigo',       t.accent);
    root.style.setProperty('--indigo-dim',   t.accentDim);
    root.style.setProperty('--border-active', t.accent + '70');
    root.style.setProperty('--glow-indigo',  `0 0 40px ${t.accentGlow}`);
  }, [theme]);

  const setTheme = (name) => {
    if (!THEMES[name]) return;
    localStorage.setItem('intellistake_theme', name);
    setThemeState(name);
  };

  return { theme, setTheme, themes: Object.keys(THEMES) };
}

export const THEME_COLORS = {
  indigo:  '#6366F1',
  emerald: '#10B981',
  amber:   '#F59E0B',
  violet:  '#8B5CF6',
};
