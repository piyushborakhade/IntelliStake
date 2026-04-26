import { useState, useCallback, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/user/watchlist`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const rows = d?.watchlist || [];
        setWatchlist(rows.map(w => ({ ...w, startup_name: w.startup_name || w.name })));
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback((startup) => {
    setWatchlist(prev => {
      const name = startup.startup_name || startup.name;
      const exists = prev.some(s => (s.startup_name || s.name) === name);
      const next = exists
        ? prev.filter(s => (s.startup_name || s.name) !== name)
        : [...prev, { ...startup, savedAt: Date.now() }];
      fetch(`${API}/api/user/watchlist`, {
        method: exists ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}`,
        },
        body: JSON.stringify({ ...startup, startup_name: name }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const isWatched = useCallback((startup) => {
    const name = startup?.startup_name || startup?.name;
    return watchlist.some(s => (s.startup_name || s.name) === name);
  }, [watchlist]);

  return { watchlist, toggle, isWatched, count: watchlist.length };
}
