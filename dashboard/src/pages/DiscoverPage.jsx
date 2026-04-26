/**
 * DiscoverPage.jsx — Startup Discovery Feed (User App)
 * Full-width, filterable, personalized startup feed.
 * Filter by sector, stage, trust level, country.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StartupCard from '../components/shared/StartupCard';
import { useWatchlist } from '../hooks/useWatchlist';
import { useLens } from '../context/LensContext';
import { useToast } from '../components/alerts/ToastSystem';

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
  const navigate = useNavigate();
  const [startups, setStartups] = useState(MOCK);
  const [loading,  setLoading]  = useState(true);
  const [sector,   setSector]   = useState('All');
  const [stage,    setStage]    = useState('All');
  const [trust,    setTrust]    = useState(TRUST_FILTERS[0]);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('trust_desc');
  const [nlQuery,  setNlQuery]  = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlFilters, setNlFilters] = useState(null); // parsed NL filters
  const [visible, setVisible] = useState(10);
  const { lens } = useLens();
  const isAdmin  = lens === 'admin';
  const [profileSectors, setProfileSectors] = useState([]);
  const [sectorsToAvoid, setSectorsToAvoid] = useState([]);
  const { toggle, isWatched } = useWatchlist();
  const toast = useToast();

  useEffect(() => {
    fetch(`${API}/api/user/profile`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const profile = d?.profile;
        if (profile) {
        if (Array.isArray(profile.sectors) && profile.sectors.length > 0) {
          setProfileSectors(profile.sectors);
        }
        if (Array.isArray(profile.sectorsToAvoid) && profile.sectorsToAvoid.length > 0) {
          setSectorsToAvoid(profile.sectorsToAvoid);
        }
      }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/api/user/feed?limit=50`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('is_session') || ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setStartups(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runNlSearch = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    try {
      const r = await fetch(`${API}/api/nl-screen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nlQuery }),
      });
      if (r.ok) {
        const d = await r.json();
        setNlFilters(d.filters || null);
        if (d.sector)    setSector(d.sector);
        if (d.stage)     setStage(d.stage);
        if (d.trust_min) setTrust({ label: 'Custom', min: d.trust_min, max: 1 });
      }
    } catch {
      // Fall back to keyword search
      setSearch(nlQuery);
    } finally {
      setNlLoading(false);
    }
  };

  const clearNl = () => { setNlQuery(''); setNlFilters(null); setSector('All'); setStage('All'); setTrust(TRUST_FILTERS[0]); setSearch(''); };

  const filtered = useMemo(() => {
    let list = [...startups];

    // Hard filters (explicit user selections)
    if (sector !== 'All') list = list.filter(s => s.sector === sector || s.industry === sector);
    if (stage  !== 'All') list = list.filter(s => s.funding_stage === stage);
    list = list.filter(s => (s.trust_score || 0) >= trust.min && (s.trust_score || 0) < (trust.max === 1 ? 1.01 : trust.max));
    if (search) list = list.filter(s => (s.startup_name || s.name || '').toLowerCase().includes(search.toLowerCase()));
    if (nlFilters?.keywords?.length) {
      list = list.filter(s => nlFilters.keywords.some(k => (s.startup_name || s.sector || '').toLowerCase().includes(k.toLowerCase())));
    }
    // Investor mode: soft-rank by profile preference (never exclude — just boost matches to top)
    if (!isAdmin && (profileSectors.length > 0 || sectorsToAvoid.length > 0)) {
      list = list.map(s => {
        const sec = s.sector || s.industry || '';
        const match  = profileSectors.length > 0 && profileSectors.includes(sec);
        const avoid  = sectorsToAvoid.length > 0 && sectorsToAvoid.includes(sec);
        return { ...s, _profileBoost: match ? 1 : avoid ? -1 : 0 };
      });
    }
    list.sort((a, b) => {
      // Profile boost takes precedence over user sort only when no explicit sort applied
      const boostDiff = ((b._profileBoost || 0) - (a._profileBoost || 0));
      if (boostDiff !== 0 && sort === 'trust_desc') return boostDiff !== 0 ? boostDiff : (b.trust_score || 0) - (a.trust_score || 0);
      if (sort === 'trust_desc') return (b.trust_score || 0) - (a.trust_score || 0);
      if (sort === 'trust_asc')  return (a.trust_score || 0) - (b.trust_score || 0);
      if (sort === 'employees')  return (b.employee_count || 0) - (a.employee_count || 0);
      if (sort === 'revenue')    return (b.estimated_revenue_usd || 0) - (a.estimated_revenue_usd || 0);
      return 0;
    });
    return list;
  }, [startups, sector, stage, trust, search, sort, profileSectors, sectorsToAvoid, isAdmin, nlFilters]);

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

      {/* NL Screener */}
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', marginBottom: 8 }}>AI STARTUP SCREENER</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={nlQuery}
            onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runNlSearch()}
            placeholder="Describe what you're looking for… e.g. 'profitable FinTech startups with high trust scores'"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(255,255,255,0.04)', color: '#f0f4ff', fontSize: 13,
              fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button onClick={runNlSearch} disabled={nlLoading || !nlQuery.trim()} style={{
            padding: '12px 20px', borderRadius: 10, border: 'none', cursor: nlLoading ? 'default' : 'pointer',
            background: nlLoading || !nlQuery.trim() ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.7)',
            color: nlLoading || !nlQuery.trim() ? '#475569' : '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}>{nlLoading ? 'Searching…' : '🔍 Search'}</button>
          {nlFilters && <button onClick={clearNl} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#475569', cursor: 'pointer', fontSize: 12 }}>✕ Clear</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {['Show me profitable FinTech startups', 'Early stage SaaS in Bangalore', 'High growth D2C with strong fundamentals'].map(ex => (
            <button key={ex} onClick={() => { setNlQuery(ex); }} style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 20,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
              color: '#818cf8', cursor: 'pointer',
            }}>{ex}</button>
          ))}
        </div>
        {nlFilters && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#10b981' }}>
            ✓ AI parsed: sector={nlFilters.sector || 'any'} · stage={nlFilters.stage || 'any'} · trust≥{nlFilters.trust_min || 0}
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Discover Startups</h1>
          {isAdmin && (
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontWeight: 700, letterSpacing: '0.06em' }}>ADMIN VIEW</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: '#475569' }}>
          {isAdmin
            ? `${filtered.length.toLocaleString()} startups · All sectors · Raw trust scores shown`
            : `${filtered.length.toLocaleString()} startups match your profile · Ranked by AI trust score`}
        </p>
      </div>

      {/* Investor: sector filter notice */}
      {!isAdmin && (profileSectors.length > 0 || sectorsToAvoid.length > 0) && (
        <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#818cf8' }}>
            {profileSectors.length > 0 && <span>Ranked first: <strong>{profileSectors.slice(0,3).join(', ')}{profileSectors.length > 3 ? ` +${profileSectors.length - 3}` : ''}</strong></span>}
            {sectorsToAvoid.length > 0 && <span style={{ marginLeft: 10, color: '#f87171' }}>De-ranked: <strong>{sectorsToAvoid.join(', ')}</strong></span>}
          </div>
          <span style={{ fontSize: 11, color: '#334155' }}>From your investor profile</span>
        </div>
      )}

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
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No startups match your filters</h3>
          <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>Try adjusting your search or filters</p>
          <button onClick={() => { setSearch(''); setNlQuery(''); setNlFilters(null); setSector('All'); setStage('All'); setTrust(TRUST_FILTERS[0]); }} style={{
            background: 'var(--indigo)', color: 'white', border: 'none',
            padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
          }}>Clear filters</button>
        </div>
      ) : (
        <div className="startup-feed-grid" style={{ display: 'flex', flexDirection: 'column', gap: isAdmin ? 6 : 10 }}>
          {isAdmin && (
            /* Admin: table header row */
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', gap: 12, padding: '6px 16px', fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.07em' }}>
              <span>STARTUP</span><span>SECTOR</span><span>STAGE</span><span>EMPLOYEES</span><span style={{ textAlign: 'right' }}>TRUST SCORE</span>
            </div>
          )}
          {filtered.slice(0, visible).map((s, i) => {
            const score = s.trust_score || 0;
            const col   = score >= 0.7 ? '#10b981' : score >= 0.5 ? '#f59e0b' : '#ef4444';
            return isAdmin ? (
              /* Admin: compact data row */
              <div key={s.startup_name || i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', gap: 12, alignItems: 'center', padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{s.startup_name}</span>
                <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>{s.sector || s.industry || '—'}</span>
                <span style={{ fontSize: 11, color: '#475569' }}>{s.funding_stage || '—'}</span>
                <span style={{ fontSize: 11, color: '#475569', fontFamily: 'DM Mono, monospace' }}>{s.employee_count?.toLocaleString() || '—'}</span>
                <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'DM Mono, monospace', color: col, textAlign: 'right' }}>{score.toFixed(4)}</span>
              </div>
            ) : (
              /* Investor: full card */
              <div key={s.startup_name || i} style={{ position: 'relative' }}>
                <StartupCard
                  startup={s}
                  mode="user"
                  variant="compact"
                  onView={() => navigate(`/startup/${encodeURIComponent(s.startup_name || s.name || 'unknown')}`)}
                  onInvest={() => navigate('/holdings')}
                  matchScore={Math.max(0.3, 0.98 - i * 0.04)}
                />
                <button
                  onClick={() => handleWatchToggle(s)}
                  title={isWatched(s) ? 'Remove from watchlist' : 'Save to watchlist'}
                  style={{
                    position: 'absolute', top: 14, right: 14,
                    background: isWatched(s) ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isWatched(s) ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, padding: '5px 10px', fontSize: 14,
                    cursor: 'pointer', transition: 'all 0.15s',
                    color: isWatched(s) ? '#818cf8' : '#475569',
                  }}
                >
                  {isWatched(s) ? '🔖' : '🏷️'}
                </button>
              </div>
            );
          })}
          {filtered.length > visible && (
            <button onClick={() => setVisible(v => v + 10)} style={{
              alignSelf: 'center', marginTop: 10, padding: '10px 20px', borderRadius: 10,
              border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)',
              color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
  const handleWatchToggle = (startup) => {
    const watched = isWatched(startup);
    toggle(startup);
    toast(watched ? 'Removed from watchlist' : 'Added to watchlist', watched ? 'info' : 'success');
  };
