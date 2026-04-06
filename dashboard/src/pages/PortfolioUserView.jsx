/**
 * PortfolioUserView.jsx — User-facing Portfolio Page
 * Human-first language. Lens-aware. Shows holdings, allocation, performance.
 * Replaces or supplements existing Portfolio.jsx for the user mode.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TrustRing from '../components/shared/TrustRing';
import MilestoneTimeline from '../components/shared/MilestoneTimeline';
import { translateStartup, formatINR, formatUSD } from '../utils/lensTranslator';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const HOLDINGS = [
  { startup_name: 'Razorpay',  trust_score: 0.91, sector: 'FinTech',    weight: 0.22, funding_stage: 'Series B', invested_inr: 60000,  current_inr: 78200,  estimated_revenue_usd: 250_000_000 },
  { startup_name: 'PhonePe',   trust_score: 0.85, sector: 'FinTech',    weight: 0.20, funding_stage: 'Series B', invested_inr: 55000,  current_inr: 69300,  estimated_revenue_usd: 290_000_000 },
  { startup_name: 'Zepto',     trust_score: 0.82, sector: 'E-commerce', weight: 0.18, funding_stage: 'Series C', invested_inr: 50000,  current_inr: 61500,  estimated_revenue_usd: 180_000_000 },
  { startup_name: 'Groww',     trust_score: 0.78, sector: 'FinTech',    weight: 0.15, funding_stage: 'Series D', invested_inr: 41200,  current_inr: 47800,  estimated_revenue_usd: 95_000_000  },
  { startup_name: 'Meesho',    trust_score: 0.64, sector: 'D2C',        weight: 0.12, funding_stage: 'Series E', invested_inr: 33000,  current_inr: 35100,  estimated_revenue_usd: 150_000_000 },
  { startup_name: 'Ola',       trust_score: 0.51, sector: 'Mobility',   weight: 0.13, funding_stage: 'Series J', invested_inr: 35700,  current_inr: 33100,  estimated_revenue_usd: 110_000_000 },
];

const PORTFOLIO_STATS = { sharpe: 0.9351, sortino: 1.24, var95: -22.3, return_ann: 22.4, vol: 18.0, mc_p70: 2.1 };

const ESCROW_DEAL = {
  name: 'Zepto Escrow',
  total_eth: 0.00796,
  tvl_eth: 0.00796,
  tranches: [
    { id: 'T1', pct: 25, label: 'Initial Release',   condition: 'On deposit',          status: 'RELEASED', amount: '0.00199 ETH', txHash: '0x4f2a…e982', icon: '🚀', userLabel: 'Deal opened — 25% released' },
    { id: 'T2', pct: 25, label: 'GitHub Velocity',   condition: 'HIGH commit velocity', status: 'ACTIVE',   amount: '0.00199 ETH', txHash: null,          icon: '💻', userLabel: 'Active development confirmed' },
    { id: 'T3', pct: 25, label: 'Trust Threshold',   condition: 'trust_score ≥ 0.50',  status: 'LOCKED',   amount: '0.00199 ETH', txHash: null,          icon: '🧠', userLabel: 'AI confidence milestone' },
    { id: 'T4', pct: 25, label: 'Compliance Audit',  condition: 'MCA audit clean',     status: 'LOCKED',   amount: '0.00199 ETH', txHash: null,          icon: '✅', userLabel: 'Final compliance check' },
  ],
};

function useCountUp(target, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let t0 = null;
    const step = (ts) => { if (!t0) t0 = ts; const p = Math.min((ts - t0) / ms, 1); setV(+(p * target).toFixed(0)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [target]);
  return v;
}

const SECTOR_COLORS = { FinTech: '#6366f1', 'E-commerce': '#06b6d4', D2C: '#10b981', Mobility: '#f97316' };

export default function PortfolioUserView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview'); // overview | holdings | escrow
  const [mode] = useState('user');

  const totalInvested = HOLDINGS.reduce((s, h) => s + h.invested_inr, 0);
  const totalCurrent  = HOLDINGS.reduce((s, h) => s + h.current_inr, 0);
  const gain          = totalCurrent - totalInvested;
  const gainPct       = ((gain / totalInvested) * 100).toFixed(1);

  const animTotal = useCountUp(totalCurrent);
  const animGain  = useCountUp(gain);

  const sectorMap = {};
  HOLDINGS.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.weight; });

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: tab === id ? 'rgba(99,102,241,0.15)' : 'transparent',
      color: tab === id ? '#818cf8' : '#475569',
      fontSize: 13, fontWeight: tab === id ? 700 : 400, transition: 'all 0.2s',
    }}>{label}</button>
  );

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>My Portfolio</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>
            {gain >= 0 ? '📈' : '📉'} Your portfolio is <span style={{ color: gain >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{gain >= 0 ? 'growing' : 'down'}</span> overall · Last updated just now
          </p>
        </div>
        <button onClick={() => navigate('/discover')} style={{
          padding: '10px 22px', borderRadius: 999, border: 'none', background: 'var(--grad-indigo)',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
        }}>+ Add Startup</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Value', value: `₹${(animTotal / 100000).toFixed(1)}L`, sub: 'Current portfolio value', color: '#6366f1' },
          { label: gain >= 0 ? 'Total Gain' : 'Total Loss', value: `${gain >= 0 ? '+' : ''}₹${(Math.abs(animGain) / 1000).toFixed(0)}K`, sub: `${gainPct >= 0 ? '+' : ''}${gainPct}% since invested`, color: gain >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Return Quality', value: 'Good', sub: `Returns justify the risk taken — Sharpe ${PORTFOLIO_STATS.sharpe}`, color: '#f59e0b' },
          { label: 'Risk', value: mode === 'user' ? 'Moderate' : `VaR ${PORTFOLIO_STATS.var95}%`, sub: mode === 'user' ? `In a bad year, you might lose up to ${Math.abs(PORTFOLIO_STATS.var95).toFixed(0)}%` : `σ=${PORTFOLIO_STATS.vol}% · Sortino=${PORTFOLIO_STATS.sortino}`, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ padding: '20px 22px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 12 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.03em', marginBottom: 4, fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#334155' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabBtn('overview', 'Overview')}
        {tabBtn('holdings', 'Holdings')}
        {tabBtn('escrow', 'Escrow Deals')}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Sector breakdown */}
          <div style={{ padding: '24px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 20, letterSpacing: '-0.01em' }}>Where your money is</h3>
            {Object.entries(sectorMap).map(([sector, weight]) => (
              <div key={sector} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: SECTOR_COLORS[sector] || '#6366f1', fontWeight: 600 }}>{sector}</span>
                  <span style={{ color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>{(weight * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ height: '100%', width: `${weight * 100}%`, borderRadius: 999, background: SECTOR_COLORS[sector] || '#6366f1', transition: 'width 1s ease', boxShadow: `0 0 8px ${(SECTOR_COLORS[sector] || '#6366f1')}50` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Performance story */}
          <div style={{ padding: '24px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.01em' }}>What our AI says</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8, marginBottom: 16 }}>
              Your portfolio is <strong style={{ color: '#10b981' }}>generating good returns for the risk you're taking</strong>. In most scenarios, it's expected to grow significantly over the next 3 years.
            </p>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 700, marginBottom: 4 }}>Monte Carlo 3-year projection</div>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                In 70% of simulated scenarios, this portfolio <strong style={{ color: '#f0f4ff' }}>more than doubles in value</strong> within 3 years.
              </p>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={() => navigate('/montecarlo')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Run Simulation →
              </button>
              <button onClick={() => navigate('/risk')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
                Risk Audit →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOLDINGS TAB */}
      {tab === 'holdings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {HOLDINGS.map(h => {
            const data = translateStartup(h, mode);
            const pnl  = h.current_inr - h.invested_inr;
            const pct  = ((pnl / h.invested_inr) * 100).toFixed(1);
            return (
              <div key={h.startup_name} style={{ padding: '18px 20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}>
                <TrustRing score={h.trust_score} size={52} mode={mode} showLabel={false} strokeWidth={4} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{h.startup_name}</span>
                    <span style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{h.sector}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{mode === 'user' ? data.stage_display : h.funding_stage} · {(h.weight * 100).toFixed(0)}% of portfolio</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f4ff', marginBottom: 2 }}>₹{(h.current_inr / 1000).toFixed(1)}K</div>
                  <div style={{ fontSize: 12, color: pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>
                    {pnl >= 0 ? '+' : ''}₹{(Math.abs(pnl) / 1000).toFixed(1)}K ({pct}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ESCROW TAB */}
      {tab === 'escrow' && (
        <div style={{ padding: '24px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>Zepto Active Deal</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-ring 2s ease-out infinite' }} />
              On-chain · Sepolia
            </div>
          </div>
          <MilestoneTimeline deal={ESCROW_DEAL} mode={mode} />
          <button onClick={() => navigate('/escrow')} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Open Full Escrow Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
