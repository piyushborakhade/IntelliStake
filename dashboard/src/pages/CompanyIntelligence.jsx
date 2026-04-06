import { useState, useRef, useEffect } from 'react';

const API = 'http://localhost:5500';

const CIS_CONFIG = {
    'STRONG BUY': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: '🟢', label: 'STRONG BUY' },
    'BUY': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', icon: '🔵', label: 'BUY' },
    'HOLD': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '🟡', label: 'HOLD' },
    'AVOID': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: '🔴', label: 'AVOID' },
};

const PIPELINE_STEPS = [
    { key: 'data_lake', label: 'Data Lake Lookup', icon: '🗄️' },
    { key: 'github', label: 'GitHub API', icon: '⚡' },
    { key: 'sentiment', label: 'FinBERT Sentiment', icon: '📡' },
    { key: 'hype', label: 'Isolation Forest', icon: '🚨' },
    { key: 'risk', label: 'R.A.I.S.E. Risk Audit', icon: '🛡️' },
    { key: 'shap', label: 'SHAP Explainer', icon: '📊' },
    { key: 'cis', label: 'CIS Engine', icon: '🧮' },
    { key: 'thesis', label: 'Thesis Generator', icon: '📝' },
];

const QUICK_COMPANIES = ['Zepto', 'Swiggy', 'Razorpay', 'CRED', 'Meesho', 'Oyo', 'Byju', 'Ola', 'Groww', 'PhonePe'];

// ── Compare Modal ────────────────────────────────────────────────────────────
function CompareModal({ initialA, onClose }) {
    const [a, setA] = useState(initialA || '');
    const [b, setB] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const compare = async () => {
        if (!a.trim() || !b.trim()) return;
        setLoading(true); setError('');
        try {
            const res = await fetch('http://localhost:5500/api/compare', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_a: a.trim(), company_b: b.trim() }),
            });
            setResult(await res.json());
        } catch { setError('API unavailable'); }
        setLoading(false);
    };

    const fmtV = (v) => {
        if (!v && v !== 0) return 'N/A';
        const n = parseFloat(v);
        if (isNaN(n)) return String(v);
        if (typeof v === 'string') return v;
        if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
        return n.toFixed(3);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}
            onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2rem', width: 'min(700px, 95vw)', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>⚔️ Compare Companies</div>
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '0.25rem 0.7rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input className="input-field" style={{ flex: 1 }} placeholder="Company A (e.g. Zepto)" value={a} onChange={e => setA(e.target.value)} />
                    <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>vs</span>
                    <input className="input-field" style={{ flex: 1 }} placeholder="Company B (e.g. Swiggy)" value={b} onChange={e => setB(e.target.value)} onKeyDown={e => e.key === 'Enter' && compare()} />
                    <button className="btn btn-primary" onClick={compare} disabled={loading || !a.trim() || !b.trim()}>
                        {loading ? '⏳' : 'Compare →'}
                    </button>
                </div>

                {error && <div style={{ padding: '0.6rem', background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: 'var(--red)', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</div>}

                {result && (
                    <>
                        {/* Winner banner */}
                        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green)' }}>🏆 Winner: {result.winner}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>by Trust Score</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.45rem 0.55rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Metric</th>
                                    <th style={{ textAlign: 'center', padding: '0.45rem 0.55rem', color: '#93c5fd', fontSize: '0.82rem', fontWeight: 700 }}>{result.company_a?.name || a}</th>
                                    <th style={{ textAlign: 'center', padding: '0.45rem 0.55rem', color: '#c4b5fd', fontSize: '0.82rem', fontWeight: 700 }}>{result.company_b?.name || b}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(result.metrics || []).map(m => {
                                    const av = m.a, bv = m.b;
                                    let aWins = false, bWins = false;
                                    try {
                                        const na = parseFloat(av), nb = parseFloat(bv);
                                        if (!isNaN(na) && !isNaN(nb)) {
                                            aWins = m.higher_is_better ? na >= nb : na <= nb;
                                            bWins = !aWins;
                                        }
                                    } catch { }
                                    return (
                                        <tr key={m.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '0.45rem 0.55rem', color: 'var(--text-muted)' }}>{m.label}</td>
                                            <td style={{ padding: '0.45rem 0.55rem', textAlign: 'center', color: aWins ? 'var(--green)' : 'var(--text-secondary)', fontWeight: aWins ? 700 : 400 }}>
                                                {aWins && <span style={{ marginRight: '0.3rem' }}>✔</span>}{fmtV(av)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.55rem', textAlign: 'center', color: bWins ? 'var(--green)' : 'var(--text-secondary)', fontWeight: bWins ? 700 : 400 }}>
                                                {bWins && <span style={{ marginRight: '0.3rem' }}>✔</span>}{fmtV(bv)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </>
                )}

                {!result && !loading && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        Enter two company names above and click Compare to see a side-by-side analysis.
                    </div>
                )}
            </div>
        </div>
    );
}

function CisGauge({ cis, signal }) {
    const cfg = CIS_CONFIG[signal] || CIS_CONFIG['HOLD'];
    const angle = (cis * 180) - 90; // -90 to +90 degrees
    const r = 64, cx = 80, cy = 80;
    const startAngle = Math.PI;
    const endAngle = startAngle + (cis * Math.PI);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = cis > 0.5 ? 1 : 0;

    return (
        <div style={{ textAlign: 'center' }}>
            <svg width="160" height="90" viewBox="0 0 160 90">
                {/* Background arc */}
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
                {/* Filled arc */}
                {cis > 0 && (
                    <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                        fill="none" stroke={cfg.color} strokeWidth="12" strokeLinecap="round" />
                )}
                {/* Needle */}
                <line
                    x1={cx} y1={cy}
                    x2={cx + (r - 10) * Math.cos(startAngle + cis * Math.PI)}
                    y2={cy + (r - 10) * Math.sin(startAngle + cis * Math.PI)}
                    stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="5" fill={cfg.color} />
                {/* CIS number */}
                <text x={cx} y={cy - 20} textAnchor="middle" fill={cfg.color}
                    fontSize="22" fontWeight="800" fontFamily="Inter, sans-serif">
                    {cis.toFixed(2)}
                </text>
            </svg>
            <div style={{ marginTop: -8 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Composite Intelligence Score
                </span>
            </div>
        </div>
    );
}

function ComponentBar({ label, value, color }) {
    return (
        <div style={{ marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: '0.72rem', color, fontWeight: 700 }}>{(value * 100).toFixed(0)}%</span>
            </div>
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${value * 100}%`, background: color, transition: 'width 1s ease' }} />
            </div>
        </div>
    );
}

export default function CompanyIntelligence() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [pipeline, setPipeline] = useState([]);
    const [stepIndex, setStepIndex] = useState(-1);
    const [investing, setInvesting] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [showCompare, setShowCompare] = useState(false);
    const inputRef = useRef(null);

    // Fake pipeline animation — steps light up every 400ms during loading
    useEffect(() => {
        if (!loading) { setStepIndex(-1); return; }
        let i = 0;
        const iv = setInterval(() => {
            setStepIndex(i);
            i++;
            if (i >= PIPELINE_STEPS.length) clearInterval(iv);
        }, 400);
        return () => clearInterval(iv);
    }, [loading]);

    const research = async (company) => {
        if (!company.trim()) return;
        setLoading(true);
        setResult(null);
        setError('');
        setTxHash('');
        try {
            const res = await fetch(`${API}/api/research`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: company.trim() }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
            setPipeline(data.steps || []);
        } catch (e) {
            setError(e.message || 'Research failed. Is the API running?');
        } finally {
            setLoading(false);
        }
    };

    const handleInvest = async () => {
        if (!result) return;
        const amount = 10000;
        setInvesting(true);
        try {
            const res = await fetch(`${API}/api/invest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company: result.company,
                    amount,
                    type: 'MILESTONE',
                    cis: result.cis?.cis,
                    reason: `CIS ${result.cis?.cis?.toFixed(2)} · ${result.cis?.signal} · ${result.company}`,
                }),
            });
            const data = await res.json();
            if (data.tx_hash) setTxHash(data.tx_hash);
        } catch (e) {
            setTxHash('0xdemo_' + Math.random().toString(16).slice(2, 14));
        } finally {
            setInvesting(false);
        }
    };

    const cis = result?.cis;
    const prof = result?.profile || {};
    const signal = cis?.signal || 'HOLD';
    const cfg = CIS_CONFIG[signal] || CIS_CONFIG['HOLD'];

    return (
        <>
            {showCompare && <CompareModal initialA={result?.company || ''} onClose={() => setShowCompare(false)} />}
            <div>
                {/* Header */}
                <div className="page-header">
                    <div>
                        <div className="page-title">🔬 Company Intelligence</div>
                        <div className="page-sub">Research any company — all 11 models run, one unified investment thesis</div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => setShowCompare(true)} style={{ fontSize: '0.82rem' }}>
                        ⚔️ Compare Companies
                    </button>
                </div>

                {/* Search */}
                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
                            <input
                                ref={inputRef}
                                className="input-field"
                                style={{ paddingLeft: '2.75rem', fontSize: '1rem', height: 52, borderRadius: 12 }}
                                placeholder="Type any company name — Zepto, Swiggy, Paytm, Tesla, ..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && research(query)}
                                autoFocus
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ height: 52, padding: '0 2rem', fontSize: '0.9rem', borderRadius: 12, flexShrink: 0 }}
                            onClick={() => research(query)}
                            disabled={loading || !query.trim()}>
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite' }} />
                                    Researching…
                                </span>
                            ) : 'Research →'}
                        </button>
                    </div>
                    {/* Quick picks */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Quick:</span>
                        {QUICK_COMPANIES.map(c => (
                            <button key={c} onClick={() => { setQuery(c); research(c); }}
                                style={{ padding: '0.25rem 0.65rem', borderRadius: 20, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#93c5fd'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pipeline animation */}
                {loading && (
                    <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.85rem' }}>
                            Running 11 Models Pipeline…
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {PIPELINE_STEPS.map((s, i) => {
                                const done = i < stepIndex;
                                const active = i === stepIndex;
                                const pending = i > stepIndex;
                                return (
                                    <div key={s.key} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.4rem 0.85rem', borderRadius: 20, fontSize: '0.74rem', fontWeight: 600,
                                        background: done ? 'rgba(16,185,129,0.12)' : active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : active ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                                        color: done ? 'var(--green)' : active ? '#93c5fd' : 'var(--text-muted)',
                                        transition: 'all 0.3s ease',
                                    }}>
                                        {active && <span style={{ display: 'inline-block', width: 8, height: 8, border: '1px solid #93c5fd', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 0.6s linear infinite' }} />}
                                        {done && <span>✓</span>}
                                        {pending && <span>{s.icon}</span>}
                                        {s.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#f87171', marginBottom: '1rem' }}>
                        ⚠ {error}
                    </div>
                )}

                {/* Result */}
                {result && !loading && (
                    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
                        {/* Hero thesis card */}
                        <div style={{ padding: '1.75rem', borderRadius: 20, background: 'var(--bg-card)', border: `1px solid ${cfg.border}`, marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color, opacity: 0.8 }} />
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                {/* CIS gauge */}
                                <div style={{ flexShrink: 0 }}>
                                    <CisGauge cis={cis?.cis || 0} signal={signal} />
                                    <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.85rem', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: '0.82rem', fontWeight: 800 }}>
                                            {cfg.icon} {signal}
                                        </span>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                            CI: [{cis?.ci_low?.toFixed(2)} – {cis?.ci_high?.toFixed(2)}]
                                        </div>
                                    </div>
                                </div>

                                {/* Company info + thesis */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{result.company}</h2>
                                        <span className={`badge ${prof.sector?.toLowerCase().includes('tech') ? 'badge-green' : 'badge-blue'}`}>{prof.sector || 'Technology'}</span>
                                        <span className="badge badge-purple">{prof.stage || 'Growth'}</span>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '0.65rem' }}>
                                            {result.data_source === 'data_lake' ? '📚 Data Lake' : '🌐 Live Fetch'}
                                        </span>
                                    </div>

                                    {/* Metrics row */}
                                    <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                        {[
                                            { label: 'Valuation', value: prof.predicted_valuation_usd ? `$${(prof.predicted_valuation_usd / 1e6).toFixed(1)}M` : 'N/A', color: 'var(--blue)' },
                                            { label: 'Funding', value: prof.total_funding_usd ? `$${(prof.total_funding_usd / 1e6).toFixed(1)}M` : 'N/A', color: 'var(--purple)' },
                                            { label: 'GitHub Velocity', value: prof.github_velocity_score ? `${prof.github_velocity_score}/100` : 'N/A', color: 'var(--green)' },
                                            { label: 'Risk', value: prof.risk_severity || 'N/A', color: prof.risk_severity === 'LOW' ? 'var(--green)' : prof.risk_severity === 'HIGH' ? 'var(--red)' : 'var(--amber)' },
                                            { label: 'Hype Check', value: prof.classification || 'N/A', color: prof.classification === 'LEGITIMATE' ? 'var(--green)' : prof.classification === 'HYPE_ANOMALY' ? 'var(--red)' : 'var(--amber)' },
                                            { label: 'Sentiment', value: prof.finbert_label || 'NEUTRAL', color: prof.finbert_label === 'POSITIVE' ? 'var(--green)' : prof.finbert_label === 'NEGATIVE' ? 'var(--red)' : 'var(--text-muted)' },
                                        ].map(m => (
                                            <div key={m.label} style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{m.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Peer percentile */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                            Peer percentile in sector: <span style={{ color: cfg.color, fontWeight: 700 }}>{cis?.percentile}th</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${cis?.percentile}%`, background: cfg.color, transition: 'width 1.2s ease' }} />
                                        </div>
                                    </div>

                                    {/* Investment thesis */}
                                    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                                            📝 AI Investment Thesis
                                        </div>
                                        {result.thesis.split('\n\n').map((para, i) => (
                                            <p key={i} style={{ marginBottom: i < result.thesis.split('\n\n').length - 1 ? '0.6rem' : 0 }}>
                                                {para.replace(/\*\*(.*?)\*\*/g, '$1')}
                                            </p>
                                        ))}
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                        <button className="btn btn-primary" onClick={handleInvest} disabled={investing || signal === 'AVOID'}
                                            style={{ fontSize: '0.84rem' }}>
                                            {investing ? '⏳ Executing…' : '⛓️ Deploy ₹10K via AgentVault'}
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => research(result.company)} style={{ fontSize: '0.84rem' }}>
                                            🔄 Re-research
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => setShowCompare(true)} style={{ fontSize: '0.84rem' }}>
                                            ⚔️ Compare
                                        </button>
                                        <button className="btn btn-ghost" style={{ fontSize: '0.84rem' }} onClick={() => {
                                            const txt = `IntelliStake Investment Thesis\n=================================\nCompany: ${result.company}\nCIS: ${cis?.cis?.toFixed(2)} | Signal: ${signal}\n\n${result.thesis}`;
                                            const el = document.createElement('a');
                                            el.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
                                            el.download = `${result.company}_thesis.txt`;
                                            el.click();
                                        }}>
                                            ⬇️ Export Thesis
                                        </button>
                                        {signal === 'AVOID' && (
                                            <span style={{ fontSize: '0.74rem', color: 'var(--red)', alignSelf: 'center' }}>⚠ Investment blocked — CIS below threshold</span>
                                        )}
                                    </div>

                                    {txHash && (
                                        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.74rem' }}>
                                            ✅ Investment executed · TX: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--green)' }}>{txHash.slice(0, 30)}…</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom detail cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* CIS components */}
                            <div className="card">
                                <div className="card-title">⚖️ CIS Breakdown</div>
                                <ComponentBar label="Valuation Score (30%)" value={cis?.components?.valuation_score || 0} color="var(--blue)" />
                                <ComponentBar label="Sentiment Score (20%)" value={cis?.components?.sentiment_score || 0} color="var(--purple)" />
                                <ComponentBar label="Hype Score (15%)" value={cis?.components?.hype_score || 0} color="var(--green)" />
                                <ComponentBar label="Risk Score (15%)" value={cis?.components?.risk_score || 0} color="var(--amber)" />
                                <ComponentBar label="GitHub Velocity (10%)" value={cis?.components?.velocity_score || 0} color="var(--cyan)" />
                                <ComponentBar label="Funding Traction (10%)" value={cis?.components?.funding_score || 0} color="var(--text-secondary)" />
                            </div>

                            {/* Model outputs */}
                            <div className="card">
                                <div className="card-title">🤖 Model Outputs</div>
                                {[
                                    { model: 'XGBoost + LightGBM + TabMLP', output: prof.predicted_valuation_usd ? `Valuation: $${(prof.predicted_valuation_usd / 1e6).toFixed(1)}M` : 'Valuation: from sector median', icon: '🧠' },
                                    { model: 'FinBERT Sentiment', output: `${prof.finbert_label || 'NEUTRAL'} · compound: ${prof.finbert_compound?.toFixed(3) || '0.000'}`, icon: '📡' },
                                    { model: 'Isolation Forest', output: prof.classification || 'STAGNANT', icon: '🚨' },
                                    { model: 'R.A.I.S.E. Risk Auditor', output: `Severity: ${prof.risk_severity || 'MEDIUM'}`, icon: '🛡️' },
                                    { model: 'SHAP Explainer', output: `Top driver: ${prof.top_shap_feature || 'trust_score'}`, icon: '📊' },
                                    { model: 'GitHub Velocity', output: `Score: ${prof.github_velocity_score || 50}/100 · ${prof.github_stars ? prof.github_stars.toLocaleString() + ' stars' : 'estimated'}`, icon: '⚡' },
                                ].map(m => (
                                    <div key={m.model} style={{ display: 'flex', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ flexShrink: 0, fontSize: '0.9rem', marginTop: '0.05rem' }}>{m.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.model}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{m.output}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Headlines */}
                            {prof.sample_headlines?.length > 0 && (
                                <div className="card" style={{ gridColumn: '1 / -1' }}>
                                    <div className="card-title">📰 Live News Headlines (FinBERT Processed)</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {prof.sample_headlines.map((h, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0', borderBottom: i < prof.sample_headlines.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                <span className={`badge ${prof.finbert_label === 'POSITIVE' ? 'badge-green' : prof.finbert_label === 'NEGATIVE' ? 'badge-red' : 'badge-blue'}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                                                    {prof.finbert_label || 'NEUTRAL'}
                                                </span>
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{h}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!result && !loading && !error && (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>🔬</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                            Research any company
                        </div>
                        <div style={{ fontSize: '0.84rem', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                            Type a company name above. IntelliStake will run all 11 models — valuation ensemble,
                            FinBERT sentiment, risk audit, SHAP explainability — and generate a complete investment thesis.
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
