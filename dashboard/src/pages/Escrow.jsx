import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

const STATUS_STYLE = {
    RELEASED: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', icon: '✅' },
    PENDING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '⏳' },
    LOCKED: { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.15)', icon: '🔒' },
};

function fmtCr(inr) {
    if (!inr) return '₹0';
    const cr = inr / 1e7;
    if (cr >= 100) return `₹${(inr / 1e9).toFixed(1)}B`;
    if (cr >= 1) return `₹${cr.toFixed(0)} Cr`;
    return `₹${(inr / 1e5).toFixed(0)} L`;
}

function TrancheRow({ t, idx }) {
    const s = STATUS_STYLE[t.status] || STATUS_STYLE.LOCKED;
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr auto',
            alignItems: 'flex-start', gap: '0.75rem',
            padding: '0.7rem 0.85rem', borderRadius: 8,
            background: s.bg, border: `1px solid ${s.border}`,
            marginBottom: '0.5rem',
        }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${s.color}20`, border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: s.color }}>
                T{idx + 1}
            </div>
            <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.15rem' }}>{t.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{t.condition}</div>
                {t.tx_hash && (
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#06b6d4', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                        {t.tx_hash.slice(0, 42)}…
                    </div>
                )}
                {t.block && <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: '0.1rem' }}>Block #{t.block}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: s.color }}>{s.icon} {t.status}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>{fmtCr(t.amount)}</div>
            </div>
        </div>
    );
}

export default function Escrow() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(0);

    useEffect(() => {
        fetch(`${API}/api/escrow`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const contracts = data?.escrow_contracts || [];
    const summary = data?.summary || {};
    const current = contracts[selected];

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <span className="badge badge-purple">MilestoneEscrow.sol</span>
                        <span className="badge badge-green">4-Tranche</span>
                        <span className="badge badge-blue">Sepolia Testnet</span>
                    </div>
                    <div className="page-title">🔐 Milestone Escrow</div>
                    <div className="page-sub">Smart contract escrow — funds released in 4 tranches based on oracle-verified AI milestones</div>
                </div>
            </div>

            {/* Summary KPIs */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Contracts', value: loading ? '…' : summary.total_startups, color: '#3b82f6', sub: 'real startups' },
                    { label: 'Total Released', value: loading ? '…' : fmtCr(summary.total_released_inr), color: '#22c55e', sub: 'milestone verified' },
                    { label: 'Pending Unlock', value: loading ? '…' : fmtCr(summary.total_pending_inr), color: '#f59e0b', sub: 'next tranche' },
                    { label: 'Still Locked', value: loading ? '…' : fmtCr(summary.total_locked_inr), color: '#6b7280', sub: 'future tranches' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.3rem' }}>{m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading escrow contracts…</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>

                    {/* Left — contract list */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem' }}>
                            🏢 Escrow Contracts ({contracts.length})
                        </div>
                        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                            {contracts.map((c, i) => {
                                const rel = c.tranches?.filter(t => t.status === 'RELEASED').length || 0;
                                const total = c.tranches?.length || 4;
                                const progPct = rel / total * 100;
                                const isActive = selected === i;
                                return (
                                    <div key={i} onClick={() => setSelected(i)} style={{
                                        padding: '0.75rem 1rem', cursor: 'pointer',
                                        background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                                        borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        transition: 'all 0.15s',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isActive ? '#a5b4fc' : '#e2e8f0' }}>{c.startup_name}</span>
                                            <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 600 }}>{rel}/{total} ✅</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <span style={{ fontSize: '0.69rem', color: '#64748b' }}>{c.sector}</span>
                                            <span style={{ fontSize: '0.69rem', color: '#94a3b8', fontWeight: 600 }}>{fmtCr(c.total_deal_inr)}</span>
                                        </div>
                                        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${progPct}%`, background: '#22c55e', borderRadius: 2, transition: 'width 0.6s' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right — tranche detail */}
                    {current ? (
                        <div>
                            {/* Company header */}
                            <div className="card" style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{current.startup_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{current.sector}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Trust Score</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: current.trust_score >= 0.70 ? '#22c55e' : current.trust_score >= 0.50 ? '#f59e0b' : '#ef4444' }}>
                                            {current.trust_score?.toFixed(3)}
                                        </div>
                                    </div>
                                </div>

                                {/* Deal breakdown */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '0.85rem' }}>
                                    {[
                                        { label: 'Total Deal', value: fmtCr(current.total_deal_inr), color: '#3b82f6' },
                                        { label: 'Released', value: fmtCr(current.released_inr), color: '#22c55e' },
                                        { label: 'Pending', value: fmtCr(current.pending_inr), color: '#f59e0b' },
                                    ].map(m => (
                                        <div key={m.label} style={{ padding: '0.5rem 0.65rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: m.color, marginTop: '0.1rem' }}>{m.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#475569', padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6, wordBreak: 'break-all' }}>
                                    {current.contract_address}
                                </div>
                            </div>

                            {/* Tranches */}
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Tranche Status</div>
                                {(current.tranches || []).map((t, idx) => <TrancheRow key={t.id} t={t} idx={idx} />)}

                                <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.7 }}>
                                    <strong style={{ color: '#94a3b8' }}>Auto-freeze trigger:</strong> <code style={{ color: '#ef4444' }}>freezeMilestoneFunding()</code> activates if trust drops below 0.35
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#64748b' }}>
                            Select a startup to view escrow details
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
