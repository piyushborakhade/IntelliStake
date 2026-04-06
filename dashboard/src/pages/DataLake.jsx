import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

export default function DataLake({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/datalake`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const stats = data?.stats || {};
    const layers = data?.layers || [];

    const statusColors = { Complete: 'var(--green)', Live: 'var(--blue)', Deployed: 'var(--purple)', Processing: 'var(--amber)' };

    const dataPoints = stats.data_points || 0;
    const totalRecords = (stats.total_startups || 0) + (stats.total_funding_rounds || 0) + (stats.total_investors || 0) + (stats.github_repos || 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">4-Tier Architecture</span>
                        <span className="badge badge-green">Live</span>
                        <span className="badge badge-purple">{dataPoints.toLocaleString()} Data Points</span>
                    </div>
                    <div className="page-title">🗄️ Data Lake</div>
                    <div className="page-sub">
                        4-layer enterprise data architecture: Raw → Cleaned → AI Outputs → Production. All data used by live models.
                    </div>
                </div>
            </div>

            {/* Top stats */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Startups', value: (stats.total_startups || 0).toLocaleString(), color: 'var(--blue)', sub: 'knowledge graph' },
                    { label: 'Funding Rounds', value: (stats.total_funding_rounds || 0).toLocaleString(), color: 'var(--purple)', sub: 'real capital data' },
                    { label: 'GitHub Repos', value: (stats.github_repos || 0).toLocaleString(), color: 'var(--green)', sub: 'velocity tracked' },
                    { label: 'KYC Investors', value: (stats.total_investors || 0).toLocaleString(), color: 'var(--amber)', sub: 'ERC-3643 verified' },
                    { label: 'Hype Flags', value: (stats.hype_flags || 0).toLocaleString(), color: 'var(--red)', sub: 'Isolation Forest' },
                    { label: 'Data Points', value: dataPoints >= 1e6 ? `${(dataPoints / 1e6).toFixed(1)}M` : dataPoints.toLocaleString(), color: 'var(--cyan)', sub: '64 features × startups' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.1rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* Layer pipeline visualization */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-title">🔄 4-Tier Data Pipeline</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    {layers.map((layer, i) => {
                        const color = statusColors[layer.status] || 'var(--text-muted)';
                        return (
                            <div key={layer.layer} style={{
                                padding: '1rem', borderRadius: 12,
                                background: `${color}06`, border: `1px solid ${color}25`,
                                position: 'relative', overflow: 'hidden'
                            }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.7 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color }}>{`T${i + 1}`}</div>
                                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: `${color}20`, color, fontWeight: 700 }}>
                                        {layer.status}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.3rem' }}>{layer.layer}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{layer.records}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{layer.files} file{layer.files !== 1 ? 's' : ''}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Flow arrows */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                    {['Raw OSINT', '→', 'Cleaned', '→', 'Feature Engineering', '→', 'AI Models', '→', 'Portfolio + Blockchain', '→', 'Dashboard'].map((s, i) => (
                        <span key={i} style={{ color: s === '→' ? 'var(--border)' : s.includes('AI') ? 'var(--blue)' : s.includes('Portfolio') ? 'var(--green)' : s.includes('Dashboard') ? 'var(--purple)' : 'var(--text-muted)' }}>
                            {s}
                        </span>
                    ))}
                </div>
            </div>

            {/* Data sources */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {[
                    {
                        title: '📊 Startup Fundamentals',
                        color: 'var(--blue)',
                        file: 'intellistake_startups_clean.json',
                        records: stats.total_startups,
                        features: ['Trust Score', 'Risk Severity', 'Sector/Country', 'Revenue', 'Team Pedigree', 'MCA Filing Status'],
                    },
                    {
                        title: '💰 Funding Data',
                        color: 'var(--purple)',
                        file: 'real_funding_data.json',
                        records: stats.total_funding_rounds,
                        features: ['Round Type (Seed/A/B)', 'Amount USD', 'Investor Name', 'Date', 'Post-money Valuation', 'Lead Investor'],
                    },
                    {
                        title: '⚡ GitHub Velocity',
                        color: 'var(--green)',
                        file: 'github_repositories_clean.json',
                        records: stats.github_repos,
                        features: ['Stars/Forks', 'Commit Velocity', 'Open Issues', 'Contributors', 'Language', 'Last Activity'],
                    },
                    {
                        title: '⛓️ Blockchain Data',
                        color: 'var(--amber)',
                        file: 'oracle_tx_log.json + mock_investors.json',
                        records: stats.total_investors,
                        features: ['Wallet Addresses', 'KYC Tiers', 'Oracle TX Hashes', 'Tranche Status', 'Block Numbers', 'Gas Used'],
                    },
                ].map(src => (
                    <div key={src.title} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: src.color }}>{src.title}</div>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: src.color }}>{(src.records || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '0.65rem', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                            {src.file}
                        </div>
                        {src.features.map(f => (
                            <div key={f} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: src.color, fontSize: '0.6rem' }}>▸</span>{f}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
