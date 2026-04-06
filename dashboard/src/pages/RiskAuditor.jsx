import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';
const PAGE_SIZE = 25;
const SEV_COLOR = { NONE: 'var(--green)', LOW: 'var(--blue)', MEDIUM: 'var(--amber)', HIGH: 'var(--red)', SEVERE: '#c026d3' };
const SEV_ICON = { NONE: '🟢', LOW: '🔵', MEDIUM: '🟡', HIGH: '🔴', SEVERE: '💀' };

function ScoreBar({ value, label }) {
    const pct = Math.round(parseFloat(value || 0) * 100);
    const c = pct > 70 ? 'var(--green)' : pct > 50 ? 'var(--blue)' : 'var(--red)';
    return (
        <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: c, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3, transition: 'width 0.6s' }} />
            </div>
        </div>
    );
}

export default function RiskAuditor({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const detailRef = useRef(null);

    useEffect(() => {
        fetch(`${API}/api/risk`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const rows = data?.rows || [];
    const counts = data?.counts || {};
    const total = data?.total || 0;

    const filtered = rows.filter(r =>
        (filter === 'ALL' || r.risk_severity === filter) &&
        (r.name || '').toLowerCase().includes(search.toLowerCase())
    );
    const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const pages = Math.ceil(filtered.length / PAGE_SIZE);

    const selectRow = (r) => {
        setSelected(s => s?.name === r.name ? null : r);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🔍 R.A.I.S.E. Risk Auditor</div>
                    <div className="page-sub">55% GitHub Velocity · 25% Founder Pedigree · 20% Market Traction — {total.toLocaleString()} startups audited</div>
                </div>
            </div>

            {/* Summary metrics */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                {['NONE', 'LOW', 'MEDIUM', 'HIGH', 'SEVERE'].map(sev => (
                    <div key={sev} className="kpi-card"
                        style={{ cursor: 'pointer', borderTop: `2px solid ${SEV_COLOR[sev]}`, transition: 'all 0.15s' }}
                        onClick={() => setFilter(filter === sev ? 'ALL' : sev)}>
                        <div className="kpi-label">{SEV_ICON[sev]} {sev === 'NONE' ? 'Clean' : sev}</div>
                        <div className="kpi-value" style={{ color: SEV_COLOR[sev], fontSize: '1.4rem' }}>{loading ? '…' : (counts[sev] || 0).toLocaleString()}</div>
                        {filter === sev && <div style={{ fontSize: '0.66rem', color: SEV_COLOR[sev] }}>● Filtered</div>}
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>🔍</span>
                    <input className="input-field" style={{ paddingLeft: '2.25rem' }} placeholder={`Search ${total.toLocaleString()} startups…`} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
                </div>
                {['ALL', 'NONE', 'LOW', 'MEDIUM', 'HIGH', 'SEVERE'].map(f => (
                    <button key={f} onClick={() => { setFilter(f); setPage(0); }}
                        style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`, background: filter === f ? 'rgba(59,130,246,0.12)' : 'transparent', color: filter === f ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>
                        {f}
                    </button>
                ))}
            </div>

            {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading risk audit data…</div>}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.4fr 1fr' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
                    {/* Table */}
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div className="card-title" style={{ marginBottom: 0 }}>Risk Table — {filtered.length.toLocaleString()} results</div>
                            {pages > 1 && (
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-ghost btn-sm">←</button>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{page + 1}/{pages}</span>
                                    <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} className="btn btn-ghost btn-sm">→</button>
                                </div>
                            )}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {['Startup', 'Sector', 'Trust', 'Velocity', 'Pedigree', 'Traction', 'Severity', 'Ω', ''].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '0.45rem 0.55rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(r => (
                                    <tr key={r.name} onClick={() => selectRow(r)}
                                        style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.15s',
                                            background: selected?.name === r.name ? 'rgba(59,130,246,0.07)' : 'transparent'
                                        }}
                                        onMouseEnter={e => { if (selected?.name !== r.name) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                        onMouseLeave={e => { if (selected?.name !== r.name) e.currentTarget.style.background = 'transparent'; }}>
                                        <td style={{ padding: '0.45rem 0.55rem', fontWeight: 600, fontSize: '0.82rem' }}>{r.name}</td>
                                        <td style={{ padding: '0.45rem 0.55rem', color: 'var(--text-muted)', fontSize: '0.76rem' }}>{r.sector}</td>
                                        <td style={{ padding: '0.45rem 0.55rem' }}>
                                            <span style={{ color: r.trust_score > 0.7 ? 'var(--green)' : r.trust_score > 0.5 ? 'var(--blue)' : 'var(--amber)', fontWeight: 700, fontSize: '0.78rem' }}>{parseFloat(r.trust_score).toFixed(3)}</span>
                                        </td>
                                        <td style={{ padding: '0.45rem 0.55rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{Math.round(parseFloat(r.velocity || 0) * 100)}%</td>
                                        <td style={{ padding: '0.45rem 0.55rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{Math.round(parseFloat(r.pedigree || 0) * 100)}%</td>
                                        <td style={{ padding: '0.45rem 0.55rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{Math.round(parseFloat(r.traction || 0) * 100)}%</td>
                                        <td style={{ padding: '0.45rem 0.55rem' }}>
                                            <span style={{ background: `${SEV_COLOR[r.risk_severity]}18`, color: SEV_COLOR[r.risk_severity], border: `1px solid ${SEV_COLOR[r.risk_severity]}40`, padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700 }}>
                                                {SEV_ICON[r.risk_severity]} {r.risk_severity}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.45rem 0.55rem', fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{parseFloat(r.omega || 1).toFixed(1)}</td>
                                        <td style={{ padding: '0.45rem 0.55rem', fontSize: '0.72rem', color: 'var(--blue)' }}>Details →</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {paged.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No results matching filters.</div>}
                    </div>

                    {/* Detail panel */}
                    {selected && (
                        <div ref={detailRef} className="card fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem' }}>{selected.name}</div>
                                    <span style={{ background: `${SEV_COLOR[selected.risk_severity]}18`, color: SEV_COLOR[selected.risk_severity], border: `1px solid ${SEV_COLOR[selected.risk_severity]}40`, padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700 }}>
                                        {SEV_ICON[selected.risk_severity]} {selected.risk_severity} Risk
                                    </span>
                                </div>
                                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '0.25rem 0.65rem', cursor: 'pointer' }}>✕</button>
                            </div>

                            <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(99,102,241,0.05)', borderRadius: 10, marginBottom: '1rem' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(135deg,#6366f1,#10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    {parseFloat(selected.trust_score).toFixed(4)}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Composite Trust Score</div>
                            </div>

                            <ScoreBar value={selected.velocity} label="🖥️ GitHub Velocity (55% weight)" />
                            <ScoreBar value={selected.pedigree} label="👤 Founder Pedigree (25% weight)" />
                            <ScoreBar value={selected.traction} label="📈 Market Traction (20% weight)" />

                            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>
                                <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                    <div style={{ color: 'var(--purple)', fontWeight: 700 }}>Ω = {parseFloat(selected.omega || 1).toFixed(1)}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BL Omega Multiplier</div>
                                </div>
                                <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                    <div style={{ color: selected.risk_severity === 'HIGH' || selected.risk_severity === 'SEVERE' ? 'var(--red)' : selected.risk_severity === 'NONE' ? 'var(--green)' : 'var(--blue)', fontWeight: 700 }}>
                                        {selected.risk_severity === 'HIGH' || selected.risk_severity === 'SEVERE' ? '⛔ Oracle Freeze' : selected.risk_severity === 'MEDIUM' ? '⚠️ Monitor' : '✅ Invest'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>System Recommendation</div>
                                </div>
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.78rem' }}
                                onClick={() => onNav?.('intelligence')}>
                                🔬 Deep Research {selected.name} →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
