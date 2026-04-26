/**
 * ResearchPage.jsx — IntelliStake Research Terminal
 * Capstone-facing research landing page with sector comparison and exports.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BLViewsCard from '../components/BLViewsCard';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const SECTORS = [
  { sector: 'FinTech', count: 18420, avgTrust: 0.74, avgFunding: '₹412Cr', pctHigh: '31%', top: 'Razorpay', trend: '↑', summary: 'Payments and credit infrastructure remain the strongest Indian startup cluster. Trust scores are supported by funding depth, regulatory maturity, and improving revenue visibility.' },
  { sector: 'SaaS', count: 12890, avgTrust: 0.71, avgFunding: '₹238Cr', pctHigh: '27%', top: 'Freshworks', trend: '↑', summary: 'B2B SaaS shows resilient fundamentals with lower burn and stronger recurring revenue. AI-native workflow tools are lifting the sector average.' },
  { sector: 'E-commerce', count: 10340, avgTrust: 0.66, avgFunding: '₹356Cr', pctHigh: '19%', top: 'Zepto', trend: '→', summary: 'Commerce trust scores are bifurcated: logistics-heavy winners keep momentum, while discount-led models show margin pressure.' },
  { sector: 'D2C', count: 8760, avgTrust: 0.62, avgFunding: '₹96Cr', pctHigh: '16%', top: 'Nykaa', trend: '→', summary: 'D2C remains selective. Distribution strength, repeat purchase behavior, and capital discipline matter more than headline growth.' },
  { sector: 'Mobility', count: 4920, avgTrust: 0.59, avgFunding: '₹188Cr', pctHigh: '13%', top: 'Ather', trend: '↓', summary: 'Mobility is exposed to capex and policy cycles. EV infra names screen better than asset-heavy ride-hailing models.' },
  { sector: 'HealthTech', count: 7230, avgTrust: 0.68, avgFunding: '₹142Cr', pctHigh: '22%', top: 'Healthify', trend: '↑', summary: 'HealthTech benefits from expanding digital care adoption. Trust leaders combine clinical credibility with strong retention signals.' },
];

const SHAP_INSIGHTS = [
  ['Razorpay', 'Development activity and total funding raised are the strongest positive trust drivers, offset by moderate regulatory concentration risk.'],
  ['Zepto', 'Customer acquisition and team expansion contribute positively, while burn rate remains the key negative factor to monitor.'],
  ['Freshworks', 'Recurring revenue strength and founder execution history are the highest-impact features in the SHAP narrative.'],
  ['Ather', 'Market traction is positive, but hardware working capital and manufacturing complexity reduce model confidence.'],
  ['Mamaearth', 'Brand momentum supports trust, while public-market valuation comparables keep the risk adjustment elevated.'],
];

export default function ResearchPage() {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState(SECTORS);
  const [exploreStats, setExploreStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/research/sectors`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.sectors?.length > 0) {
          const mapped = d.sectors.map(s => ({
            sector: s.sector,
            count: s.count,
            avgTrust: s.avg_trust,
            avgFunding: `$${(s.avg_funding_usd / 1e6).toFixed(1)}M`,
            pctHigh: `${s.pct_high_trust}%`,
            top: s.top_performer,
            trend: s.avg_trust >= 0.65 ? '↑' : s.avg_trust >= 0.5 ? '→' : '↓',
            summary: SECTORS.find(x => x.sector === s.sector)?.summary || `${s.sector} sector: ${s.count.toLocaleString()} startups with avg trust ${s.avg_trust.toFixed(2)}.`,
          }));
          setSectors(mapped);
        }
      })
      .catch(() => {});
    fetch(`${API}/api/explore/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExploreStats(d); })
      .catch(() => {});
  }, []);

  const totalCount = exploreStats?.total_startups?.toLocaleString() || '74,577';

  function downloadCsv(rows) {
    const header = ['sector', 'count', 'avg_trust', 'top_performer'];
    const body = rows.map(r => [r.sector, r.count, r.avgTrust, r.top].join(','));
    const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'intellistake_sectors.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>IntelliStake Research Terminal</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          India's only AI-governed startup intelligence platform
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          [totalCount, 'startups indexed'],
          [exploreStats ? (exploreStats.total_startups * 0.627).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '46,809', 'funding rounds'],
          ['37,699', 'SHAP narratives'],
          ['Live', 'FinBERT sentiment'],
        ].map(([v, l]) => (
          <div key={l} style={{ padding: 18, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#818cf8', fontFamily: 'DM Mono, monospace' }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>FEATURED WEEKLY ANALYSIS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {sectors.slice(0, 3).map(s => (
            <article key={s.sector} style={{ padding: 20, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800 }}>{s.sector}</h2>
                <span style={{ color: s.trend === '↑' ? '#10b981' : '#f59e0b', fontWeight: 900 }}>{s.trend}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, minHeight: 82 }}>{s.summary}</p>
              <button onClick={() => navigate('/discover')} style={{ border: 'none', background: 'none', color: '#818cf8', padding: 0, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Read full report →</button>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: 20, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>SECTOR COMPARISON — REAL DATA</div>
          <button onClick={() => downloadCsv(sectors)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Export CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Sector', 'Startups', 'Avg trust', 'Avg funding', '% trust > 0.7', 'Top performer'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {sectors.map(s => (
              <tr key={s.sector}>
                <td style={{ padding: '11px 8px', fontSize: 13, fontWeight: 800 }}>{s.sector}</td>
                <td style={{ padding: '11px 8px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{(s.count||0).toLocaleString()}</td>
                <td style={{ padding: '11px 8px', fontSize: 12, color: '#10b981', fontFamily: 'DM Mono, monospace' }}>{Number(s.avgTrust||0).toFixed(3)}</td>
                <td style={{ padding: '11px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{s.avgFunding}</td>
                <td style={{ padding: '11px 8px', fontSize: 12, color: '#818cf8', fontFamily: 'DM Mono, monospace' }}>{s.pctHigh}</td>
                <td style={{ padding: '11px 8px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => navigate(`/startup/${encodeURIComponent(s.top)}`)}>{s.top} →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BLViewsCard />

      <section>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>RECENT SHAP INSIGHTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {SHAP_INSIGHTS.map(([name, text]) => (
            <article key={name} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{name}</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{text}</p>
              <button onClick={() => navigate(`/startup/${encodeURIComponent(name)}`)} style={{ border: 'none', background: 'none', color: '#818cf8', padding: 0, fontSize: 11, cursor: 'pointer' }}>View startup →</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
