import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';
const POLL_INTERVAL = 30_000;

const SEV = {
    DANGER: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', icon: '🔴', label: 'DANGER' },
    WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '🟡', label: 'WARNING' },
    CAUTION: { color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', icon: '🟠', label: 'CAUTION' },
    OK: { color: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)', icon: '🟢', label: 'OK' },
};

const COUNT_OPTIONS = [10, 20, 30, 50, 75, 100];

function HealthBar({ score }) {
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{score}</span>
        </div>
    );
}

export default function PortfolioMonitor() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastPoll, setLastPoll] = useState(null);
    const [filter, setFilter] = useState('ALL');
    const [countdown, setCountdown] = useState(30);
    const [count, setCount] = useState(20);   // rows to monitor
    const timerRef = useRef(null);
    const countRef = useRef(null);

    const poll = (n) => {
        const c = n || count;
        setLoading(true);
        // First hit /api/portfolio?count=N to build real allocations, then /api/portfolio/monitor
        fetch(`${API}/api/portfolio?count=${c}`)
            .then(() => fetch(`${API}/api/portfolio/monitor?count=${c}`))
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
                setLastPoll(new Date());
                setCountdown(30);
            })
            .catch(() => {
                // Fallback: try monitor directly
                fetch(`${API}/api/portfolio/monitor`)
                    .then(r => r.json())
                    .then(d => { setData(d); setLoading(false); setLastPoll(new Date()); })
                    .catch(() => setLoading(false));
            });
    };

    useEffect(() => {
        poll(count);
        timerRef.current = setInterval(() => poll(count), POLL_INTERVAL);
        countRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
        return () => { clearInterval(timerRef.current); clearInterval(countRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCountChange = (n) => {
        setCount(n);
        clearInterval(timerRef.current);
        poll(n);
        timerRef.current = setInterval(() => poll(n), POLL_INTERVAL);
        setCountdown(30);
    };

    const alerts = (data?.alerts || []).filter(a => filter === 'ALL' || a.severity === filter);
    const health = data?.overall_health || 0;
    const healthColor = health >= 75 ? '#22c55e' : health >= 50 ? '#f59e0b' : '#ef4444';
    const total = data?.total_monitored || 0;

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">Live Monitor</span>
                        <span className="badge badge-green">Polls every 30s</span>
                        <span className="badge badge-purple">5 AI Signals</span>
                    </div>
                    <div className="page-title">📡 Portfolio Health Monitor</div>
                    <div className="page-sub">
                        Real-time alerts: Trust Score · Hype Anomaly · Survival Probability · Risk Audit · FinBERT News
                    </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                    <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>⚡ Live — refreshing in {countdown}s</div>
                    {lastPoll && <div>Last poll: {lastPoll.toLocaleTimeString()}</div>}
                    <button onClick={() => poll(count)} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>
                        🔄 Refresh now
                    </button>
                </div>
            </div>

            {/* Rows-per-view control */}
            <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1.1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>📊 Monitor size:</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {COUNT_OPTIONS.map(n => (
                        <button key={n} onClick={() => handleCountChange(n)}
                            style={{
                                padding: '0.25rem 0.7rem', borderRadius: 7, border: `1px solid ${count === n ? 'var(--blue)' : 'var(--border)'}`,
                                background: count === n ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                color: count === n ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            }}>
                            Top {n}
                        </button>
                    ))}
                </div>
                {loading && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏳ Loading {count} companies…</span>}
                {!loading && <span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>✓ Monitoring {total} real startups</span>}
            </div>

            {/* KPI row */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Overall Health', value: `${health}/100`, color: healthColor, sub: 'portfolio avg' },
                    { label: 'Monitored', value: total, color: '#4fc3f7', sub: 'real companies' },
                    { label: '🔴 DANGER', value: data?.danger_count || 0, color: '#ef4444', sub: 'immediate action' },
                    { label: '🟡 WARNING', value: data?.warning_count || 0, color: '#f59e0b', sub: 'watch closely' },
                    { label: '🟠 CAUTION', value: data?.caution_count || 0, color: '#fb923c', sub: 'minor signals' },
                    { label: '🟢 OK', value: data?.ok_count || 0, color: '#22c55e', sub: 'healthy' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.3rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* Health bar */}
            <div className="panel" style={{ marginBottom: '1.25rem', padding: '0.9rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>📊 Portfolio Health Score</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: healthColor }}>
                        {health}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/100</span>
                    </span>
                </div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${health}%`, background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`, borderRadius: 5, transition: 'width 1s ease' }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Trust score (60%) · Hype check (20%) · Risk audit (20%) · News sentiment penalty
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
                {['ALL', 'DANGER', 'WARNING', 'CAUTION', 'OK'].map(f => {
                    const s = SEV[f] || { color: '#4fc3f7', bg: 'rgba(79,195,247,0.1)', border: 'rgba(79,195,247,0.2)', icon: '📋' };
                    const cnt = f === 'ALL' ? total : data?.[`${f.toLowerCase()}_count`];
                    return (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: '7px 16px', borderRadius: 8, border: `1px solid ${filter === f ? s.border : 'transparent'}`,
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            background: filter === f ? s.bg : 'rgba(255,255,255,0.03)',
                            color: filter === f ? s.color : '#64748b',
                        }}>
                            {f === 'ALL' ? '📋 ALL' : `${s.icon} ${f}`}
                            {cnt !== undefined && <span style={{ marginLeft: 6, opacity: 0.7 }}>({cnt})</span>}
                        </button>
                    );
                })}
            </div>

            {/* Alert cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</div>
                        <div>Scanning {count} real startups…</div>
                    </div>
                ) : alerts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No alerts matching filter.</div>
                ) : alerts.map((a, idx) => {
                    const s = SEV[a.severity] || SEV.OK;
                    return (
                        <div key={idx} style={{
                            padding: '1rem 1.25rem', borderRadius: 12,
                            background: s.bg, border: `1px solid ${s.border}`,
                            display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 1.6fr',
                            gap: '1rem', alignItems: 'center',
                        }}>
                            {/* Company */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e2e8f0' }}>{a.startup_name}</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${s.color}18`, color: s.color }}>{s.icon} {a.severity}</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 4 }}>
                                    {a.sector || '—'} · {a.allocation_pct?.toFixed(1)}% portfolio · BL return: {a.bl_return_pct?.toFixed(1)}%
                                </div>
                                {a.issues?.length > 0 && (
                                    <div style={{ fontSize: '0.7rem', color: s.color }}>
                                        {a.issues.slice(0, 2).map((iss, i) => <div key={i}>⚠ {iss}</div>)}
                                        {a.issues.length > 2 && <div style={{ color: '#64748b' }}>+{a.issues.length - 2} more signals</div>}
                                    </div>
                                )}
                            </div>
                            {/* Trust */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>Trust Score</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: a.trust_score >= 0.70 ? '#22c55e' : a.trust_score >= 0.50 ? '#f59e0b' : '#ef4444' }}>
                                    {a.trust_score?.toFixed(2)}
                                </div>
                            </div>
                            {/* Hype */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>Hype Check</div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: a.hype_flag === 'HYPE_ANOMALY' ? '#ef4444' : a.hype_flag === 'LEGITIMATE' ? '#22c55e' : '#64748b' }}>
                                    {a.hype_flag === 'HYPE_ANOMALY' ? '🚨 ANOMALY' : a.hype_flag === 'LEGITIMATE' ? '✅ OK' : a.hype_flag === 'STAGNANT' ? '⚠ STAGNANT' : '—'}
                                </div>
                            </div>
                            {/* Neg news */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>Neg. News</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: a.neg_news_count > 2 ? '#ef4444' : a.neg_news_count > 0 ? '#f59e0b' : '#22c55e' }}>
                                    {a.neg_news_count > 0 ? `${a.neg_news_count} ⚠️` : '0 ✅'}
                                </div>
                            </div>
                            {/* Health bar */}
                            <div>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>Health Score</div>
                                <HealthBar score={a.health_score} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Thresholds */}
            {data?.thresholds && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: '#475569', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>🔴 DANGER: Trust &lt;{data.thresholds.trust_danger} | HYPE_ANOMALY | Survival &lt;{(data.thresholds.survival_danger * 100).toFixed(0)}%</span>
                    <span>🟡 WARNING: Trust &lt;{data.thresholds.trust_warning} | Survival &lt;{(data.thresholds.survival_warning * 100).toFixed(0)}%</span>
                    <span>🟠 CAUTION: STAGNANT flag | 3+ negative FinBERT headlines</span>
                </div>
            )}
        </div>
    );
}
