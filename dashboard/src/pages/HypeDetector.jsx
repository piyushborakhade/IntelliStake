import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

const CLASS_STYLE = {
    HYPE_ANOMALY: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.25)', label: '🚨 HYPE ANOMALY' },
    LEGITIMATE: { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.25)', label: '✅ LEGITIMATE' },
    STAGNANT: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)', label: '⚠️ STAGNANT' },
};

export default function HypeDetector({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('disconnect_ratio');

    useEffect(() => {
        fetch(`${API}/api/hype`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const flags = data?.flags || [];
    const counts = data?.counts || { HYPE_ANOMALY: 0, LEGITIMATE: 0, STAGNANT: 0 };
    const total = data?.total || 0;

    const filtered = flags
        .filter(f => (filter === 'ALL' || f.classification === filter) && (f.startup_name || '').toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sortKey === 'disconnect_ratio') return parseFloat(b.disconnect_ratio || 0) - parseFloat(a.disconnect_ratio || 0);
            if (sortKey === 'trust_score') return parseFloat(a.trust_score || 0) - parseFloat(b.trust_score || 0);
            return 0;
        });

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🚨 Hype Anomaly Detector</div>
                    <div className="page-sub">Isolation Forest — valuation-to-fundamentals disconnect analysis across {total.toLocaleString()} startups</div>
                </div>
            </div>

            {/* Summary metrics */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { key: 'ALL', label: 'Total Analysed', value: total, color: 'var(--text-secondary)', icon: '🔍' },
                    { key: 'HYPE_ANOMALY', label: 'Hype Anomalies', value: counts.HYPE_ANOMALY || 0, color: 'var(--red)', icon: '🚨' },
                    { key: 'LEGITIMATE', label: 'Legitimate', value: counts.LEGITIMATE || 0, color: 'var(--green)', icon: '✅' },
                    { key: 'STAGNANT', label: 'Stagnant', value: counts.STAGNANT || 0, color: 'var(--amber)', icon: '⚠️' },
                ].map(m => (
                    <div key={m.key} className="kpi-card"
                        style={{ cursor: 'pointer', borderTop: `2px solid ${m.color}`, transition: 'all 0.15s' }}
                        onClick={() => setFilter(filter === m.key ? 'ALL' : m.key)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                        <div className="kpi-label">{m.icon} {m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.5rem' }}>{loading ? '…' : m.value.toLocaleString()}</div>
                        {filter === m.key && <div style={{ fontSize: '0.66rem', color: m.color, marginTop: '0.2rem' }}>● Active filter</div>}
                    </div>
                ))}
            </div>

            {/* Search + sort bar */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                    <input className="input-field" style={{ paddingLeft: '2.25rem' }} placeholder="Search startups…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input-field" style={{ width: 200 }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
                    <option value="disconnect_ratio">Sort: Disconnect Ratio ↓</option>
                    <option value="trust_score">Sort: Trust Score ↑</option>
                </select>
                {['ALL', 'HYPE_ANOMALY', 'LEGITIMATE', 'STAGNANT'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`, background: filter === f ? 'rgba(59,130,246,0.12)' : 'transparent', color: filter === f ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer' }}>
                        {f === 'ALL' ? '🔍 All' : CLASS_STYLE[f]?.label}
                    </button>
                ))}
            </div>

            {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading from Isolation Forest results…</div>}

            {/* Cards grid */}
            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '0.85rem' }}>
                    {filtered.slice(0, 60).map(s => {
                        const cs = CLASS_STYLE[s.classification] || CLASS_STYLE.STAGNANT;
                        const disconnect = parseFloat(s.disconnect_ratio || 1);
                        const trust = parseFloat(s.trust_score || 0);
                        const vel = parseInt(s.github_velocity_score || 50);
                        return (
                            <div key={s.startup_name} className="card" style={{ borderLeft: `3px solid ${cs.color}`, transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${cs.color}20`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.startup_name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{s.sector}</div>
                                    </div>
                                    <span style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {cs.label}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.4rem', marginBottom: '0.65rem' }}>
                                    {[
                                        { l: 'Trust', v: trust.toFixed(3), c: trust > 0.65 ? 'var(--green)' : trust > 0.4 ? 'var(--amber)' : 'var(--red)' },
                                        { l: 'Disconnect', v: `${disconnect.toFixed(2)}×`, c: disconnect > 2 ? 'var(--red)' : disconnect > 1 ? 'var(--amber)' : 'var(--green)' },
                                        { l: 'Git Velocity', v: `${vel}/100`, c: vel > 60 ? 'var(--green)' : 'var(--amber)' },
                                    ].map(m => (
                                        <div key={m.l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>{m.l}</div>
                                            <div style={{ color: m.c, fontWeight: 700, fontSize: '0.84rem', fontFamily: 'monospace' }}>{m.v}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginBottom: s.classification === 'HYPE_ANOMALY' ? '0.5rem' : 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                        <span>Disconnect Ratio</span>
                                        <span style={{ color: cs.color }}>{disconnect.toFixed(2)}×</span>
                                    </div>
                                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min(100, (disconnect / 4) * 100)}%`, background: cs.color, borderRadius: 3 }} />
                                    </div>
                                </div>

                                {s.classification === 'HYPE_ANOMALY' && (
                                    <div style={{ marginTop: '0.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.74rem', color: '#f87171' }}>
                                        ⚠️ Valuation {disconnect.toFixed(1)}× above fundamentals — Oracle freeze eligible
                                    </div>
                                )}

                                <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.6rem', width: '100%', justifyContent: 'center', fontSize: '0.74rem' }}
                                    onClick={() => onNav?.('intelligence')}>
                                    Research this company →
                                </button>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && !loading && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            {search ? `No results for "${search}"` : 'Run hype_detector.py to generate Isolation Forest results'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
