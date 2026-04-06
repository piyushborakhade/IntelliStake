/**
 * DiscoverPage.jsx — Startup Discovery Feed (User App)
 * Full-width, filterable, personalized startup feed.
 * Filter by sector, stage, trust level, country.
 */
import { useState, useEffect, useMemo } from 'react';
import StartupCard from '../components/shared/StartupCard';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const SECTORS  = ['All', 'FinTech', 'SaaS', 'D2C', 'Deeptech', 'EdTech', 'HealthTech', 'Climate', 'Mobility'];
const STAGES   = ['All', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Pre-IPO'];
const TRUST_FILTERS = [
  { label: 'All',          min: 0,    max: 1 },
  { label: '🟢 Strong',   min: 0.60, max: 1 },
  { label: '🟡 Moderate', min: 0.45, max: 0.60 },
  { label: '🟠 High Risk',min: 0.35, max: 0.45 },
];

const MOCK = [
  { startup_name: 'Razorpay',  trust_score: 0.91, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 3500,  estimated_revenue_usd: 250_000_000, country: 'India' },
  { startup_name: 'PhonePe',   trust_score: 0.85, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 4800,  estimated_revenue_usd: 290_000_000, country: 'India' },
  { startup_name: 'Zepto',     trust_score: 0.82, sector: 'E-commerce', funding_stage: 'Series C', employee_count: 7000,  estimated_revenue_usd: 180_000_000, country: 'India' },
  { startup_name: 'Groww',     trust_score: 0.78, sector: 'FinTech',    funding_stage: 'Series D', employee_count: 2100,  estimated_revenue_usd: 95_000_000,  country: 'India' },
  { startup_name: 'Nykaa',     trust_score: 0.71, sector: 'D2C',        funding_stage: 'Pre-IPO',  employee_count: 3400,  estimated_revenue_usd: 220_000_000, country: 'India' },
  { startup_name: 'CRED',      trust_score: 0.72, sector: 'FinTech',    funding_stage: 'Series D', employee_count: 1200,  estimated_revenue_usd: 80_000_000,  country: 'India' },
  { startup_name: 'Meesho',    trust_score: 0.64, sector: 'D2C',        funding_stage: 'Series E', employee_count: 8000,  estimated_revenue_usd: 150_000_000, country: 'India' },
  { startup_name: 'Slice',     trust_score: 0.69, sector: 'FinTech',    funding_stage: 'Series B', employee_count: 900,   estimated_revenue_usd: 42_000_000,  country: 'India' },
  { startup_name: 'Ola',       trust_score: 0.51, sector: 'Mobility',   funding_stage: 'Series J', employee_count: 6000,  estimated_revenue_usd: 110_000_000, country: 'India' },
  { startup_name: 'BharatPe',  trust_score: 0.58, sector: 'FinTech',    funding_stage: 'Series E', employee_count: 2400,  estimated_revenue_usd: 68_000_000,  country: 'India' },
  { startup_name: 'ClimateAI', trust_score: 0.63, sector: 'Climate',    funding_stage: 'Series A', employee_count: 180,   estimated_revenue_usd: 12_000_000,  country: 'USA'   },
  { startup_name: 'Healthify', trust_score: 0.67, sector: 'HealthTech', funding_stage: 'Series C', employee_count: 700,   estimated_revenue_usd: 28_000_000,  country: 'India' },
];

const SORT_OPTIONS = [
  { value: 'trust_desc',  label: 'Trust Score ↓' },
  { value: 'trust_asc',   label: 'Trust Score ↑' },
  { value: 'employees',   label: 'Team Size ↓' },
  { value: 'revenue',     label: 'Revenue ↓' },
];

export default function DiscoverPage({ onNav }) {
  const [startups, setStartups] = useState(MOCK);
  const [loading,  setLoading]  = useState(true);
  const [sector,   setSector]   = useState('All');
  const [stage,    setStage]    = useState('All');
  const [trust,    setTrust]    = useState(TRUST_FILTERS[0]);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('trust_desc');
  const [mode]  = useState('user');

  useEffect(() => {
    fetch(`${API}/api/user/feed?limit=50`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setStartups(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...startups];
    if (sector !== 'All') list = list.filter(s => s.sector === sector || s.industry === sector);
    if (stage  !== 'All') list = list.filter(s => s.funding_stage === stage);
    list = list.filter(s => (s.trust_score || 0) >= trust.min && (s.trust_score || 0) < (trust.max === 1 ? 1.01 : trust.max));
    if (search) list = list.filter(s => (s.startup_name || s.name || '').toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      if (sort === 'trust_desc') return (b.trust_score || 0) - (a.trust_score || 0);
      if (sort === 'trust_asc')  return (a.trust_score || 0) - (b.trust_score || 0);
      if (sort === 'employees')  return (b.employee_count || 0) - (a.employee_count || 0);
      if (sort === 'revenue')    return (b.estimated_revenue_usd || 0) - (a.estimated_revenue_usd || 0);
      return 0;
    });
    return list;
  }, [startups, sector, stage, trust, search, sort]);

  const pill = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999,
      border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      color: active ? '#818cf8' : '#475569',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Discover Startups</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>
          {filtered.length.toLocaleString()} startups match your filters · Ranked by AI trust score
        </p>
      </div>

      {/* Search + Sort bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 14 }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search startups…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
              color: '#f0f4ff', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 12, cursor: 'pointer', outline: 'none',
        }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a0f' }}>{o.label}</option>)}
        </select>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em' }}>SECTOR</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SECTORS.map(s => pill(sector === s, () => setSector(s), s))}
        </div>
        <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', marginTop: 4 }}>STAGE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STAGES.map(s => pill(stage === s, () => setStage(s), s))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRUST_FILTERS.map(t => pill(trust.label === t.label, () => setTrust(t), t.label))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ height: 90, borderRadius: 16, backgroundImage: 'linear-gradient(90deg, #0a0a0f 25%, #0d0d1a 50%, #0a0a0f 75%)', backgroundSize: '200% 100%', animation: 'skeleton-pulse 1.5s linear infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#334155' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No startups match these filters</div>
          <div style={{ fontSize: 13 }}>Try adjusting your sector or trust level filters</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((s, i) => (
            <StartupCard
              key={s.startup_name || i}
              startup={s}
              mode={mode}
              variant="compact"
              onView={() => onNav?.('company')}
              onInvest={() => onNav?.('escrow')}
              matchScore={Math.max(0.3, 0.98 - i * 0.04)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
