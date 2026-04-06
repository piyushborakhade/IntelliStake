import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';
const POLL_MS = 30_000;   // refresh every 30 seconds

const SEV_STYLES = {
    critical: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#ef4444', label: '🔴 CRITICAL' },
    high: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: '#ef4444', label: '🟠 HIGH' },
    medium: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', color: '#f59e0b', label: '🟡 MEDIUM' },
    positive: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', color: '#10b981', label: '🟢 POSITIVE' },
    neutral: { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.2)', color: '#94a3b8', label: '⚪ NEUTRAL' },
};

function useTicker(headlines) {
    const ref = useRef();
    const posRef = useRef(0);
    const rafRef = useRef();

    useEffect(() => {
        if (!ref.current || !headlines.length) return;
        const el = ref.current;
        const speed = 0.6;
        let paused = false;
        el.addEventListener('mouseenter', () => { paused = true; });
        el.addEventListener('mouseleave', () => { paused = false; });

        function step() {
            if (!paused) {
                posRef.current -= speed;
                if (Math.abs(posRef.current) > el.scrollWidth / 2) posRef.current = 0;
                el.style.transform = `translateX(${posRef.current}px)`;
            }
            rafRef.current = requestAnimationFrame(step);
        }
        rafRef.current = requestAnimationFrame(step);
        return () => { cancelAnimationFrame(rafRef.current); };
    }, [headlines]);

    return ref;
}

function Ticker({ headlines }) {
    const doubled = [...headlines, ...headlines];
    const ref = useTicker(headlines);
    return (
        <div style={{ overflow: 'hidden', width: '100%', position: 'relative', height: 36 }}>
            <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 0, whiteSpace: 'nowrap', willChange: 'transform', height: 36 }}>
                {doubled.map((h, i) => {
                    const col = h.label === 'positive' ? '#10b981' : h.label === 'negative' ? '#ef4444' : '#94a3b8';
                    return (
                        <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0 2rem', fontSize: '0.75rem', color: col,
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <span style={{ opacity: 0.6 }}>{h.source}</span>
                            {h.portfolio_alert && <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ ALERT</span>}
                            <span style={{ color }}>{h.headline?.replaceAll('&amp;', '&').replaceAll('&#8217;', "'").replaceAll('&#038;', '&').slice(0, 80)}…</span>
                            <span style={{ background: col + '22', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700 }}>
                                {h.label?.toUpperCase()}
                            </span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export default function NewsTerminal({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState(null);
    const [filter, setFilter] = useState('all');   // all | positive | negative | alert
    const [notifGranted, setNotifGranted] = useState(false);
    const alertsFired = useRef(new Set());

    const fetchFeed = async () => {
        try {
            const r = await fetch(`${API}/api/newsfeed`);
            const d = await r.json();
            setData(d);
            setLastFetch(new Date());

            // Browser notifications for new alerts
            if (notifGranted && d.alerts?.length) {
                d.alerts.forEach(a => {
                    const key = a.company + a.headline?.slice(0, 30);
                    if (!alertsFired.current.has(key)) {
                        alertsFired.current.add(key);
                        new Notification(`⚠ IntelliStake Risk Alert: ${a.company}`, {
                            body: a.headline,
                            icon: '/logo.svg',
                        });
                    }
                });
            }
        } catch (e) {
            console.error('Feed fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        const t = setInterval(fetchFeed, POLL_MS);
        return () => clearInterval(t);
    }, [notifGranted]);

    const requestNotif = async () => {
        if (!('Notification' in window)) return;
        const perm = await Notification.requestPermission();
        setNotifGranted(perm === 'granted');
    };

    const headlines = data?.headlines || [];
    const alerts = data?.alerts || [];
    const sectors = data?.sector_scores || {};

    const filtered = headlines.filter(h => {
        if (filter === 'all') return true;
        if (filter === 'alert') return h.portfolio_alert;
        return h.label === filter;
    });

    const overallCol = data?.overall_label === 'bullish' ? '#10b981' : data?.overall_label === 'bearish' ? '#ef4444' : '#94a3b8';
    const overallIcon = data?.overall_label === 'bullish' ? '🐂' : data?.overall_label === 'bearish' ? '🐻' : '⚖️';

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">FinBERT Live</span>
                        <span className="badge badge-green">Bloomberg Style</span>
                        {alerts.length > 0 && <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>⚠ {alerts.length} Alert{alerts.length > 1 ? 's' : ''}</span>}
                    </div>
                    <div className="page-title">📡 IntelliStake Intelligence Terminal</div>
                    <div className="page-sub">
                        Live FinBERT-scored news terminal · Portfolio sentiment monitoring · {POLL_MS / 1000}s auto-refresh
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {lastFetch && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Updated {lastFetch.toLocaleTimeString('en-IN')}</span>}
                    <button className="btn btn-ghost" onClick={fetchFeed}>🔄 Refresh</button>
                    {!notifGranted && (
                        <button className="btn btn-ghost" onClick={requestNotif} style={{ borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                            🔔 Enable Alerts
                        </button>
                    )}
                    {notifGranted && <span style={{ fontSize: '0.72rem', color: '#10b981' }}>🔔 Alerts On</span>}
                </div>
            </div>

            {/* Scrolling Ticker */}
            <div style={{
                background: '#0f172a',
                border: '1px solid var(--border)',
                borderRadius: 8,
                marginBottom: '1.25rem',
                overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '0.3rem 0.85rem', background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', flexShrink: 0 }}>
                        ● LIVE
                    </div>
                    <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        IntelliStake Terminal  ·  FinBERT/ProsusAI  ·  {headlines.length} headlines
                    </div>
                    <div style={{ flex: 1, padding: '0.3rem 0.75rem', fontSize: '0.7rem', color: overallCol, fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>
                        {overallIcon} Market: {data?.overall_label?.toUpperCase() || '—'}  ({data?.overall_score?.toFixed?.(4) || '—'})
                    </div>
                </div>
                {headlines.length > 0 ? (
                    <Ticker headlines={headlines.slice(0, 20)} />
                ) : (
                    <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {loading ? '⏳ Loading live feed…' : 'No headlines available — check API status'}
                    </div>
                )}
            </div>

            {/* Alert boxes */}
            {alerts.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.6rem' }}>
                        ⚠ Portfolio Risk Alerts ({alerts.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {alerts.map((a, i) => {
                            const s = SEV_STYLES[a.severity] || SEV_STYLES.high;
                            return (
                                <div key={i} style={{ padding: '0.85rem 1rem', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: s.color, fontSize: '0.82rem', marginBottom: '0.15rem' }}>
                                            {s.label} · {a.company}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{a.headline}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Action: {a.action} · Score: {a.score?.toFixed(3)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main grid: headlines + sector scores */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>

                {/* Headlines feed */}
                <div className="card" style={{ padding: 0 }}>
                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: '0.25rem', padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: `All (${headlines.length})` },
                            { key: 'positive', label: `Positive (${headlines.filter(h => h.label === 'positive').length})`, col: '#10b981' },
                            { key: 'negative', label: `Negative (${headlines.filter(h => h.label === 'negative').length})`, col: '#ef4444' },
                            { key: 'alert', label: `Portfolio Alerts (${headlines.filter(h => h.portfolio_alert).length})`, col: '#f59e0b' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                style={{
                                    padding: '0.3rem 0.7rem', borderRadius: 6, border: 'none',
                                    background: filter === f.key ? (f.col || 'var(--blue)') + '22' : 'transparent',
                                    color: filter === f.key ? (f.col || 'var(--blue)') : 'var(--text-muted)',
                                    fontSize: '0.72rem', fontWeight: filter === f.key ? 700 : 400,
                                    cursor: 'pointer',
                                    borderBottom: filter === f.key ? `2px solid ${f.col || 'var(--blue)'}` : '2px solid transparent',
                                }}>
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                        {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>⏳ Loading…</div>}
                        {filtered.map((h, i) => {
                            const s = SEV_STYLES[h.severity] || SEV_STYLES.neutral;
                            return (
                                <div key={i} style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                    background: h.portfolio_alert ? 'rgba(239,68,68,0.04)' : 'transparent',
                                    transition: 'background 0.15s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = h.portfolio_alert ? 'rgba(239,68,68,0.04)' : 'transparent'}
                                >
                                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                                        {h.label === 'positive' ? '🟢' : h.label === 'negative' ? '🔴' : '⚪'}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem', lineHeight: 1.4 }}>
                                            {h.portfolio_alert && <span style={{ color: '#ef4444', fontWeight: 800, marginRight: '0.35rem' }}>⚠ PORTFOLIO ALERT</span>}
                                            {h.headline?.replaceAll('&amp;', '&').replaceAll('&#8217;', "'").replaceAll('&#038;', '&')}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{h.source}</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>·</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{h.sector}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                                                {h.label?.toUpperCase()} {h.confidence ? `(${(h.confidence * 100).toFixed(0)}%)` : ''}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: parseFloat(h.sentiment_score) > 0 ? '#10b981' : parseFloat(h.sentiment_score) < 0 ? '#ef4444' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {parseFloat(h.sentiment_score) > 0 ? '+' : ''}{parseFloat(h.sentiment_score).toFixed(3)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && !loading && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No headlines matching this filter</div>
                        )}
                    </div>
                </div>

                {/* Sector sentiment sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Market pulse */}
                    <div className="card">
                        <div className="card-title">📊 Market Pulse</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: overallCol }}>{overallIcon}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{data?.overall_label?.toUpperCase()}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: overallCol }}>{data?.overall_score?.toFixed(4) || '—'}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CFS Score</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{headlines.length}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Headlines</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                            {['positive', 'neutral', 'negative'].map(l => {
                                const c = headlines.filter(h => h.label === l).length;
                                const pct = headlines.length ? (c / headlines.length) * 100 : 0;
                                const col = l === 'positive' ? '#10b981' : l === 'negative' ? '#ef4444' : '#94a3b8';
                                return <div key={l} style={{ width: `${pct}%`, background: col, minWidth: pct > 0 ? 4 : 0 }} />;
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            <span style={{ color: '#10b981' }}>▲ {headlines.filter(h => h.label === 'positive').length} pos</span>
                            <span>— {headlines.filter(h => h.label === 'neutral').length} neutral</span>
                            <span style={{ color: '#ef4444' }}>▼ {headlines.filter(h => h.label === 'negative').length} neg</span>
                        </div>
                    </div>

                    {/* Sector scores */}
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-title">🏭 Sector Sentiment</div>
                        {Object.entries(sectors).length === 0 && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No sector data available</div>
                        )}
                        {Object.entries(sectors).sort((a, b) => Math.abs(b[1].avg_score) - Math.abs(a[1].avg_score)).map(([sec, info]) => {
                            const s = parseFloat(info.avg_score);
                            const col = s > 0.1 ? '#10b981' : s < -0.1 ? '#ef4444' : '#94a3b8';
                            const pct = Math.min(100, Math.abs(s) * 100);
                            return (
                                <div key={sec} style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{sec}</span>
                                        <span style={{ color: col, fontWeight: 700 }}>{info.label} ({s > 0 ? '+' : ''}{s.toFixed(3)})</span>
                                    </div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2, transition: 'width 0.5s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{info.headline_count} headlines</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sources */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '0.6rem' }}>📰 Sources</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {(data?.sources || []).map(s => (
                                <span key={s} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, color: 'var(--blue)' }}>{s}</span>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Auto-refreshes every {POLL_MS / 1000}s · ProsusAI/FinBERT scoring
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
