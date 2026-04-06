/**
 * CommandPalette.jsx — Cmd+K Universal Search & Navigation
 * Floating search overlay visible from anywhere in the app.
 * Admin users get extra commands (freeze deal, retrain model, etc.)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ALL_COMMANDS = [
  // Navigation
  { id: 'dashboard', label: 'Go to Dashboard', icon: '⚡', group: 'Navigate', path: '/dashboard', keys: ['dashboard', 'home'] },
  { id: 'discover',  label: 'Discover Startups', icon: '🔭', group: 'Navigate', path: '/discover', keys: ['discover', 'startups', 'feed'] },
  { id: 'portfolio', label: 'My Portfolio', icon: '💼', group: 'Navigate', path: '/portfolio', keys: ['portfolio', 'holdings'] },
  { id: 'chatbot',   label: 'AI Copilot Chat', icon: '🤖', group: 'Navigate', path: '/chatbot', keys: ['chat', 'ai', 'copilot'] },
  { id: 'company',   label: 'Company Intelligence', icon: '🔬', group: 'Navigate', path: '/company', keys: ['company', 'startup', 'profile'] },
  { id: 'escrow',    label: 'Milestone Escrow', icon: '🔐', group: 'Navigate', path: '/escrow', keys: ['escrow', 'milestone', 'blockchain'] },
  { id: 'oracle',    label: 'Oracle Bridge', icon: '⛓️', group: 'Navigate', path: '/oracle', keys: ['oracle', 'on-chain'] },
  { id: 'kyc',       label: 'KYC / Identity', icon: '🪪', group: 'Navigate', path: '/kyc', keys: ['kyc', 'identity', 'verification'] },
  { id: 'risk',      label: 'Risk Auditor', icon: '🔍', group: 'Navigate', path: '/risk', keys: ['risk', 'audit'] },
  { id: 'valuation', label: 'Valuation Engine', icon: '🧠', group: 'Navigate', path: '/valuation', keys: ['valuation', 'model', 'ai'] },
  { id: 'montecarlo',label: 'Monte Carlo Simulator', icon: '🎲', group: 'Navigate', path: '/montecarlo', keys: ['monte', 'carlo', 'simulation', 'var'] },
  { id: 'sentiment', label: 'Sentiment Analysis', icon: '📡', group: 'Navigate', path: '/sentiment', keys: ['sentiment', 'news', 'finbert'] },
  { id: 'heatmap',   label: 'Galaxy Heatmap', icon: '🌌', group: 'Navigate', path: '/heatmap', keys: ['heatmap', 'galaxy', 'sector'] },
  { id: 'terminal',  label: 'News Terminal', icon: '📰', group: 'Navigate', path: '/terminal', keys: ['terminal', 'news'] },
  { id: 'profile',   label: 'My Profile', icon: '👤', group: 'Navigate', path: '/profile', keys: ['profile', 'account'] },

  // Admin-only
  { id: 'admin',         label: 'Admin Command Center', icon: '👑', group: 'Admin', path: '/admin', adminOnly: true, keys: ['admin', 'command', 'center'] },
  { id: 'admin-users',   label: 'User Management', icon: '👥', group: 'Admin', path: '/admin-users', adminOnly: true, keys: ['users', 'management'] },
  { id: 'admin-monitor', label: 'Model Monitor', icon: '📊', group: 'Admin', path: '/admin-monitor', adminOnly: true, keys: ['model', 'monitor', 'metrics'] },
  { id: 'admin-contracts',label: 'Contract Console', icon: '⛓️', group: 'Admin', path: '/admin-contracts', adminOnly: true, keys: ['contract', 'console', 'sepolia'] },
];

const QUICK_ACTIONS = [
  { id: 'q-razorpay',  label: 'Analyze Razorpay', icon: '🔍', desc: 'Trust: 0.91 · FinTech', path: '/company' },
  { id: 'q-zepto',     label: 'Analyze Zepto', icon: '🔍', desc: 'Trust: 0.82 · E-commerce', path: '/company' },
  { id: 'q-portfolio', label: 'Optimize my portfolio', icon: '💼', desc: 'Black-Litterman · Sharpe 0.93', path: '/portfolio' },
  { id: 'q-monte',     label: 'Run Monte Carlo', icon: '🎲', desc: '10K paths · 3yr horizon', path: '/montecarlo' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen) {
      setQuery(''); setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const q = query.toLowerCase();
    const filtered = ALL_COMMANDS.filter(c => {
      if (c.adminOnly && !isAdmin) return false;
      return c.label.toLowerCase().includes(q) || c.keys?.some(k => k.includes(q));
    });
    setResults(filtered);
    setSelected(0);
  }, [query, isAdmin]);

  const execute = useCallback((cmd) => {
    navigate(cmd.path || `/${cmd.id}`);
    onClose();
  }, [navigate, onClose]);

  const handleKey = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, Math.max(results.length, QUICK_ACTIONS.length) - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) execute(results[selected]);
      else if (!query && QUICK_ACTIONS[selected]) execute(QUICK_ACTIONS[selected]);
    }
  }, [isOpen, results, selected, query, execute, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!isOpen) return null;

  const showQuick = !query;
  const items = showQuick ? QUICK_ACTIONS : results;
  const groups = [...new Set(results.map(r => r.group))];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: '#0a0a0f', borderRadius: 20,
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.1)',
        overflow: 'hidden',
        animation: 'slide-in-right 0.15s ease',
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 16, color: '#475569' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, startups, commands…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#f0f4ff', fontSize: 15, fontFamily: 'DM Sans, sans-serif',
              '::placeholder': { color: '#334155' },
            }}
          />
          <kbd style={{ fontSize: 10, color: '#334155', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 6px', borderRadius: 5, fontFamily: 'DM Mono, monospace' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
          {showQuick && (
            <>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', padding: '6px 18px 4px', fontFamily: 'DM Mono, monospace' }}>QUICK ACTIONS</div>
              {QUICK_ACTIONS.map((a, i) => (
                <div key={a.id} onClick={() => execute(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: selected === i ? 'rgba(99,102,241,0.10)' : 'transparent',
                    borderLeft: selected === i ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                  onMouseEnter={() => setSelected(i)}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{a.desc}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono, monospace' }}>↵</span>
                </div>
              ))}
              <div style={{ margin: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }} />
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 18px', fontFamily: 'DM Mono, monospace' }}>ALL PAGES</div>
              {ALL_COMMANDS.filter(c => !c.adminOnly || isAdmin).slice(0, 6).map((c, i) => (
                <div key={c.id} onClick={() => execute(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={() => {}}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{c.icon}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#1e293b', fontFamily: 'DM Mono, monospace' }}>{c.group}</span>
                </div>
              ))}
            </>
          )}

          {!showQuick && results.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#334155' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔭</div>
              <div style={{ fontSize: 13 }}>No results for "{query}"</div>
            </div>
          )}

          {!showQuick && groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', padding: '6px 18px 2px', fontFamily: 'DM Mono, monospace' }}>{group.toUpperCase()}</div>
              {results.filter(r => r.group === group).map((r, i) => {
                const idx = results.indexOf(r);
                return (
                  <div key={r.id} onClick={() => execute(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
                      cursor: 'pointer', transition: 'background 0.1s',
                      background: selected === idx ? 'rgba(99,102,241,0.10)' : 'transparent',
                      borderLeft: selected === idx ? '2px solid #6366f1' : '2px solid transparent',
                    }}
                    onMouseEnter={() => setSelected(idx)}>
                    <span style={{ fontSize: 16 }}>{r.icon}</span>
                    <span style={{ fontSize: 13, color: '#f0f4ff', fontWeight: 500 }}>{r.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#334155', fontFamily: 'DM Mono, monospace' }}>{r.path}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 16, fontSize: 10, color: '#1e293b', fontFamily: 'DM Mono, monospace' }}>
          <span><kbd style={{ color: '#334155' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ color: '#334155' }}>↵</kbd> open</span>
          <span><kbd style={{ color: '#334155' }}>ESC</kbd> close</span>
          {isAdmin && <span style={{ marginLeft: 'auto', color: '#f59e0b' }}>👑 Admin commands active</span>}
        </div>
      </div>
    </div>
  );
}
