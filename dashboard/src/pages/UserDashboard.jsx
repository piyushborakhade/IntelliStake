/**
 * UserDashboard.jsx — Personalized Investor Home
 * Phase 2: User App. Greeting, 4 KPI cards, startup feed, right sidebar.
 * Connects to Flask API for live startup data.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLens } from '../context/LensContext';
import StartupCard from '../components/shared/StartupCard';
import TrustRing from '../components/shared/TrustRing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

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

export default function UserDashboard({ onNav }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const { lens }  = useLens();
  const isAdmin   = lens === 'admin';
  const [startups, setStartups] = useState(MOCK_STARTUPS);
  const [loading,  setLoading]  = useState(true);
  const [saved, setSaved] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const [oracleTxs, setOracleTxs] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('intellistake_investor_profile');
      if (raw) setProfile(JSON.parse(raw));
    } catch (_) {}
    fetch(`${API}/api/oracle/transactions`).then(r => r.json()).then(d => {
      const txs = Array.isArray(d) ? d : (d?.transactions || []);
      setOracleTxs(txs.slice(0, 3));
    }).catch(() => {});
    if (isAdmin) {
      fetch(`${API}/api/admin/overview`).then(r => r.json()).then(d => setAdminOverview(d)).catch(() => {});
    }
  }, [isAdmin]);

  const portfolioValue = useCount(284600);
  const weekChange     = useCount(3.2);
  const matches        = useCount(7);

  const displayName = user?.name?.split(' ')[0] || 'Investor';

  useEffect(() => {
    fetch(`${API}/api/user/feed?limit=12`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setStartups(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    <div style={{ display: 'flex', gap: 28, padding: '28px 32px', height: '100%', overflow: 'hidden' }}>

      {/* ── MAIN COLUMN ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {GREETING}, {displayName} 👋
          </h1>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: profile ? 10 : 0 }}>
            Your portfolio is up <span style={{ color: '#10b981', fontWeight: 700 }}>+{weekChange}%</span> this week · {matches} new matches in your feed
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
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            {card('Portfolio Value', `₹${(portfolioValue / 100000).toFixed(1)}L`, '+3.2% this week · 6 holdings', '#6366f1', '💰')}
            {card('Top Performer', 'Razorpay', '🟢 Strong startup · FinTech', '#10b981', '⭐')}
            {card('Your Risk Level', profile?.riskAppetite ? profile.riskAppetite.charAt(0).toUpperCase() + profile.riskAppetite.slice(1) : 'Balanced', 'Based on your investor profile', '#f59e0b', '⚖️')}
            {card('New Matches', `${matches} startups`, 'Matching your profile this week', '#8b5cf6', '✨')}
          </div>
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
                    onView={() => onNav?.('company')}
                    onSave={() => handleSave(s)}
                    onInvest={() => onNav?.('escrow')}
                    matchScore={0.95 - i * 0.07}
                  />
                )
              ))
          }
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

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

        {/* Oracle Feed */}
        <div style={{ padding: '20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.06em' }}>⛓️ ORACLE FEED</div>
            <button onClick={() => onNav?.('oracle')} style={{ fontSize: 10, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 7px', color: '#334155', cursor: 'pointer' }}>View →</button>
          </div>
          {(oracleTxs.length > 0 ? oracleTxs : [
            { startup_name: 'Zepto',    status: 'active',  trust_score: 0.847, action: 'APPROVE_TRANCHE' },
            { startup_name: "Byju's",   status: 'frozen',  trust_score: 0.381, action: 'FREEZE' },
            { startup_name: 'Razorpay', status: 'active',  trust_score: 0.912, action: 'ORACLE_PUSH' },
          ]).map((tx, i) => {
            const name  = tx.startup_name || tx.company || '—';
            const score = parseFloat(tx.trust_score || 0);
            const col   = score >= 0.7 ? '#10b981' : score >= 0.5 ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <TrustRing score={score} size={36} mode="user" showLabel={false} strokeWidth={3} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{name}</div>
                  <div style={{ fontSize: 10, color: col, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>
                    {tx.status === 'frozen' ? '🔴 FROZEN' : tx.status === 'active' ? '🟢 ACTIVE' : (tx.action || '').replace(/_/g, ' ')}
                  </div>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 800, color: col, flexShrink: 0 }}>{score.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
