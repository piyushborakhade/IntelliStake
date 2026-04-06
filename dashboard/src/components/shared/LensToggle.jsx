/**
 * LensToggle.jsx — Admin-only toggle to switch between User/Admin view
 * Appears in the AppShell topbar for admin users only.
 * When "User Preview" is active, all components receive mode="user"
 */
import { useState } from 'react';

export default function LensToggle({ mode, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
      title="The Lens System — switch between user and admin view">
      <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.06em' }}>LENS</span>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2, gap: 2 }}>
        {['admin', 'user'].map(m => (
          <button key={m} onClick={() => onChange(m)} style={{
            padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            fontFamily: 'DM Mono, monospace',
            background: mode === m
              ? m === 'admin' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'
              : 'transparent',
            color: mode === m
              ? m === 'admin' ? '#f59e0b' : '#10b981'
              : '#334155',
            transition: 'all 0.15s',
          }}>
            {m === 'admin' ? '⚙️ RAW' : '🙋 USER'}
          </button>
        ))}
      </div>
    </div>
  );
}
