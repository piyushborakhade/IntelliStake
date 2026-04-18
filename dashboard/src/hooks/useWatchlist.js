import { useState, useCallback } from 'react';

const KEY = 'intellistake_watchlist';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(load);

  const toggle = useCallback((startup) => {
    setWatchlist(prev => {
      const name = startup.startup_name || startup.name;
      const exists = prev.some(s => (s.startup_name || s.name) === name);
      const next = exists
        ? prev.filter(s => (s.startup_name || s.name) !== name)
        : [...prev, { ...startup, savedAt: Date.now() }];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWatched = useCallback((startup) => {
    const name = startup?.startup_name || startup?.name;
    return watchlist.some(s => (s.startup_name || s.name) === name);
  }, [watchlist]);

  return { watchlist, toggle, isWatched, count: watchlist.length };
}
