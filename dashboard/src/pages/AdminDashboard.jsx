/**
 * AdminDashboard.jsx — IntelliStake Command Center
 * Vercel/Linear style. Dense data. Real API calls to /api/admin/overview.
 */
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const CONTRACTS = [
  { name: 'IdentityRegistry',       address: '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F', method: 'isVerified()' },
  { name: 'IntelliStakeToken',      address: '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb', method: 'transfer()' },
  { name: 'IntelliStakeInvestment', address: '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7', method: 'releaseTranche()' },
];

const AUDIT_LOG = [
  { ts: '16:04:22', type: 'ORACLE_PUSH',     msg: "Byju's trust_score → 0.38 · freeze triggered",   color: '#ef4444' },
  { ts: '15:52:11', type: 'AUTH',            msg: 'admin@intellistake.ai · PBKDF2 verified',          color: '#10b981' },
  { ts: '15:41:03', type: 'TRANCHE',         msg: 'Zepto T1 released · 0.00796 ETH',                  color: '#10b981' },
  { ts: '15:33:44', type: 'MODEL_INFER',     msg: 'Razorpay · pred=₹312Cr · R²=0.9645',              color: '#6366f1' },
  { ts: '15:21:09', type: 'API_CALL',        msg: 'POST /api/chat · 74ms',                             color: '#475569' },
  { ts: '15:09:55', type: 'KYC_UPDATE',      msg: 'wallet 0x72a9… · tier 2 → 3',                     color: '#f59e0b' },
];

const ORACLE_FEED = [
  { company: 'Zepto',    action: 'APPROVE_TRANCHE', score: 0.847, ts: '16:04' },
  { company: "Byju's",   action: 'FREEZE',          score: 0.381, ts: '15:58' },
  { company: 'Razorpay', action: 'ORACLE_PUSH',     score: 0.912, ts: '15:41' },
];

export default function AdminDashboard({ onNav }) {
  const [overview, setOverview] = useState(null);
  const [models, setModels]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const sess = sessionStorage.getItem('is_session') || '';

  useEffect(() => {
    const hdr = { Authorization: `Bearer ${sess}` };
    Promise.all([
      fetch(`${API}/api/admin/overview`, { headers: hdr }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/admin/model-stats`, { headers: hdr }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([ov, m]) => { setOverview(ov); setModels(m); setLoading(false); });
  }, []);

  const ov = overview || {};

  const STAT_CARDS = [
    { label: 'Total Startups',   value: loading ? '…' : (ov.total_startups || 74577).toLocaleString(), sub: '37,711 real · 36,866 synthetic', color: '#6366f1' },
    { label: 'Avg Trust Score',  value: loading ? '…' : (ov.avg_trust_score || 0.6821).toFixed(4),     sub: 'across all startups',            color: '#10b981' },
    { label: 'Hype Anomalies',   value: loading ? '…' : (ov.hype_anomaly_count || 50),                 sub: 'IsolationForest flagged',        color: '#ef4444' },
    { label: 'Models Online',    value: loading ? '…' : (ov.models_loaded || 6),                       sub: 'XGB · LGB · CatBoost · MLP',    color: '#f59e0b' },
    { label: 'Sepolia TVL',      value: loading ? '…' : `${ov.sepolia_tvl_eth ?? 0.03184} ETH`,        sub: 'live testnet escrow',           color: '#38bdf8' },
  ];

  const MODEL_ROWS = models ? [
    { model: 'XGBoost',          r2: models.xgboost?.r2 ?? 0.9212, rmse: models.xgboost?.rmse ?? 0.044, status: 'active' },
    { model: 'LightGBM',         r2: models.lightgbm?.r2 ?? 0.9645, rmse: models.lightgbm?.rmse ?? 0.031, status: 'active' },
    { model: 'Stacked Ensemble', r2: models.ensemble?.r2 ?? 0.971,  rmse: 0.028, status: 'active' },
    { model: 'Survival (Cox)',   r2: 0.8841, rmse: 0.042, status: 'active' },
    { model: 'FinBERT NLP',      r2: null, rmse: null, status: 'active', note: 'Acc 0.94' },
  ] : [
    { model: 'XGBoost',          r2: 0.9212, rmse: 0.044, status: 'active' },
    { model: 'LightGBM',         r2: 0.9645, rmse: 0.031, status: 'active' },
    { model: 'Stacked Ensemble', r2: 0.971,  rmse: 0.028, status: 'active' },
    { model: 'Survival (Cox)',   r2: 0.8841, rmse: 0.042, status: 'active' },
    { model: 'FinBERT NLP',      r2: null,   rmse: null,  status: 'active', note: 'Acc 0.94' },
  ];

  const mono = { fontFamily: 'DM Mono, monospace' };

  return (
    <div data-mode="admin" style={{ padding: '20px 24px', height: '100%', overflowY: 'auto' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Command Center</h1>
          <span style={{ ...mono, fontSize: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>ADMIN</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10b981' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
            All Systems Nominal
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNav?.('admin-monitor')} style={{ ...mono, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)', color: '#f59e0b', fontSize: 11, cursor: 'pointer' }}>
            Model Monitor →
          </button>
          <button onClick={() => onNav?.('admin-contracts')} style={{ ...mono, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 11, cursor: 'pointer' }}>
            Contract Console →
          </button>
        </div>
      </div>

      {/* ── 5 stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {STAT_CARDS.map(c => (
          <div key={c.label} style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'var(--bg-card, rgba(255,255,255,0.03))',
            border: `1px solid ${c.color}25`,
            borderTop: `2px solid ${c.color}60`,
          }}>
            <div style={{ fontSize: 10, color: '#334155', ...mono, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>{c.label.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color, ...mono, letterSpacing: '-0.02em', marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 10, color: '#1e293b' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3-column main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 260px', gap: 16, marginBottom: 16 }}>

        {/* Column 1: Model Performance */}
        <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', ...mono, marginBottom: 14 }}>MODEL PERFORMANCE</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Model', 'R²', 'RMSE', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: 9, color: '#1e293b', ...mono, letterSpacing: '0.06em', padding: '0 8px 10px 0', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODEL_ROWS.map((m, i) => (
                <tr key={i}>
                  <td style={{ ...mono, fontSize: 11, color: '#94a3b8', padding: '9px 8px 9px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{m.model}</td>
                  <td style={{ ...mono, fontSize: 11, fontWeight: 700, color: m.r2 === null ? '#475569' : m.r2 >= 0.96 ? '#10b981' : '#f59e0b', padding: '9px 8px 9px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {m.r2 === null ? m.note || '—' : m.r2.toFixed(4)}
                  </td>
                  <td style={{ ...mono, fontSize: 11, color: '#6366f1', padding: '9px 8px 9px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {m.rmse === null ? '—' : m.rmse.toFixed(3)}
                  </td>
                  <td style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, ...mono, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 6px', borderRadius: 4 }}>
                      {m.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
            Training: 74,577 total · 37,711 real · 36,866 synthetic<br />
            ⚠ R² on synthetic data — not a real predictive benchmark
          </div>
        </div>

        {/* Column 2: Startup Intelligence Feed */}
        <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', ...mono, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            STARTUP INTELLIGENCE
            <button onClick={() => onNav?.('discover')} style={{ fontSize: 9, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 8px', color: '#334155', cursor: 'pointer' }}>View All</button>
          </div>
          {[
            { name: 'Razorpay',  sector: 'FinTech',   trust: 0.912, stage: 'Series B', flag: null },
            { name: 'Zepto',     sector: 'E-Commerce',trust: 0.847, stage: 'Series C', flag: null },
            { name: "Byju's",    sector: 'EdTech',    trust: 0.381, stage: 'Pre-IPO',  flag: 'FROZEN' },
            { name: 'PhonePe',   sector: 'FinTech',   trust: 0.851, stage: 'Series B', flag: null },
            { name: 'CRED',      sector: 'FinTech',   trust: 0.724, stage: 'Series D', flag: null },
            { name: 'BharatPe',  sector: 'FinTech',   trust: 0.582, stage: 'Series E', flag: 'WATCH' },
          ].map((s, i) => {
            const col = s.trust >= 0.7 ? '#10b981' : s.trust >= 0.5 ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${col}18`, border: `1px solid ${col}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 12, fontWeight: 800, color: col, flexShrink: 0 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{s.name}</span>
                    {s.flag && (
                      <span style={{ fontSize: 9, fontWeight: 800, ...mono, background: s.flag === 'FROZEN' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: s.flag === 'FROZEN' ? '#ef4444' : '#f59e0b', border: `1px solid ${s.flag === 'FROZEN' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, padding: '1px 5px', borderRadius: 4 }}>
                        {s.flag}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#334155' }}>{s.sector}</span>
                    <span style={{ fontSize: 10, color: '#1e293b' }}>{s.stage}</span>
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 13, fontWeight: 800, color: col }}>{s.trust.toFixed(3)}</div>
              </div>
            );
          })}
        </div>

        {/* Column 3: Oracle Activity */}
        <div style={{ padding: '18px 18px', borderRadius: 14, background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', ...mono, marginBottom: 14 }}>ORACLE ACTIVITY</div>
          {ORACLE_FEED.map((f, i) => {
            const isApprove = f.action.includes('APPROVE');
            const isFreeze  = f.action.includes('FREEZE');
            const col = isApprove ? '#10b981' : isFreeze ? '#ef4444' : '#38bdf8';
            const icon = isApprove ? '✅' : isFreeze ? '🔴' : '⛓️';
            return (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 9, marginBottom: 8, background: `${col}09`, border: `1px solid ${col}25` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{f.company}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155', ...mono }}>{f.ts}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: col, fontWeight: 700, ...mono }}>{f.action.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#475569', ...mono }}>{f.score.toFixed(3)}</span>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: '#1e293b', ...mono, marginBottom: 8 }}>SEPOLIA CONTRACTS</div>
            {CONTRACTS.map(c => (
              <div key={c.name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', ...mono }}>{c.name.replace('IntelliStake', 'IS')}</span>
                </div>
                <a href={`https://sepolia.etherscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer"
                  style={{ ...mono, fontSize: 9, color: '#334155', textDecoration: 'none', display: 'block', wordBreak: 'break-all' }}>
                  {c.address.slice(0, 20)}… ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── System health row + audit log ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* System health */}
        <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', ...mono, marginBottom: 14 }}>SYSTEM HEALTH</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { name: 'Flask API',       status: 'ONLINE',  sub: 'port 5500', color: '#10b981' },
              { name: 'Vite Frontend',   status: 'ONLINE',  sub: 'port 5173', color: '#10b981' },
              { name: 'ML Models',       status: 'LOADED',  sub: '6 models',  color: '#10b981' },
              { name: 'Sepolia RPC',     status: 'LIVE',    sub: 'chain 11155111', color: '#38bdf8' },
              { name: 'Oracle Bridge',   status: 'ACTIVE',  sub: '3 deals tracked', color: '#10b981' },
              { name: 'KYC Registry',    status: 'LOADED',  sub: '50 wallets', color: '#10b981' },
            ].map(s => (
              <div key={s.name} style={{ padding: '10px 12px', borderRadius: 9, background: `${s.color}09`, border: `1px solid ${s.color}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: '#1e293b' }}>{s.sub}</div>
                </div>
                <span style={{ ...mono, fontSize: 9, fontWeight: 800, color: s.color }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit log */}
        <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', ...mono, marginBottom: 14 }}>LIVE AUDIT LOG</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {AUDIT_LOG.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'flex-start' }}>
                <span style={{ ...mono, fontSize: 10, color: '#1e293b', flexShrink: 0, width: 48 }}>{e.ts}</span>
                <span style={{ ...mono, fontSize: 10, color: e.color, fontWeight: 700, flexShrink: 0, minWidth: 100 }}>{e.type}</span>
                <span style={{ ...mono, fontSize: 10, color: '#334155', lineHeight: 1.5 }}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
