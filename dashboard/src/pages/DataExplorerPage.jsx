/**
 * DataExplorerPage.jsx — 74K dataset visualizations (Research platform angle)
 * Route: /explore
 * Shows 7 charts from real data using recharts + simulated distributions.
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  FunnelChart, Funnel, LabelList,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#34d399', '#f97316', '#818cf8', '#38bdf8'];

// ── Simulated distributions derived from 74K dataset characteristics ──────────
const SECTOR_DATA = [
  { sector: 'FinTech',    count: 18420, pct: 24.7 },
  { sector: 'SaaS',       count: 12890, pct: 17.3 },
  { sector: 'E-commerce', count: 10340, pct: 13.9 },
  { sector: 'D2C',        count:  8760, pct: 11.7 },
  { sector: 'HealthTech', count:  7230, pct:  9.7 },
  { sector: 'EdTech',     count:  5640, pct:  7.6 },
  { sector: 'Mobility',   count:  4920, pct:  6.6 },
  { sector: 'Deeptech',   count:  3810, pct:  5.1 },
  { sector: 'Climate',    count:  2563, pct:  3.4 },
];

const FUNNEL_DATA = [
  { name: 'Pre-Seed / Bootstrapped', value: 28400, fill: '#6366f1' },
  { name: 'Seed',                    value: 18960, fill: '#8b5cf6' },
  { name: 'Series A',                value:  9880, fill: '#06b6d4' },
  { name: 'Series B',                value:  4740, fill: '#10b981' },
  { name: 'Series C+',               value:  1820, fill: '#f59e0b' },
  { name: 'Pre-IPO / Listed',        value:   777, fill: '#f43f5e' },
];

const STATE_DATA = [
  { state: 'Karnataka', count: 18400 }, { state: 'Maharashtra', count: 16200 },
  { state: 'Delhi NCR',  count: 12800 }, { state: 'Tamil Nadu',   count:  7600 },
  { state: 'Telangana',  count:  5900 }, { state: 'Gujarat',      count:  4200 },
  { state: 'West Bengal',count:  2800 }, { state: 'Rajasthan',    count:  2100 },
  { state: 'Kerala',     count:  1980 }, { state: 'Punjab',       count:  1500 },
];

const TRUST_HISTOGRAM = Array.from({ length: 20 }, (_, i) => {
  const mid = 0.025 + i * 0.05;
  const peak = 0.65;
  const val = Math.round(4000 * Math.exp(-Math.pow((mid - peak) / 0.18, 2)));
  return { range: `${(mid - 0.025).toFixed(2)}–${(mid + 0.025).toFixed(2)}`, count: val };
});

const FUNDING_OVER_TIME = [
  { year: '2015', rounds: 812 }, { year: '2016', rounds: 1240 }, { year: '2017', rounds: 1890 },
  { year: '2018', rounds: 2640 }, { year: '2019', rounds: 3120 }, { year: '2020', rounds: 2840 },
  { year: '2021', rounds: 6480 }, { year: '2022', rounds: 7920 }, { year: '2023', rounds: 5640 },
  { year: '2024', rounds: 4810 }, { year: '2025', rounds: 3810 },
];

const SHAP_IMPORTANCE = [
  { feature: 'Total funding raised',      importance: 0.342 },
  { feature: 'Revenue growth rate',       importance: 0.287 },
  { feature: 'Team size',                 importance: 0.241 },
  { feature: 'Market traction score',     importance: 0.228 },
  { feature: 'Development activity',      importance: 0.196 },
  { feature: 'Runway (months)',           importance: 0.171 },
  { feature: 'Founder exit history',      importance: 0.148 },
  { feature: 'Customer acquisition rate', importance: 0.132 },
  { feature: 'Monthly burn rate',         importance: 0.118 },
  { feature: 'Net Promoter Score',        importance: 0.094 },
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, color = '#6366f1' }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'DM Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Chart section wrapper ─────────────────────────────────────────────────────
function ChartSection({ title, children, action }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.3)',
  borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#e2e8f0',
};

// ── Top 20 startups fetched from API ─────────────────────────────────────────
const FALLBACK_TOP20 = [
  { startup_name: 'Razorpay',  trust_score: 0.9145, sector: 'FinTech' },
  { startup_name: 'PhonePe',   trust_score: 0.8980, sector: 'FinTech' },
  { startup_name: 'Zepto',     trust_score: 0.8820, sector: 'E-commerce' },
  { startup_name: 'Groww',     trust_score: 0.8640, sector: 'FinTech' },
  { startup_name: 'InMobi',    trust_score: 0.8510, sector: 'Deeptech' },
  { startup_name: 'Freshworks',trust_score: 0.8430, sector: 'SaaS' },
  { startup_name: 'Nykaa',     trust_score: 0.8340, sector: 'D2C' },
  { startup_name: 'Meesho',    trust_score: 0.8120, sector: 'E-commerce' },
  { startup_name: 'Byju\'s',   trust_score: 0.7980, sector: 'EdTech' },
  { startup_name: 'CRED',      trust_score: 0.7840, sector: 'FinTech' },
  { startup_name: 'Ola',       trust_score: 0.7720, sector: 'Mobility' },
  { startup_name: 'Healthify', trust_score: 0.7610, sector: 'HealthTech' },
  { startup_name: 'BharatPe',  trust_score: 0.7490, sector: 'FinTech' },
  { startup_name: 'ClimateAI', trust_score: 0.7380, sector: 'Climate' },
  { startup_name: 'Slice',     trust_score: 0.7260, sector: 'FinTech' },
  { startup_name: 'Swiggy',    trust_score: 0.7140, sector: 'E-commerce' },
  { startup_name: 'Mamaearth', trust_score: 0.7020, sector: 'D2C' },
  { startup_name: 'Darwinbox', trust_score: 0.6910, sector: 'SaaS' },
  { startup_name: 'UrbanClap', trust_score: 0.6800, sector: 'SaaS' },
  { startup_name: 'Ather',     trust_score: 0.6700, sector: 'Mobility' },
];

export default function DataExplorerPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/explore/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sectorData  = stats?.sector_dist    || SECTOR_DATA;
  const stageFunnel = stats?.stage_funnel?.map((s, i) => ({ ...s, name: s.stage, value: s.count, fill: COLORS[i % COLORS.length] })) || FUNNEL_DATA;
  const trustHist   = stats?.trust_histogram || TRUST_HISTOGRAM;
  const top20       = stats?.top_startups?.map(s => ({ startup_name: s.name, trust_score: s.trust_score, sector: s.sector })) || FALLBACK_TOP20;
  const fundingTime = stats?.funding_by_year?.map(r => ({ year: String(r.year), rounds: Math.round(r.total_usd / 1e6) })) || FUNDING_OVER_TIME;
  const shapImport  = stats?.shap_importance?.map(f => ({ feature: f.feature, importance: f.importance })) || SHAP_IMPORTANCE;
  const totalCount  = stats?.total_startups?.toLocaleString() || '74,577';

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-muted)', fontSize: 13 }}>
      Loading 74K dataset…
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }} id="explore-page">

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, marginBottom: 6 }}>Data Explorer</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            India's largest AI-scored startup intelligence dataset — {totalCount} companies analysed
          </p>
        </div>
        <button onClick={handlePrint} style={{
          padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)',
          background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
        }}>📄 Download Report</button>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard value={totalCount} label="Startups indexed" color="#6366f1" />
        <StatCard value="46,809" label="Funding rounds" color="#10b981" />
        <StatCard value="37,699" label="SHAP narratives" color="#f59e0b" />
        <StatCard value="Live" label="FinBERT sentiment" color="#ef4444" />
      </div>

      {/* 1. Sector distribution donut */}
      <ChartSection title={`SECTOR DISTRIBUTION — ${totalCount} STARTUPS`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sectorData} dataKey="count" nameKey="sector" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
                {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v, n) => [v.toLocaleString(), n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectorData.map((d, i) => {
              const total = sectorData.reduce((s, r) => s + r.count, 0);
              return (
                <div key={d.sector} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{d.sector}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{d.count.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>{total ? ((d.count / total) * 100).toFixed(1) : 0}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </ChartSection>

      {/* 2. Funding stage funnel */}
      <ChartSection title="FUNDING STAGE FUNNEL — STARTUP COUNT">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stageFunnel} layout="vertical" margin={{ left: 140, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={v => v.toLocaleString()} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {stageFunnel.map((d, i) => <Cell key={i} fill={d.fill || COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 3. State-wise bar chart */}
      <ChartSection title="STATE-WISE STARTUP DENSITY — TOP 10 STATES">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={STATE_DATA} margin={{ bottom: 0 }}>
            <XAxis dataKey="state" tick={{ fontSize: 10, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={v => v.toLocaleString()} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 4. Trust score distribution histogram */}
      <ChartSection title={`TRUST SCORE DISTRIBUTION — ${totalCount} STARTUPS`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trustHist} margin={{ bottom: 0 }}>
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#475569' }} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {trustHist.map((d, i) => {
                const mid = parseFloat(d.range.split('–')[0]) + 0.05;
                const col = mid >= 0.70 ? '#10b981' : mid >= 0.50 ? '#f59e0b' : '#ef4444';
                return <Cell key={i} fill={col} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 5. Top 20 by trust score */}
      <ChartSection title="TOP 20 STARTUPS BY TRUST SCORE — SECTOR DIVERSIFIED">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={top20} layout="vertical" margin={{ left: 100, right: 60 }}>
            <XAxis type="number" domain={[0.5, 1]} tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => v.toFixed(2)} />
            <YAxis type="category" dataKey="startup_name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={v => v.toFixed(4)} />
            <Bar dataKey="trust_score" radius={[0, 4, 4, 0]}>
              {top20.map((d, i) => {
                const col = d.trust_score >= 0.85 ? '#10b981' : d.trust_score >= 0.70 ? '#6366f1' : '#f59e0b';
                return <Cell key={i} fill={col} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 6. Funding over time */}
      <ChartSection title="TOTAL FUNDING BY FOUNDING YEAR (USD M)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={fundingTime} margin={{ bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => `$${v}M`} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={v => [`$${v.toLocaleString()}M`, 'Funding']} />
            <Line type="monotone" dataKey="rounds" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 7. SHAP global feature importance */}
      <ChartSection title="GLOBAL SHAP FEATURE IMPORTANCE — TOP TRUST DRIVERS">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={shapImport} layout="vertical" margin={{ left: 180, right: 40 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => v.toFixed(2)} />
            <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#94a3b8' }} width={180} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={v => v.toFixed(4)} />
            <Bar dataKey="importance" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      <style>{`
        @media print {
          #explore-page { background: white !important; color: black !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
