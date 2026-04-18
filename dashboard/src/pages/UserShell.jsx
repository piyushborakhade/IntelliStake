/**
 * UserShell.jsx — Warm retail investor UI
 * Standalone full-screen layout for /u/* routes.
 * Indigo #4F46E5 accent, white cards, Groww-like friendly tone.
 * Tabs: Portfolio / Discover / Watchlist / Analytics (Pro) / Profile
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLens } from '../context/LensContext';
import { useWatchlist } from '../hooks/useWatchlist';
import ProGate from '../components/shared/ProGate';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';
const INDIGO       = '#4F46E5';
const INDIGO_LIGHT = '#EEF2FF';
const INDIGO_MID   = '#818CF8';

// ── Helpers ───────────────────────────────────────────────────────────────────
function inr(n) {
  if (!n && n !== 0) return '₹—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function pct(n, dec = 1) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${Number(n).toFixed(dec)}%`;
}
function trustColor(score) {
  if (score >= 0.7) return '#10b981';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
}
function trustLabel(score) {
  if (score >= 0.7) return 'Strong';
  if (score >= 0.5) return 'Moderate';
  return 'Risky';
}
function sentimentColor(score) {
  if (score >= 0.05) return '#10b981';
  if (score <= -0.05) return '#ef4444';
  return '#f59e0b';
}
function sentimentLabel(score) {
  if (score >= 0.2) return 'Bullish';
  if (score >= 0.05) return 'Mildly +ve';
  if (score <= -0.2) return 'Bearish';
  if (score <= -0.05) return 'Mildly -ve';
  return 'Neutral';
}

// ── Static data ───────────────────────────────────────────────────────────────
const PORTFOLIO_HOLDINGS = [
  { name: 'Razorpay',  sector: 'FinTech',    alloc: 18, trust: 0.91, gain: 32.4,  blWeight: 0.22, hrpWeight: 0.19 },
  { name: 'Zepto',     sector: 'E-commerce', alloc: 14, trust: 0.82, gain: 18.7,  blWeight: 0.18, hrpWeight: 0.15 },
  { name: 'Groww',     sector: 'FinTech',    alloc: 12, trust: 0.78, gain: 24.1,  blWeight: 0.14, hrpWeight: 0.13 },
  { name: 'Nykaa',     sector: 'D2C',        alloc: 10, trust: 0.71, gain: -4.2,  blWeight: 0.10, hrpWeight: 0.12 },
  { name: 'CRED',      sector: 'FinTech',    alloc:  9, trust: 0.72, gain: 11.3,  blWeight: 0.15, hrpWeight: 0.14 },
  { name: 'Healthify', sector: 'HealthTech', alloc:  8, trust: 0.67, gain:  7.9,  blWeight: 0.08, hrpWeight: 0.10 },
  { name: 'Meesho',    sector: 'D2C',        alloc:  7, trust: 0.64, gain: -1.8,  blWeight: 0.12, hrpWeight: 0.09 },
  { name: 'Ola',       sector: 'Mobility',   alloc:  6, trust: 0.51, gain: -9.4,  blWeight: 0.06, hrpWeight: 0.08 },
  { name: 'BharatPe',  sector: 'FinTech',    alloc:  5, trust: 0.58, gain:  3.2,  blWeight: 0.05, hrpWeight: 0.06 },
];

const DISCOVER_STARTUPS = [
  { id: 1,  name: 'Razorpay',     sector: 'FinTech',    stage: 'Series B', trust: 0.91, rev: 250_000_000, team: 3500, tagline: "India's leading payment gateway",        sentiment: 0.32  },
  { id: 2,  name: 'PhonePe',      sector: 'FinTech',    stage: 'Series B', trust: 0.85, rev: 290_000_000, team: 4800, tagline: 'UPI-first digital payments platform',    sentiment: 0.21  },
  { id: 3,  name: 'Zepto',        sector: 'E-commerce', stage: 'Series C', trust: 0.82, rev: 180_000_000, team: 7000, tagline: '10-minute grocery delivery at scale',    sentiment: 0.18  },
  { id: 4,  name: 'Groww',        sector: 'FinTech',    stage: 'Series D', trust: 0.78, rev:  95_000_000, team: 2100, tagline: 'Millennial-first investing platform',    sentiment: 0.29  },
  { id: 5,  name: 'Nykaa',        sector: 'D2C',        stage: 'Pre-IPO',  trust: 0.71, rev: 220_000_000, team: 3400, tagline: 'Omnichannel beauty & lifestyle',         sentiment: 0.04  },
  { id: 6,  name: 'CRED',         sector: 'FinTech',    stage: 'Series D', trust: 0.72, rev:  80_000_000, team: 1200, tagline: 'Premium credit card rewards ecosystem',  sentiment: 0.11  },
  { id: 7,  name: 'Meesho',       sector: 'D2C',        stage: 'Series E', trust: 0.64, rev: 150_000_000, team: 8000, tagline: 'Social commerce for Bharat',             sentiment: -0.08 },
  { id: 8,  name: 'Healthify Me', sector: 'HealthTech', stage: 'Series C', trust: 0.67, rev:  28_000_000, team: 700,  tagline: 'AI-powered nutrition & fitness coaching', sentiment: 0.22 },
  { id: 9,  name: 'ClimateAI',    sector: 'Climate',    stage: 'Series A', trust: 0.63, rev:  12_000_000, team: 180,  tagline: 'Climate risk intelligence for agri',     sentiment: 0.19  },
  { id: 10, name: 'BharatPe',     sector: 'FinTech',    stage: 'Series E', trust: 0.58, rev:  68_000_000, team: 2400, tagline: 'QR + lending for small merchants',       sentiment: -0.14 },
  { id: 11, name: 'Slice',        sector: 'FinTech',    stage: 'Series B', trust: 0.69, rev:  42_000_000, team: 900,  tagline: 'Gen-Z credit card reimagined',           sentiment: 0.07  },
  { id: 12, name: 'Ola Electric', sector: 'Mobility',   stage: 'Pre-IPO',  trust: 0.51, rev: 110_000_000, team: 6000, tagline: 'EV-first mobility for India',            sentiment: -0.22 },
];

const AI_SIGNALS = [
  { name: 'Razorpay',  action: 'BUY',  confidence: 92, reason: 'High trust + positive sentiment momentum'   },
  { name: 'Groww',     action: 'BUY',  confidence: 84, reason: 'Underweighted relative to trust score'      },
  { name: 'Meesho',    action: 'HOLD', confidence: 71, reason: 'Neutral sentiment; watch for Q2 numbers'    },
  { name: 'BharatPe',  action: 'HOLD', confidence: 68, reason: 'Regulatory overhang, stabilising'           },
  { name: 'Ola',       action: 'SELL', confidence: 77, reason: 'Negative sentiment + trust decay detected'  },
];

const SECTORS = ['All', 'FinTech', 'D2C', 'E-commerce', 'HealthTech', 'Climate', 'Mobility', 'SaaS', 'EdTech'];
const STAGES  = ['All', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Pre-IPO'];

const SHAP_FEATURES = [
  { feature: 'Trust Score',              importance: 0.31, direction: 1  },
  { feature: 'Annual Revenue (log)',     importance: 0.22, direction: 1  },
  { feature: 'Team Size (log)',          importance: 0.15, direction: 1  },
  { feature: 'Funding Stage',            importance: 0.13, direction: 1  },
  { feature: 'Sentiment Compound',       importance: 0.11, direction: 1  },
  { feature: 'GitHub Velocity',          importance: 0.05, direction: 1  },
  { feature: 'Hype Anomaly Flag',        importance: 0.03, direction: -1 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function NavTab({ id, label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px', border: 'none', borderRadius: 10,
        background: active ? INDIGO_LIGHT : 'transparent',
        color: active ? INDIGO : '#6b7280',
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: 'pointer', transition: 'all 0.15s',
        borderBottom: active ? `2px solid ${INDIGO}` : '2px solid transparent',
        position: 'relative',
      }}
    >
      <span>{icon}</span>
      {label}
      {badge && (
        <span style={{ fontSize: 9, fontWeight: 700, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: '#fff', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MetricCard({ label, value, sub, color = INDIGO, icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flex: 1, minWidth: 160,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Startup card (Discover) ────────────────────────────────────────────────────
function StartupDiscoverCard({ s, onWatchlist, isWatched, onSimulate, isPro }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 16, padding: '20px',
        boxShadow: hov ? '0 8px 24px rgba(79,70,229,0.12)' : '0 1px 4px rgba(0,0,0,0.07)',
        border: `1px solid ${hov ? '#c7d2fe' : '#f3f4f6'}`,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{s.name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.tagline}</div>
        </div>
        <button
          onClick={() => onWatchlist(s)}
          style={{
            background: isWatched ? '#fef3c7' : '#f9fafb',
            border: `1px solid ${isWatched ? '#fcd34d' : '#e5e7eb'}`,
            borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14,
          }}
          title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {isWatched ? '★' : '☆'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ background: INDIGO_LIGHT, color: INDIGO, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.sector}</span>
        <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>{s.stage}</span>
        {isPro && s.sentiment != null && (
          <span style={{ background: sentimentColor(s.sentiment) + '18', color: sentimentColor(s.sentiment), borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
            {sentimentLabel(s.sentiment)} {s.sentiment >= 0 ? '+' : ''}{(s.sentiment * 100).toFixed(0)}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Trust Score</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: trustColor(s.trust) }}>{(s.trust * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 10, color: trustColor(s.trust) }}>{trustLabel(s.trust)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Revenue</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{inr(s.rev * 83)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Team</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{s.team.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${s.trust * 100}%`, background: `linear-gradient(90deg, ${trustColor(s.trust)}, ${trustColor(s.trust)}88)`, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>

      <button
        onClick={() => onSimulate(s)}
        style={{
          width: '100%', background: hov ? INDIGO : INDIGO_LIGHT,
          color: hov ? '#fff' : INDIGO, border: 'none', borderRadius: 10,
          padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Simulate Investment
      </button>
    </div>
  );
}

// ── Simulate Modal ─────────────────────────────────────────────────────────────
function SimulateModal({ startup, onClose }) {
  const [amount, setAmount] = useState(50000);
  const [done, setDone]     = useState(false);

  const projected = amount * (1 + (startup.trust * 0.3 + 0.05));
  const gain      = projected - amount;

  function confirm() {
    const holdings = JSON.parse(localStorage.getItem('is_sim_holdings') || '[]');
    const existing = holdings.find(h => h.name === startup.name);
    if (existing) {
      existing.invested += amount;
      existing.current  += projected;
    } else {
      holdings.push({ name: startup.name, sector: startup.sector, invested: amount, current: projected, trust: startup.trust });
    }
    localStorage.setItem('is_sim_holdings', JSON.stringify(holdings));
    setDone(true);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {!done ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Simulate Investment</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>{startup.name} · Trust {(startup.trust * 100).toFixed(0)}%</div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Investment Amount</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>₹</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Math.max(1000, Number(e.target.value)))}
                style={{ width: '100%', paddingLeft: 28, paddingRight: 12, paddingTop: 10, paddingBottom: 10, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 16, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: INDIGO_LIGHT, borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>AI Projected Value (1 yr)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: INDIGO }}>₹{projected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Expected Gain</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>+₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(gain / amount * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
              <button onClick={confirm} style={{ flex: 2, background: INDIGO, border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Confirm Simulation</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Investment Simulated!</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              ₹{amount.toLocaleString('en-IN')} added to your portfolio.<br/>Projected +{(gain / amount * 100).toFixed(1)}% in 1 year.
            </div>
            <button onClick={onClose} style={{ background: INDIGO, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Portfolio ─────────────────────────────────────────────────────────────
function PortfolioTab({ user, isPro }) {
  const simHoldings = JSON.parse(localStorage.getItem('is_sim_holdings') || '[]');
  const dna         = JSON.parse(localStorage.getItem('intellistake_investor_profile') || 'null');
  const [hrp, setHrp] = useState(null);

  useEffect(() => {
    if (isPro) {
      fetch(`${API}/api/portfolio/hrp`).then(r => r.ok ? r.json() : null).then(d => { if (d) setHrp(d) }).catch(() => {});
    }
  }, [isPro]);

  const allHoldings = simHoldings.length > 0 ? simHoldings : PORTFOLIO_HOLDINGS.map(h => ({
    name: h.name, sector: h.sector, trust: h.trust,
    invested: h.alloc * 10000,
    current:  h.alloc * 10000 * (1 + h.gain / 100),
    blWeight: h.blWeight,
    hrpWeight: h.hrpWeight,
  }));

  const totalInvested = allHoldings.reduce((s, h) => s + h.invested, 0);
  const totalCurrent  = allHoldings.reduce((s, h) => s + h.current, 0);
  const totalGain     = totalCurrent - totalInvested;
  const totalGainPct  = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const topPerformer  = [...allHoldings].sort((a, b) => (b.current / b.invested) - (a.current / a.invested))[0];

  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';

  const blSharpe  = 0.9351;
  const hrpSharpe = hrp?.hrp?.sharpe_ratio ?? 0.9482;
  const hrpReturn = hrp?.hrp?.expected_return ?? 24.8;
  const hrpVol    = hrp?.hrp?.volatility ?? 19.2;

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>
          {greeting}, {user?.name?.split(' ')[0] || 'Investor'} 👋
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          Your portfolio is {totalGainPct >= 0 ? 'performing well' : 'under pressure'}.
          {dna ? ` AI risk profile: ${dna.riskAppetite || 'balanced'}.` : ' Complete onboarding to personalise your feed.'}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="Portfolio Value"  value={inr(totalCurrent)} sub={`${pct(totalGainPct)} all time`} color={totalGainPct >= 0 ? '#10b981' : '#ef4444'} icon="💼" />
        <MetricCard label="Top Performer"    value={topPerformer?.name || '—'} sub={topPerformer ? `+${((topPerformer.current / topPerformer.invested - 1) * 100).toFixed(1)}% return` : ''} color="#f59e0b" icon="🏆" />
        <MetricCard label="Avg Trust Score"  value={`${(allHoldings.reduce((s, h) => s + (h.trust || 0.7), 0) / allHoldings.length * 100).toFixed(0)}%`} sub="AI-scored portfolio" color={INDIGO} icon="🎯" />
      </div>

      {/* Upgrade banner for free users */}
      {!isPro && (
        <div style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          borderRadius: 16, padding: '18px 24px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(79,70,229,0.25)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Unlock Pro Features</div>
            <div style={{ fontSize: 12, color: '#c7d2fe' }}>HRP Optimiser · AI Signals · SHAP Explainer · Risk Auditor · Bloomberg Sentiment</div>
          </div>
          <button
            onClick={() => { localStorage.setItem('intellistake_pro', '1'); window.location.reload(); }}
            style={{ background: '#fff', color: INDIGO, border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Try Pro Free
          </button>
        </div>
      )}

      {/* AI Signals — Pro */}
      <ProGate isPro={isPro} label="AI Trade Signals">
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>AI Trade Signals</span>
            <span style={{ fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 10px' }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {AI_SIGNALS.map((sig, i) => {
              const c = sig.action === 'BUY' ? '#10b981' : sig.action === 'SELL' ? '#ef4444' : '#f59e0b';
              return (
                <div key={sig.name} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: i < AI_SIGNALS.length - 1 ? '1px solid #f9fafb' : 'none', gap: 14 }}>
                  <div style={{ width: 52, textAlign: 'center', fontSize: 11, fontWeight: 800, color: c, background: c + '15', borderRadius: 6, padding: '3px 6px' }}>{sig.action}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{sig.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{sig.reason}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{sig.confidence}%</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>confidence</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ProGate>

      {/* HRP vs BL Comparison — Pro */}
      <ProGate isPro={isPro} label="Portfolio Optimizer (HRP vs BL)">
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Portfolio Optimiser</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>Hierarchical Risk Parity vs Black-Litterman</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* BL */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 12 }}>Black-Litterman</div>
              {[
                { label: 'Expected Return', value: '22.4%', color: '#10b981' },
                { label: 'Volatility',      value: '18.7%', color: '#f59e0b' },
                { label: 'Sharpe Ratio',    value: blSharpe.toFixed(4), color: INDIGO },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
            {/* HRP */}
            <div style={{ padding: '16px 20px', background: hrpSharpe > blSharpe ? '#f0fdf4' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>HRP</span>
                {hrpSharpe > blSharpe && <span style={{ fontSize: 9, fontWeight: 700, background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '1px 6px' }}>WINNER</span>}
              </div>
              {[
                { label: 'Expected Return', value: `${hrpReturn.toFixed(1)}%`, color: '#10b981' },
                { label: 'Volatility',      value: `${hrpVol.toFixed(1)}%`,    color: '#f59e0b' },
                { label: 'Sharpe Ratio',    value: hrpSharpe.toFixed(4),       color: INDIGO    },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Weight comparison table */}
          <div style={{ borderTop: '1px solid #f3f4f6' }}>
            <div style={{ padding: '10px 20px', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>BL vs HRP WEIGHTS</div>
            {PORTFOLIO_HOLDINGS.slice(0, 6).map(h => (
              <div key={h.name} style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', gap: 12, borderTop: '1px solid #f9fafb' }}>
                <div style={{ width: 80, fontSize: 13, fontWeight: 600, color: '#374151' }}>{h.name}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: `${h.blWeight * 100 * 3}%`, height: 8, background: '#818CF8', borderRadius: 4, minWidth: 4 }} />
                    <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 600, whiteSpace: 'nowrap' }}>BL {(h.blWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <div style={{ width: `${h.hrpWeight * 100 * 3}%`, height: 8, background: '#10b981', borderRadius: 4, minWidth: 4 }} />
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>HRP {(h.hrpWeight * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProGate>

      {/* Holdings table */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Holdings</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{allHoldings.length} positions</span>
        </div>
        {allHoldings.map((h, i) => {
          const g = ((h.current / h.invested - 1) * 100);
          return (
            <div key={h.name} style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', borderBottom: i < allHoldings.length - 1 ? '1px solid #f9fafb' : 'none', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: INDIGO_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: INDIGO, flexShrink: 0 }}>
                {h.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{h.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{h.sector}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>₹{h.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: 11, color: g >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{pct(g)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Discover ──────────────────────────────────────────────────────────────
function DiscoverTab({ isPro }) {
  const [sector, setSector]     = useState('All');
  const [stage, setStage]       = useState('All');
  const [search, setSearch]     = useState('');
  const [simulate, setSimulate] = useState(null);
  const { watchlist, toggle }   = useWatchlist();

  const filtered = useMemo(() => DISCOVER_STARTUPS.filter(s => {
    if (sector !== 'All' && s.sector !== sector) return false;
    if (stage !== 'All' && s.stage !== stage) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sector, stage, search]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Discover Startups</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          AI-scored opportunities across India's startup ecosystem
          {isPro && ' · Sentiment signals enabled'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search startups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }}
        />
        <select value={sector} onChange={e => setSector(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          {SECTORS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={stage} onChange={e => setStage(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(s => (
          <StartupDiscoverCard
            key={s.id}
            s={s}
            isPro={isPro}
            isWatched={watchlist.some(w => w.name === s.name || w.startup_name === s.name)}
            onWatchlist={() => toggle({ startup_name: s.name, ...s })}
            onSimulate={setSimulate}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No startups match your filters.</div>
          </div>
        )}
      </div>

      {simulate && <SimulateModal startup={simulate} onClose={() => setSimulate(null)} />}
    </div>
  );
}

// ── Tab: Watchlist ─────────────────────────────────────────────────────────────
function WatchlistTab() {
  const { watchlist, toggle } = useWatchlist();

  if (watchlist.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Your watchlist is empty</div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Star startups in Discover to track them here.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Watchlist</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>{watchlist.length} startup{watchlist.length !== 1 ? 's' : ''} tracked</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {watchlist.map((s, i) => {
          const name   = s.startup_name || s.name || '—';
          const trust  = s.trust_score ?? s.trust ?? 0.65;
          const sector = s.sector || '—';
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: INDIGO_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: INDIGO, flexShrink: 0 }}>
                {name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{sector}</div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: trustColor(trust) }}>{(trust * 100).toFixed(0)}%</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Trust</div>
              </div>
              <button onClick={() => toggle(s)} style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>★</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Analytics (Pro) ───────────────────────────────────────────────────────
function AnalyticsTab({ isPro }) {
  const [selected, setSelected] = useState(DISCOVER_STARTUPS[0]);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading]   = useState(false);

  function fetchRisk(startup) {
    setSelected(startup);
    setLoading(true);
    fetch(`${API}/api/risk?startup=${encodeURIComponent(startup.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setRiskData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  const shapBars = SHAP_FEATURES.map(f => ({
    ...f,
    pct: Math.round(f.importance * 100),
    color: f.direction > 0 ? '#10b981' : '#ef4444',
  }));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>SHAP feature importance · Risk scoring · Sentiment breakdown</p>
      </div>

      <ProGate isPro={isPro} label="Analytics — Pro Feature">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* SHAP Explainer */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>SHAP Feature Importance</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>What drives the valuation model</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {shapBars.map(f => (
                <div key={f.feature} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{f.feature}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.pct * 3}%`, background: f.color, borderRadius: 3, maxWidth: '100%', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Auditor */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Risk Auditor</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Multi-factor risk scoring per startup</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {DISCOVER_STARTUPS.slice(0, 6).map(s => (
                  <button
                    key={s.id}
                    onClick={() => fetchRisk(s)}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 8, border: 'none',
                      background: selected?.id === s.id ? INDIGO : INDIGO_LIGHT,
                      color: selected?.id === s.id ? '#fff' : INDIGO,
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {selected && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>{selected.name} — Risk Profile</div>
                  {[
                    { label: 'Market Risk',     score: Math.round((1 - selected.trust) * 100), max: 100 },
                    { label: 'Sentiment Risk',  score: Math.round(Math.max(0, -selected.sentiment * 100 + 30)), max: 100 },
                    { label: 'Liquidity Risk',  score: selected.stage.includes('Pre') ? 72 : 38, max: 100 },
                    { label: 'Hype Risk',       score: selected.trust < 0.65 ? 60 : 20, max: 100 },
                  ].map(r => {
                    const c = r.score > 60 ? '#ef4444' : r.score > 40 ? '#f59e0b' : '#10b981';
                    return (
                      <div key={r.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#374151' }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{r.score}/100</span>
                        </div>
                        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.score}%`, background: c, borderRadius: 3, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment breakdown */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>AI Sentiment — Bloomberg Signal Feed</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>5-model ensemble: FinBERT · FinBERT-tone · RoBERTa · DeBERTa · VADER</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Startup', 'Score', 'Label', 'Sector', 'Trust', 'Stage'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISCOVER_STARTUPS.slice(0, 8).map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111827' }}>{s.name}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: sentimentColor(s.sentiment) }}>{s.sentiment >= 0 ? '+' : ''}{(s.sentiment * 100).toFixed(0)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: sentimentColor(s.sentiment) + '18', color: sentimentColor(s.sentiment), borderRadius: 6, padding: '2px 8px' }}>{sentimentLabel(s.sentiment)}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280' }}>{s.sector}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: trustColor(s.trust) }}>{(s.trust * 100).toFixed(0)}%</td>
                    <td style={{ padding: '10px 16px', color: '#6b7280' }}>{s.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ProGate>
    </div>
  );
}

// ── Tab: Profile ───────────────────────────────────────────────────────────────
function ProfileTab({ user, isPro }) {
  const navigate = useNavigate();
  const dna      = JSON.parse(localStorage.getItem('intellistake_investor_profile') || 'null');

  const dnaFields = dna ? [
    { label: 'Investment Style',  value: dna.investStyle   || '—' },
    { label: 'Time Horizon',      value: dna.timeHorizon   || '—' },
    { label: 'Risk Appetite',     value: dna.riskAppetite  || '—' },
    { label: 'Capital',           value: dna.capital       || '—' },
    { label: 'Preferred Sectors', value: Array.isArray(dna.sectors) ? dna.sectors.join(', ') || '—' : '—' },
    { label: 'Avoid Sectors',     value: Array.isArray(dna.sectorsToAvoid) ? dna.sectorsToAvoid.join(', ') || 'None' : 'None' },
    { label: 'Background',        value: dna.finBackground || '—' },
    { label: 'Hands-On Level',    value: dna.handsOnLevel  || '—' },
    { label: 'Autopilot Mode',    value: dna.autopilot ? 'Yes' : 'No' },
  ] : [];

  return (
    <div>
      {/* User header */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', flexShrink: 0 }}>
          {user?.avatar || '🔍'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{user?.name || 'Investor'}</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>{user?.email}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: isPro ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : '#f3f4f6', color: isPro ? '#fff' : '#6b7280' }}>
            {isPro ? '⚡ PRO' : 'FREE'}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>KYC: {user?.kyc || 'RETAIL'}</div>
        </div>
      </div>

      {/* Wallet */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Wallet Address</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#374151', wordBreak: 'break-all' }}>{user?.wallet || '—'}</div>
      </div>

      {/* Pro plan info */}
      {isPro && (
        <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, color: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>⚡ Pro Plan Active</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['HRP Portfolio Optimiser', 'AI Trade Signals', 'SHAP Explainer', 'Risk Auditor', 'Sentiment Feed', 'Bloomberg Signals'].map(f => (
              <div key={f} style={{ fontSize: 12, color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#a5f3fc' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investor DNA */}
      {dna ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Investor DNA</span>
            <button onClick={() => navigate('/onboarding')} style={{ background: INDIGO_LIGHT, color: INDIGO, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
          </div>
          {dnaFields.map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid #f9fafb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{f.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', maxWidth: '55%', textAlign: 'right' }}>{f.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: INDIGO_LIGHT, borderRadius: 16, padding: '24px', textAlign: 'center', border: `1px dashed ${INDIGO_MID}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>No Investor Profile Yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Complete the onboarding questionnaire to personalise your recommendations.</div>
          <button onClick={() => navigate('/onboarding')} style={{ background: INDIGO, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start Onboarding
          </button>
        </div>
      )}
    </div>
  );
}

// ── UserShell (root) ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'portfolio',  label: 'Portfolio',  icon: '💼', path: '/u/portfolio' },
  { id: 'discover',   label: 'Discover',   icon: '🔭', path: '/u/discover'  },
  { id: 'watchlist',  label: 'Watchlist',  icon: '⭐', path: '/u/watchlist' },
  { id: 'analytics',  label: 'Analytics',  icon: '📊', path: '/u/analytics', proOnly: true },
  { id: 'profile',    label: 'Profile',    icon: '👤', path: '/u/profile'   },
];

export default function UserShell() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, isPro } = useAuth();
  const { setLens } = useLens();

  const activeTab = TABS.find(t => location.pathname.startsWith(t.path))?.id || 'portfolio';

  function goTab(id) {
    const tab = TABS.find(t => t.id === id);
    if (tab) navigate(tab.path);
  }

  function switchToAdmin() {
    setLens('admin');
    navigate('/warroom');
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      {/* Top Navigation */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 58, gap: 16 }}>
          {/* Logo */}
          <button onClick={() => goTab('portfolio')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0, flexShrink: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.05em' }}>
              <span style={{ color: '#111827' }}>INTELLI</span>
              <span style={{ color: INDIGO }}>STAKE</span>
            </span>
          </button>

          {/* Tabs */}
          <nav style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center', overflowX: 'auto' }}>
            {TABS.map(t => (
              <NavTab key={t.id} id={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={goTab} badge={t.proOnly && !isPro ? 'PRO' : undefined} />
            ))}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isPro ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : '#f3f4f6', color: isPro ? '#fff' : '#9ca3af' }}>
              {isPro ? '⚡ PRO' : 'FREE'}
            </div>

            {user.role !== 'ANALYST' && (
              <button onClick={switchToAdmin} title="Switch to Admin War Room" style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#92400e', cursor: 'pointer' }}>
                ⚙️ War Room
              </button>
            )}

            <button onClick={handleLogout} title={`Logged in as ${user.email}`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', border: 'none', cursor: 'pointer', fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {user.avatar || user.name?.charAt(0) || '?'}
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {activeTab === 'portfolio'  && <PortfolioTab  user={user} isPro={isPro} />}
        {activeTab === 'discover'   && <DiscoverTab   isPro={isPro} />}
        {activeTab === 'watchlist'  && <WatchlistTab  />}
        {activeTab === 'analytics'  && <AnalyticsTab  isPro={isPro} />}
        {activeTab === 'profile'    && <ProfileTab    user={user} isPro={isPro} />}
      </main>
    </div>
  );
}
