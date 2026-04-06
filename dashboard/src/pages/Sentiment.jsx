import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

export default function Sentiment({ onNav }) {
    const [data, setData] = useState(null);
    const [liveData, setLiveData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('live'); // 'live' | 'osint'

    useEffect(() => {
        fetch(`${API}/api/sentiment`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
        fetch(`${API}/api/live_sentiment`)
            .then(r => r.json())
            .then(d => setLiveData(d))
            .catch(() => { });
    }, []);

    const total = data?.total || 0;
    const positive = data?.positive || 0;
    const negative = data?.negative || 0;
    const neutral = data?.neutral || 0;
    const avg = data?.avg_compound || 0;
    const headlines = data?.headlines || [];

    const filteredHeadlines = headlines.filter(h =>
        !search ||
        h.title?.toLowerCase().includes(search.toLowerCase()) ||
        h.startup?.toLowerCase().includes(search.toLowerCase())
    );

    const labelColor = (label) => ({
        POSITIVE: 'var(--green)', NEGATIVE: 'var(--red)', NEUTRAL: 'var(--text-muted)'
    }[label?.toUpperCase()] || 'var(--text-muted)');

    const scoreBar = (score) => {
        const pct = Math.min(Math.abs(score) * 100 / 0.9, 100);
        return { pct, color: score > 0.05 ? 'var(--green)' : score < -0.05 ? 'var(--red)' : 'var(--text-muted)' };
    };

    // Donut segments
    const posP = total > 0 ? (positive / total * 100) : 0;
    const negP = total > 0 ? (negative / total * 100) : 0;
    const neuP = 100 - posP - negP;

    const liveHeadlines = liveData?.headlines || [];
    const liveSectors = liveData?.sector_scores || {};
    const liveOverall = liveData?.overall_score || 0;
    const liveLabel = liveData?.overall_label || 'neutral';

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">ProsusAI/finbert</span>
                        <span className="badge badge-green">Live RSS Feed</span>
                        <span className="badge badge-purple">OSINT</span>
                        <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Sector Scores</span>
                    </div>
                    <div className="page-title">📡 FinBERT Sentiment OSINT</div>
                    <div className="page-sub">
                        Finance-tuned BERT scores live RSS headlines from TechCrunch India, Inc42, YourStory, Entrackr
                    </div>
                </div>
                <input
                    placeholder="Search headline…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ padding: '0.5rem 0.9rem', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.82rem', width: 240 }}
                />
            </div>

            {/* Stats */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Headlines Scored', value: total.toLocaleString(), color: 'var(--blue)', sub: 'financial news' },
                    { label: 'Positive', value: positive.toLocaleString(), color: 'var(--green)', sub: `${posP.toFixed(1)}% of total` },
                    { label: 'Negative', value: negative.toLocaleString(), color: 'var(--red)', sub: `${negP.toFixed(1)}% of total` },
                    { label: 'Neutral', value: neutral.toLocaleString(), color: 'var(--text-muted)', sub: `${neuP.toFixed(1)}% of total` },
                    { label: 'Avg Compound Score', value: avg.toFixed(4), color: avg > 0 ? 'var(--green)' : 'var(--red)', sub: 'CFS across all' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.2rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                {[['live', '⚡ Live FinBERT (RSS)'], ['osint', '📁 OSINT Archive']].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        background: tab === id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        color: tab === id ? 'var(--green)' : 'var(--text-muted)',
                    }}>{label}</button>
                ))}
            </div>

            {tab === 'live' && liveData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
                    {/* Sector scores */}
                    <div className="card">
                        <div className="card-title">📊 Sector Sentiment</div>
                        <div style={{ padding: '0.5rem 0 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                            Overall: <strong style={{ color: liveLabel === 'bullish' ? 'var(--green)' : liveLabel === 'bearish' ? 'var(--red)' : 'var(--text-muted)' }}>{liveOverall > 0 ? '+' : ''}{liveOverall.toFixed(4)} {liveLabel.toUpperCase()}</strong>
                        </div>
                        {Object.entries(liveSectors).map(([sec, info]) => (
                            <div key={sec} style={{ marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sec}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: info.avg_score > 0 ? 'var(--green)' : 'var(--red)' }}>{info.avg_score > 0 ? '+' : ''}{info.avg_score?.toFixed(3)}</span>
                                </div>
                                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                                    <div style={{ height: '100%', width: `${Math.min(Math.abs(info.avg_score) * 200, 100)}%`, background: info.avg_score > 0 ? 'var(--green)' : 'var(--red)', borderRadius: 3 }} />
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{info.headline_count} headlines · {info.label}</div>
                            </div>
                        ))}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sources: {liveData?.sources?.join(', ')}</div>
                    </div>
                    {/* Live headlines */}
                    <div className="card">
                        <div className="card-title">📰 Live Headlines ({liveHeadlines.length} scored)</div>
                        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                            {liveHeadlines.filter(h => !search || h.headline?.toLowerCase().includes(search.toLowerCase())).map((h, i) => {
                                const color = h.label === 'positive' ? 'var(--green)' : h.label === 'negative' ? 'var(--red)' : 'var(--text-muted)';
                                return (
                                    <div key={i} style={{ padding: '0.65rem 0.75rem', borderRadius: 8, marginBottom: '0.4rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div style={{ fontSize: '0.79rem', fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{h.headline}</div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: `${color}18`, color, flexShrink: 0 }}>
                                                {h.label?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                            <span style={{ color }}>{h.sentiment_score > 0 ? '+' : ''}{h.sentiment_score?.toFixed(4)}</span>
                                            <span>{(h.confidence * 100).toFixed(0)}% conf</span>
                                            <span>{h.source}</span>
                                            {h.sector && h.sector !== 'General' && <span style={{ color: 'var(--cyan)' }}>{h.sector}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'osint' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>

                    {/* Visual sentiment summary */}
                    <div>
                        <div className="card" style={{ marginBottom: '1rem' }}>
                            <div className="card-title">📊 Sentiment Distribution</div>

                            {/* Visual bars */}
                            {[
                                { label: 'Positive', count: positive, total, color: 'var(--green)', icon: '😊' },
                                { label: 'Neutral', count: neutral, total, color: 'var(--text-muted)', icon: '😐' },
                                { label: 'Negative', count: negative, total, color: 'var(--red)', icon: '😟' },
                            ].map(s => (
                                <div key={s.label} style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: s.color, fontWeight: 600 }}>{s.icon} {s.label}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: s.color }}>{s.count.toLocaleString()}</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.total > 0 ? (s.count / s.total * 100).toFixed(1) : 0}%</span>
                                        </div>
                                    </div>
                                    <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${s.total > 0 ? (s.count / s.total * 100) : 0}%`, background: s.color, borderRadius: 5, transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>
                            ))}

                            <div style={{ marginTop: '0.5rem', padding: '0.65rem', background: avg >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 8, border: `1px solid ${avg >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Overall Market Sentiment (CFS)</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: avg >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                    {avg >= 0 ? '📈 Positive' : '📉 Negative'} ({avg.toFixed(4)})
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">⚙️ Model Details</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                                <div>• Model: <strong style={{ color: 'var(--blue)' }}>ProsusAI/finbert</strong></div>
                                <div>• Finance-tuned on 1.8M Bloomberg headlines</div>
                                <div>• CFS Score = FinBERT × GitHub × Revenue signal</div>
                                <div>• Fallback: VADER lexicon if GPU unavailable</div>
                                <div>• Trained tokens: financial context aware</div>
                            </div>
                        </div>
                    </div>

                    {/* Headlines feed */}
                    <div className="card">
                        <div className="card-title">📰 Financial Headlines Feed ({filteredHeadlines.length})</div>
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {filteredHeadlines.length === 0 && !loading && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                    {total === 0 ? '⏳ Run finbert_sentiment.py to generate headlines' : 'No headlines match search'}
                                </div>
                            )}
                            {filteredHeadlines.map((h, i) => {
                                const bar = scoreBar(h.score);
                                const color = labelColor(h.label);
                                return (
                                    <div key={i} style={{
                                        padding: '0.75rem', borderRadius: 10, marginBottom: '0.5rem',
                                        background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.05)`,
                                        transition: 'all 0.15s'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = `${color}30`}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1, marginRight: '0.75rem', lineHeight: 1.4 }}>{h.title}</div>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.5rem', borderRadius: 4, background: `${color}15`, color, flexShrink: 0 }}>
                                                {h.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1, marginRight: '0.75rem' }}>
                                                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.color, borderRadius: 2 }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                <span style={{ color }}>{h.score > 0 ? '+' : ''}{h.score.toFixed(4)}</span>
                                                <span>{h.source}</span>
                                                {h.startup && h.startup !== 'General' && <span style={{ color: 'var(--cyan)' }}>{h.startup}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
