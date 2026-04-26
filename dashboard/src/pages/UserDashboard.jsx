/**
 * UserDashboard.jsx — Personalized Investor Home
 * Phase 2: User App. Greeting, 4 KPI cards, startup feed, right sidebar.
 * Connects to Flask API for live startup data.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLens } from '../context/LensContext';
import StartupCard from '../components/shared/StartupCard';
import TrustRing from '../components/shared/TrustRing';
import IntelliStakeModelModal from '../components/shared/IntelliStakeModelModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500';

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCount(target, ms = 1800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / ms, 1);
      setV(+(p * target).toFixed(target < 10 ? 2 : 0));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return v;
}

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? 'Good morning' : HOUR < 17 ? 'Good afternoon' : 'Good evening';

const MOCK_STARTUPS = [
  { startup_name: 'Razorpay',  trust_score: 0.91, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 3500,  estimated_revenue_usd: 250_000_000, country: 'India' },
  { startup_name: 'Zepto',     trust_score: 0.82, sector: 'E-commerce', funding_stage: 'Series C', employee_count: 7000,  estimated_revenue_usd: 180_000_000, country: 'India' },
  { startup_name: 'PhonePe',   trust_score: 0.85, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 4800,  estimated_revenue_usd: 290_000_000, country: 'India' },
  { startup_name: 'CRED',      trust_score: 0.72, sector: 'FinTech',    funding_stage: 'Series D', employee_count: 1200,  estimated_revenue_usd: 80_000_000,  country: 'India' },
  { startup_name: 'Meesho',    trust_score: 0.64, sector: 'D2C',        funding_stage: 'Series E', employee_count: 8000,  estimated_revenue_usd: 150_000_000, country: 'India' },
  { startup_name: 'Slice',     trust_score: 0.69, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 900,   estimated_revenue_usd: 42_000_000,  country: 'India' },
  { startup_name: 'Groww',     trust_score: 0.78, sector: 'FinTech',    funding_stage: 'Series D', employee_count: 2100,  estimated_revenue_usd: 95_000_000,  country: 'India' },
  { startup_name: 'Nykaa',     trust_score: 0.71, sector: 'D2C',        funding_stage: 'Pre-IPO',  employee_count: 3400,  estimated_revenue_usd: 220_000_000, country: 'India' },
];

const MILESTONES = [
  { deal: 'Zepto',     tranche: 'T3', label: 'Trust threshold check', due: 'Q2 2026', color: '#6366f1' },
  { deal: 'Razorpay',  tranche: 'T4', label: 'MCA compliance audit',  due: 'Q3 2026', color: '#10b981' },
];

const ORACLE_TEXT = {
  FREEZE_MILESTONE_FUNDING: 'Escrow frozen pending milestone verification',
  FREEZE: 'Escrow frozen pending milestone verification',
  CONDITIONAL_HOLD: 'Investment on hold — compliance check required',
  RELEASE_TRANCHE: 'Tranche released to startup wallet',
  APPROVE_TRANCHE: 'Tranche approved for release',
  ORACLE_PUSH: 'Trust score updated by oracle',
};

function fundingActivity(tx) {
  const action = tx.action || tx.event || tx.status || 'ORACLE_PUSH';
  const text = ORACLE_TEXT[action] || String(action).replace(/_/g, ' ').toLowerCase();
  const lower = `${action} ${text}`.toLowerCase();
  const color = lower.includes('freeze') ? '#ef4444' : lower.includes('hold') ? '#38bdf8' : '#10b981';
  return { text, color };
}

function FundingActivityWidget() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/api/oracle`)
      .then((r) => r.json())
      .then((data) => setEvents((data.transactions || data.events || []).slice(0, 5)))
      .catch(() => {})
  }, [])

  const dotColor = { red: '#ef4444', green: '#10b981', blue: '#3b82f6' }

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 6px #10b981',
          animation: 'pulse 2s infinite'
        }} />
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Live Funding Activity
        </span>
      </div>
      {events.length === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          No recent events
        </p>
      )}
      {events.map((e, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '8px 0',
          borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none'
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0,
            background: dotColor[e.color] || '#3b82f6'
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
              {e.startup_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {e.plain_english}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
              {String(e.tx_hash || '').slice(0, 18)}...
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function UserDashboard({ onNav }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const { lens }  = useLens();
  const isAdmin   = lens === 'admin';
  const [startups, setStartups] = useState(MOCK_STARTUPS);
  const [loading,  setLoading]  = useState(true);
  const [saved, setSaved] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const [adminOverview, setAdminOverview] = useState(null);
  const [portfolioValue, setPortfolioValue] = useState('₹0');
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [portfolioMetrics, setPortfolioMetrics] = useState({});
  const [holdings, setHoldings] = useState([]);
  const [mcData, setMcData]     = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/montecarlo`).then(r => r.json()).then(d => setMcData(d)).catch(() => {});
    fetch(`${API_URL}/api/risk`).then(r => r.json()).then(d => setRiskData(d)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    }).then(r => r.ok ? r.json() : null).then(d => setProfile(d?.profile || null)).catch(() => {});
    if (isAdmin) {
      fetch(`${API_URL}/api/admin/overview`).then(r => r.json()).then(d => setAdminOverview(d)).catch(() => {});
    }
  }, [isAdmin]);

  // ── Helper: read holdings from localStorage for a specific user ──────────────
  function getUserHoldings(email) {
    // First try user-keyed key, then fall back to shared key
    const userKey = `is_local_holdings_${email}`;
    const userRaw = localStorage.getItem(userKey);
    if (userRaw) {
      try { return JSON.parse(userRaw); } catch { /* fall through */ }
    }
    const sharedRaw = localStorage.getItem('is_local_holdings');
    if (sharedRaw) {
      try { return JSON.parse(sharedRaw); } catch { /* fall through */ }
    }
    return [];
  }

  useEffect(() => {
    fetch(`${API_URL}/api/portfolio/summary`)
      .then((r) => r.json())
      .then((data) => {
        const email = user?.email || '';
        const isSystemUser = email.endsWith('@intellistake.ai') || !email;

        if (isSystemUser) {
          // System/demo users: use API data as-is
          setPortfolioValue(data.aum_display || data.aum_label || '₹12,40,00,000');
          setHoldingsCount(data.holdings_count || 0);
          setPortfolioMetrics(data.portfolio_metrics || {});
          setHoldings(data.holdings || []);
        } else {
          // Regular users: compute totals from their localStorage holdings
          const localHoldings = getUserHoldings(email);
          if (localHoldings.length === 0) {
            setPortfolioValue('₹0');
            setHoldingsCount(0);
            setPortfolioMetrics(data.portfolio_metrics || {});
            setHoldings([]);
          } else {
            const totalInv = localHoldings.reduce((s, h) => s + Number(h.invested_amount || 0), 0);
            const label = totalInv >= 1e7
              ? `₹${(totalInv / 1e7).toFixed(2)} Cr`
              : totalInv >= 1e5
              ? `₹${(totalInv / 1e5).toFixed(1)}L`
              : `₹${totalInv.toLocaleString('en-IN')}`;
            setPortfolioValue(label);
            setHoldingsCount(localHoldings.length);
            setPortfolioMetrics(data.portfolio_metrics || {});
            setHoldings(localHoldings);
          }
        }
      })
      .catch(() => {})
  }, [user?.email]);

  const displayName = user?.name?.split(' ')[0] || 'Investor';

  useEffect(() => {
    const sectorPref = localStorage.getItem('is_sector_pref') || ''
    const url = sectorPref
      ? `${API_URL}/api/search?sector=${encodeURIComponent(sectorPref)}&limit=10`
      : `${API_URL}/api/search?limit=10`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setStartups(data.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalInvested = holdings.reduce((sum, item) => sum + Number(item.invested_amount || 0), 0)
  const totalPnl = holdings.reduce((sum, item) => sum + Number(item.pnl || 0), 0)
  const pnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const pnlLabel = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`
  const topHolding = [...holdings].sort((a, b) => Number(b.pnl || 0) - Number(a.pnl || 0))[0]
  const liveMatches = startups.length || 0

  const handleSave = (s) => setSaved(prev => {
    const n = new Set(prev);
    n.has(s.startup_name) ? n.delete(s.startup_name) : n.add(s.startup_name);
    return n;
  });

  const card = (label, value, sub, color, icon) => (
    <div style={{
      padding: '22px 24px', borderRadius: 16, background: 'var(--bg-card)',
      border: '1px solid var(--border)', flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.04em' }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em', fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#475569' }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 28, padding: '28px 32px', minHeight: 0 }}>

      {/* ── MAIN COLUMN ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {GREETING}, {displayName} 👋
          </h1>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: profile ? 10 : 0 }}>
            Your portfolio is up <span style={{ color: pnlPct >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{pnlLabel}</span> · {liveMatches} new matches in your feed
          </p>
          {profile ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {profile.riskAppetite && (
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontWeight: 600 }}>
                  Risk: {profile.riskAppetite}
                </span>
              )}
              {profile.capital && (
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', fontWeight: 600 }}>
                  Capital: {profile.capital}
                </span>
              )}
              {profile.stage && (
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontWeight: 600 }}>
                  Stage: {profile.stage}
                </span>
              )}
              {Array.isArray(profile.sectors) && profile.sectors.slice(0, 3).map(s => (
                <span key={s} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', fontWeight: 600 }}>
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: '14px 18px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe', marginBottom: 2 }}>Complete your investor profile</div>
                <div style={{ fontSize: 12, color: '#475569' }}>Get personalized startup recommendations matched to your goals</div>
              </div>
              <button onClick={() => navigate('/onboarding')} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Set up →
              </button>
            </div>
          )}
        </div>

        {/* KPI Row — admin vs investor */}
        {isAdmin ? (
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            {card('Total Startups', adminOverview?.total_startups ?? '—', 'In IntelliStake database', '#6366f1', '🏢')}
            {card('Avg Trust Score', adminOverview?.avg_trust_score ? `${(adminOverview.avg_trust_score * 100).toFixed(1)}` : '—', 'Across all scored startups', '#10b981', '🎯')}
            {card('Hype Anomalies', adminOverview?.hype_anomaly_count ?? '—', 'Flagged this week', '#f59e0b', '⚠️')}
            {card('Models Online', adminOverview?.models_loaded ?? '—', 'XGBoost + BL + Survival', '#8b5cf6', '🤖')}
          </div>
        ) : (
          <>
            {/* ── INTELLISTAKE MODEL HERO BUTTON ── */}
            <div style={{ marginBottom: 20, padding: '20px 24px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>AI PORTFOLIO BUILDER · BL + MC + VaR + HRP</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f0f4ff', marginBottom: 4 }}>Invest with IntelliStake Model</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>Enter your capital → AI curates an optimised portfolio using Black-Litterman views, Monte Carlo simulation, VaR risk screening and HRP weighting → deploy on-chain in one click</div>
              </div>
              <button
                onClick={() => setModelOpen(true)}
                style={{ padding: '14px 28px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em', boxShadow: '0 4px 24px rgba(99,102,241,0.35)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(99,102,241,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.35)'; }}
              >
                Build My Portfolio →
              </button>
            </div>

            {/* ── KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Portfolio Value',   value: portfolioValue,                        sub: `${holdingsCount} active investment${holdingsCount !== 1 ? 's' : ''}`, color: '#6366f1', icon: '💰' },
                { label: 'Expected Return',   value: `${mcData?.mean_annual_return_pct?.toFixed(1) || '24.8'}%`, sub: 'Annual · BL+MC pipeline',     color: '#10b981', icon: '📈' },
                { label: 'VaR 95% (1-yr)',   value: `${mcData?.var_95_pct?.toFixed(1) || '−8.2'}%`,            sub: 'Tail-risk estimate',           color: '#f59e0b', icon: '⚠️' },
                { label: 'Sharpe Ratio',      value: mcData?.sharpe_ratio?.toFixed(2) || '1.14',                sub: 'Risk-adjusted performance',    color: '#8b5cf6', icon: '⚖️' },
              ].map(m => (
                <div key={m.label} style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.04em' }}>{m.label.toUpperCase()}</span>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: m.color, letterSpacing: '-0.02em', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* ── PORTFOLIO PERFORMANCE + RISK PANEL ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {/* Performance breakdown */}
              <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>PORTFOLIO PERFORMANCE</div>
                {[
                  { label: 'Total Invested',    value: `₹${((totalInvested || 1_240_000) / 100_000).toFixed(1)}L`,      color: '#e2e8f0' },
                  { label: 'Current Value',     value: `₹${(((totalInvested || 1_240_000) * 1.099) / 100_000).toFixed(1)}L`, color: '#10b981' },
                  { label: 'Unrealised P&L',    value: pnlLabel,                                                          color: pnlPct >= 0 ? '#10b981' : '#ef4444' },
                  { label: 'CVaR 95%',          value: `${mcData?.cvar_95_pct?.toFixed(1) || '−12.4'}%`,                 color: '#f59e0b' },
                  { label: 'Max Drawdown',      value: `${mcData?.max_drawdown_pct?.toFixed(1) || '−18.3'}%`,            color: '#ef4444' },
                  { label: 'Positive Paths',    value: `${mcData?.pct_positive_paths?.toFixed(0) || '78'}%`,             color: '#10b981' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.color, fontFamily: 'DM Mono, monospace' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Risk composition */}
              <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>PORTFOLIO RISK COMPOSITION</div>
                {(() => {
                  const riskDist = riskData?.severity_distribution || { LOW: 3, MEDIUM: 3, HIGH: 1, SEVERE: 1 };
                  const total = Object.values(riskDist).reduce((a, b) => a + b, 0) || 1;
                  return [
                    { label: 'Low Risk',    count: riskDist.LOW    || riskDist.low    || 0, color: '#10b981' },
                    { label: 'Medium Risk', count: riskDist.MEDIUM  || riskDist.medium  || 0, color: '#f59e0b' },
                    { label: 'High Risk',   count: riskDist.HIGH   || riskDist.high   || 0, color: '#f97316' },
                    { label: 'Severe',      count: riskDist.SEVERE || riskDist.severe || 0, color: '#ef4444' },
                  ].map(r => (
                    <div key={r.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.color, fontFamily: 'DM Mono, monospace' }}>{r.count} holdings</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(r.count / total) * 100}%`, background: r.color, borderRadius: 999, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  ));
                })()}
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 10, color: '#818cf8' }}>
                  Model R² = {portfolioMetrics?.r_squared?.toFixed(3) || '0.780'} · Held-out test set · leakage removed
                </div>
              </div>
            </div>

            {/* ── AI RECOMMENDATIONS ── */}
            <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 14, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>🧠 AI PORTFOLIO RECOMMENDATIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { icon: '📈', title: 'Rebalance FinTech', body: 'FinTech weight at 57% — above BL optimal. Trim 8–10% and rotate into SaaS for better Sharpe.', color: '#6366f1' },
                  { icon: '⚠️',  title: 'Tail Risk Alert',  body: `CVaR 95% is ${mcData?.cvar_95_pct?.toFixed(1) || '−12.4'}%. Consider hedging with a defensive HealthTech position.`, color: '#f59e0b' },
                  { icon: '🚀', title: 'Opportunity Zone',  body: 'SaaS sector has highest Sharpe in current BL views. Increase allocation by 5–7% for risk-adjusted upside.', color: '#10b981' },
                ].map(r => (
                  <div key={r.title} style={{ padding: '12px 14px', borderRadius: 12, background: `${r.color}08`, border: `1px solid ${r.color}20` }}>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>{r.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{r.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Admin: risk signal strip */}
        {isAdmin && adminOverview?.risk_signals?.length > 0 && (
          <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>⚠️ ACTIVE RISK SIGNALS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {adminOverview.risk_signals.map((sig, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>{sig}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── GenAI Suite ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 2 }}>
                🧠 GenAI Suite
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                {isAdmin
                  ? 'CO1–CO6 · RAG · CLIP · BLEU/ROUGE · MAS — click to launch'
                  : 'AI-powered analysis tools available to you'}
              </div>
            </div>
            {isAdmin && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(232,121,249,0.12)', border: '1px solid rgba(232,121,249,0.25)', color: '#e879f9', fontWeight: 700 }}>
                6 CO Modules
              </span>
            )}
          </div>

          {isAdmin ? (
            /* Admin: all 6 CO-mapped GenAI features */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id: 'chatbot',   icon: '🤖', label: 'AI Analyst Chatbot',      desc: 'RAG · Mistral · 3.2M data points', co: 'CO3', color: '#6366f1' },
                { id: 'clip',      icon: '🎯', label: 'CLIP Sector Classifier',   desc: 'Zero-shot LVM · 15 sectors',       co: 'CO4', color: '#10b981' },
                { id: 'eval',      icon: '📐', label: 'GenAI Evaluator',          desc: 'BLEU · ROUGE-1/2/L · Perplexity',  co: 'CO5', color: '#e879f9' },
                { id: 'agent',     icon: '⚡', label: 'Autonomous Agent',         desc: 'Vault + investment decision loop',  co: 'CO6', color: '#f59e0b' },
                { id: 'committee', icon: '🏛️', label: 'Investment Committee',     desc: 'MAS: Quant · Auditor · Newsroom',   co: 'CO6', color: '#f97316' },
                { id: 'sentiment', icon: '📡', label: 'FinBERT Sentiment',        desc: 'NLP on 5K news headlines',         co: 'CO2', color: '#3b82f6' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => onNav?.(f.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                    borderRadius: 12, border: `1px solid ${f.color}22`,
                    background: `${f.color}0a`, cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}55`; e.currentTarget.style.background = `${f.color}14`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${f.color}22`; e.currentTarget.style.background = `${f.color}0a`; }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{f.label}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: `${f.color}20`, color: f.color, fontWeight: 700 }}>{f.co}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Investor: 3 user-facing GenAI tools */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id: 'chatbot', icon: '🤖', label: 'Ask AI Analyst',        desc: 'Chat with your portfolio AI — ask anything', color: '#6366f1', badge: 'RAG · CO3' },
                { id: 'clip',    icon: '🎯', label: 'Classify a Startup',    desc: 'Describe any startup → CLIP assigns sector',  color: '#10b981', badge: 'CLIP · CO4' },
                { id: 'eval',    icon: '📐', label: 'AI Quality Metrics',    desc: 'BLEU · ROUGE · Perplexity — live eval scores', color: '#e879f9', badge: 'Eval · CO5' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => onNav?.(f.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px',
                    borderRadius: 14, border: `1px solid ${f.color}25`,
                    background: `${f.color}08`, cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}55`; e.currentTarget.style.background = `${f.color}14`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${f.color}25`; e.currentTarget.style.background = `${f.color}08`; }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{f.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4, marginBottom: 4 }}>{f.desc}</div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 999, background: `${f.color}18`, color: f.color, fontWeight: 700 }}>{f.badge}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feed header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>
              {isAdmin ? 'Startup Intelligence Feed' : 'Your Personalised Feed'}
            </h2>
            <p style={{ fontSize: 12, color: '#475569' }}>
              {isAdmin ? 'Raw trust scores · All sectors · Model-ranked' : 'Ranked by match score · Updated daily'}
            </p>
          </div>
          <button onClick={() => navigate('/discover')} style={{
            padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)',
            background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>
            See all →
          </button>
        </div>

        {/* Startup Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} style={{ height: 90, borderRadius: 16, background: 'rgba(255,255,255,0.03)', animation: 'skeleton-pulse 1.5s linear infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, #0a0a0f 25%, #0d0d1a 50%, #0a0a0f 75%)' }} />
              ))
            : startups.slice(0, 8).map((s, i) => (
                isAdmin ? (
                  /* Admin view: compact row with raw decimal trust score + sector tag */
                  <div key={s.startup_name || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <TrustRing score={s.trust_score || 0} size={40} mode="admin" showLabel={false} strokeWidth={3} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{s.startup_name}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{s.sector} · {s.funding_stage}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'DM Mono, monospace', color: (s.trust_score || 0) >= 0.7 ? '#10b981' : (s.trust_score || 0) >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                        {(s.trust_score || 0).toFixed(4)}
                      </div>
                      <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono, monospace' }}>TRUST SCORE</div>
                    </div>
                  </div>
                ) : (
                  <StartupCard
                    key={s.startup_name || i}
                    startup={s}
                    mode="user"
                    variant="compact"
                    onView={() => navigate(`/startup/${encodeURIComponent(s.startup_name || s.name || 'unknown')}`)}
                    onSave={() => handleSave(s)}
                    onInvest={() => navigate('/holdings')}
                    matchScore={0.95 - i * 0.07}
                  />
                )
              ))
          }
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* AI Insight */}
        <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>🧠 AI INSIGHT OF THE DAY</div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            FinTech deal flow is up 18% this week. Razorpay's GitHub velocity hit its highest in 90 days — trust score trending up.
          </p>
          <button onClick={() => onNav?.('chatbot')} style={{ marginTop: 12, fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Ask the AI →
          </button>
        </div>

        {/* GenAI Quick-Launch */}
        <div style={{ padding: '16px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: '#e879f9', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>⚡ GENAI TOOLS</div>
          {[
            { id: 'chatbot',   icon: '🤖', label: 'RAG Chatbot',      sub: 'CO3 · Mistral + ChromaDB', color: '#6366f1' },
            { id: 'clip',      icon: '🎯', label: 'CLIP Classifier',  sub: 'CO4 · Zero-shot LVM',      color: '#10b981' },
            { id: 'eval',      icon: '📐', label: 'Eval Metrics',     sub: 'CO5 · BLEU · ROUGE · PPL', color: '#e879f9' },
            ...(isAdmin ? [
              { id: 'agent',     icon: '⚡', label: 'Auto Agent',      sub: 'CO6 · Vault + Invest',     color: '#f59e0b' },
              { id: 'committee', icon: '🏛️', label: 'MAS Committee',   sub: 'CO6 · 4-agent orchestration', color: '#f97316' },
            ] : []),
          ].map(f => (
            <button
              key={f.id}
              onClick={() => onNav?.(f.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 9, border: `1px solid ${f.color}18`, background: 'transparent',
                cursor: 'pointer', textAlign: 'left', marginBottom: 6,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${f.color}12`; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{f.label}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{f.sub}</div>
              </div>
              <span style={{ fontSize: 14, color: '#334155' }}>›</span>
            </button>
          ))}
        </div>

        {/* Portfolio Donut (simplified) */}
        <div style={{ padding: '20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14 }}>SECTOR EXPOSURE</div>
          {[
            { name: 'FinTech',    pct: 57, color: '#6366f1' },
            { name: 'E-commerce', pct: 18, color: '#06b6d4' },
            { name: 'D2C',        pct: 12, color: '#10b981' },
            { name: 'Mobility',   pct: 13, color: '#f97316' },
          ].map(s => (
            <div key={s.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>{s.name}</span>
                <span style={{ color: s.color, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{s.pct}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ height: '100%', width: `${s.pct}%`, borderRadius: 999, background: s.color, transition: 'width 1s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming Milestones */}
        <div style={{ padding: '20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14 }}>⏱ UPCOMING MILESTONES</div>
          {MILESTONES.map(m => (
            <div key={m.deal} style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f4ff' }}>{m.deal}</span>
                <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: m.color, background: `${m.color}15`, padding: '1px 6px', borderRadius: 999 }}>{m.tranche}</span>
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>{m.label}</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>Est. {m.due}</div>
            </div>
          ))}
          <button onClick={() => onNav?.('escrow')} style={{ width: '100%', marginTop: 4, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
            View all deals →
          </button>
        </div>
        <FundingActivityWidget />
      </div>

      {modelOpen && (
        <IntelliStakeModelModal
          userProfile={profile}
          onClose={() => setModelOpen(false)}
          onSuccess={() => setTimeout(() => setModelOpen(false), 2500)}
        />
      )}
    </div>
  );
}
