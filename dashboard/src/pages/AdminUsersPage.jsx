/**
 * AdminUsersPage.jsx — User Management Table
 * Admin only. Full CRUD view of all registered users, KYC tiers, wallet addresses.
 */
import { useState, useEffect } from 'react';
import TrustRing from '../components/shared/TrustRing';

const MOCK_USERS = [
  { email: 'admin@intellistake.ai',    name: 'Piyush Borakhade',    role: 'ADMIN',             kyc: 'INSTITUTIONAL', wallet: '0xA8F4…9C2E', logins: 47, joined: '2025-12-01', active: true },
  { email: 'pm@intellistake.ai',       name: 'Portfolio Manager',   role: 'PORTFOLIO_MANAGER', kyc: 'ACCREDITED',    wallet: '0xB3C7…4F1A', logins: 23, joined: '2025-12-10', active: true },
  { email: 'analyst@intellistake.ai',  name: 'Research Analyst',    role: 'ANALYST',           kyc: 'RETAIL',        wallet: '0xC91D…7E8B', logins: 18, joined: '2026-01-05', active: true },
  { email: 'user1@demo.com',           name: 'Demo User Alpha',     role: 'ANALYST',           kyc: 'RETAIL',        wallet: '0xD2E5…3A9F', logins: 4,  joined: '2026-02-12', active: true },
  { email: 'user2@demo.com',           name: 'Demo User Beta',      role: 'ANALYST',           kyc: 'RETAIL',        wallet: '0xE6F3…2B7C', logins: 1,  joined: '2026-03-20', active: false },
];

const ROLE_COLORS = { ADMIN: '#f59e0b', PORTFOLIO_MANAGER: '#8b5cf6', ANALYST: '#6366f1' };
const KYC_COLORS  = { INSTITUTIONAL: '#10b981', ACCREDITED: '#8b5cf6', RETAIL: '#6366f1' };

export default function AdminUsersPage() {
  const [users, setUsers]     = useState(MOCK_USERS);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('ALL');
  const [selected, setSelected] = useState(null);

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || u.role === filter;
    return matchSearch && matchFilter;
  });

  const th = (label) => ({ padding: '10px 14px', fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'DM Mono, monospace', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' });
  const td = (extra = {}) => ({ padding: '11px 14px', fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.03)', ...extra });

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>User Management</h1>
          <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#334155' }}>{users.length} registered · {users.filter(u => u.active).length} active</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Role filter */}
          {['ALL','ADMIN','PORTFOLIO_MANAGER','ANALYST'].map(r => (
            <button key={r} onClick={() => setFilter(r)} style={{
              padding: '6px 12px', borderRadius: 8, border: `1px solid ${filter === r ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
              background: filter === r ? 'rgba(245,158,11,0.1)' : 'transparent',
              color: filter === r ? '#f59e0b' : '#475569', fontSize: 10, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em',
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
          style={{ width: '100%', paddingLeft: 36, padding: '10px 16px 10px 36px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff', fontSize: 12, outline: 'none', fontFamily: 'DM Mono, monospace', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#f59e0b'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
            <tr>
              {['User','Role','KYC Tier','Wallet','Logins','Joined','Status','Actions'].map(h => (
                <th key={h} style={th(h)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.email} style={{ transition: 'background 0.1s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setSelected(u === selected ? null : u)}>
                <td style={td()}>
                  <div style={{ fontWeight: 700, color: '#f0f4ff', marginBottom: 2 }}>{u.name}</div>
                  <div style={{ color: '#334155', fontSize: 10 }}>{u.email}</div>
                </td>
                <td style={td()}>
                  <span style={{ background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role], padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                    {u.role}
                  </span>
                </td>
                <td style={td()}>
                  <span style={{ color: KYC_COLORS[u.kyc], fontWeight: 700 }}>{u.kyc}</span>
                </td>
                <td style={td()}>
                  <span style={{ color: '#6366f1' }}>{u.wallet}</span>
                </td>
                <td style={{ ...td(), textAlign: 'right' }}>{u.logins}</td>
                <td style={td()}>{u.joined}</td>
                <td style={td()}>
                  <span style={{ color: u.active ? '#10b981' : '#475569', fontWeight: 700 }}>
                    {u.active ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style={td()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); alert(`Impersonate: ${u.email}`); }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 10, cursor: 'pointer' }}>View</button>
                    {u.role !== 'ADMIN' && <button onClick={e => { e.stopPropagation(); setUsers(p => p.map(x => x.email === u.email ? { ...x, active: !x.active } : x)); }} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${u.active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, background: u.active ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', color: u.active ? '#ef4444' : '#10b981', fontSize: 10, cursor: 'pointer' }}>{u.active ? 'Suspend' : 'Restore'}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down panel */}
      {selected && (
        <div style={{ marginTop: 20, padding: '24px', borderRadius: 14, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>USER DRILL-DOWN · {selected.email}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { k: 'Full Name', v: selected.name },
              { k: 'Role', v: selected.role },
              { k: 'KYC Tier', v: selected.kyc },
              { k: 'Wallet', v: selected.wallet },
              { k: 'Total Logins', v: selected.logins },
              { k: 'Join Date', v: selected.joined },
              { k: 'Status', v: selected.active ? 'Active' : 'Suspended' },
              { k: 'Investor DNA', v: 'Balanced · ₹10L–50L' },
            ].map(s => (
              <div key={s.k} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 9, color: '#334155', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', marginBottom: 4 }}>{s.k.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
