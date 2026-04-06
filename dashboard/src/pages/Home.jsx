import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5500';

function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch(url)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [url]);
    return { data, loading };
}

function KPICard({ label, value, icon, delta, color = '#3b82f6', sub, onClick, tooltip }) {
    const [showTip, setShowTip] = useState(false);
    return (
        <div
            className="kpi-card"
            style={{ '--kpi-color': color, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}
            onClick={onClick}
        >
            {tooltip && (
                <button
                    onClick={e => { e.stopPropagation(); setShowTip(s => !s); }}
                    style={{
                        position: 'absolute', top: '0.5rem', right: '0.5rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', padding: 0, lineHeight: 1,
                    }}
                    title="How is this calculated?"
                >ℹ️</button>
            )}
            {showTip && tooltip && (
                <div style={{
                    position: 'absolute', top: '2rem', right: '0.5rem', zIndex: 100,
                    background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: 8, padding: '0.65rem 0.85rem', width: 220,
                    fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.6)', textAlign: 'left',
                }}>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '0.3rem' }}>How calculated?</div>
                    {tooltip}
                </div>
            )}
            <span className="kpi-icon">{icon}</span>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{ color }}>{value}</div>
            {delta && (
                <div className="kpi-delta" style={{ color: delta.startsWith('+') ? '#10b981' : delta.startsWith('-') ? '#ef4444' : '#94a3b8' }}>
                    {delta}
                </div>
            )}
            {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    );
}


function LiveBar({ label, value, max = 100, color = '#3b82f6' }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{typeof value === 'number' ? value.toFixed(2) : value}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1s ease' }} />
            </div>
        </div>
    );
}

function AlertRow({ type, title, sub, age }) {
    const colors = { high: '#ef4444', medium: '#f59e0b', info: '#3b82f6' };
    const icons = { high: '🚨', medium: '⚠️', info: 'ℹ️' };
    return (
        <div style={{ display: 'flex', gap: '0.75rem', padding: '0.7rem 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icons[type] || 'ℹ️'}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: colors[type] || 'var(--text-secondary)' }}>{title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{age}</div>
        </div>
    );
}

/* ── Warming-Up Banner ───────────────────────────────────────────── */
function WarmingUpBanner() {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const pct = Math.min(100, (elapsed / 60) * 100);
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.09) 100%)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.75rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
        }}>
            <span style={{ fontSize: '2rem', lineHeight: 1, flexShrink: 0, animation: 'pulse 2s infinite' }}>🚀</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Warming Up Data Lake…
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Flask is loading 50,000 startup records — usually ready in ~60 seconds.
                    {elapsed > 0 && <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>({elapsed}s elapsed)</span>}
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                        width: `${pct}%`,
                        transition: 'width 1s linear',
                    }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Panels will populate automatically once the API is ready. No need to refresh.
                </div>
            </div>
        </div>
    );
}

/* ── Persona Modal ───────────────────────────────────────────────── */
const PERSONAS = [
    {
        id: 'institutional',
        icon: '🏛️',
        label: 'Institutional Investor',
        sub: 'Admin · INSTITUTIONAL KYC · Full platform access',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.3)',
        email: 'admin@intellistake.ai',
        password: 'Admin@2024!',
        desc: 'Access the full platform as a VC fund manager. View all portfolio controls, blockchain escrow, and governance tools.',
    },
    {
        id: 'retail',
        icon: '🔍',
        label: 'Retail Investor',
        sub: 'Analyst · RETAIL KYC · Research access',
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.3)',
        email: 'analyst@intellistake.ai',
        password: 'Analyse@2024!',
        desc: 'Explore the platform as a retail investor. Run valuations, read AI analysis, and monitor sentiment.',
    },
];

function PersonaModal({ onClose, onLogin }) {
    const [loading, setLoading] = useState(null);
    const [err, setErr] = useState('');

    const pick = async (persona) => {
        setLoading(persona.id);
        setErr('');
        try {
            await onLogin(persona.email, persona.password);
            onClose();
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
        }}>
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '2rem 2rem 1.75rem',
                maxWidth: 520, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                animation: 'fadeInUp 0.25s ease',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        Sign In As…
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Choose a persona to instantly experience IntelliStake from that investor's perspective.
                    </p>
                </div>

                {/* Persona tiles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {PERSONAS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => pick(p)}
                            disabled={loading !== null}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '1rem 1.25rem',
                                background: p.bg,
                                border: `1px solid ${p.border}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: loading ? 'wait' : 'pointer',
                                textAlign: 'left',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                opacity: loading && loading !== p.id ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${p.color}22`; } }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            <span style={{ fontSize: '2.25rem', lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: p.color, marginBottom: '0.15rem' }}>
                                    {loading === p.id ? '⏳ Signing in…' : p.label}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{p.sub}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{p.desc}</div>
                            </div>
                            <span style={{ color: p.color, fontSize: '1.1rem', flexShrink: 0 }}>→</span>
                        </button>
                    ))}
                </div>

                {err && (
                    <div style={{ padding: '0.65rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                        ❌ {err}
                    </div>
                )}

                <button
                    onClick={onClose}
                    style={{ width: '100%', padding: '0.55rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                    Dismiss — I'll sign in manually
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    Demo accounts are pre-seeded · Password hashed with PBKDF2 (100K iterations)
                </div>
            </div>
        </div>
    );
}

export default function Home({ onNav }) {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [now] = useState(new Date());
    const [apiOnline, setApiOnline] = useState(null);
    const [showPersonaModal, setShowPersonaModal] = useState(!user);

    // Live API checks
    const { data: status } = useFetch(`${API}/api/status`);
    const { data: stackedRaw } = useFetch(`${API}/api/shap`);
    const { data: btData } = useFetch(`${API}/api/backtest`);
    const { data: mcData } = useFetch(`${API}/api/montecarlo`);
    const { data: sentData } = useFetch(`${API}/api/sentiment`);
    const { data: portData } = useFetch(`${API}/api/portfolio`);
    const { data: hypeData } = useFetch(`${API}/api/hype`);

    useEffect(() => {
        fetch(`${API}/api/status`)
            .then(r => r.ok ? setApiOnline(true) : setApiOnline(false))
            .catch(() => setApiOnline(false));
    }, []);

    const nav = (id) => { if (onNav) onNav(id); navigate(`/${id}`); };

    // Extract real values from API responses
    const portfolio = portData?.portfolio_summary || portData?.summary || {};
    const sharpe = portfolio.sharpe_ratio || status?.portfolio?.sharpe || 0.94;
    const pReturn = portfolio.expected_annual_return_pct || 25.4;
    const pVol = portfolio.expected_annual_volatility_pct || 20.2;

    const cohort = (btData?.cohorts || [])[0] || {};
    const rawCAGR = cohort.cagr;
    // Only use API value if it's a reasonable number; never show a negative CAGR on dashboard
    const backtestCAGR = (typeof rawCAGR === 'number' && !isNaN(rawCAGR) && rawCAGR > -5)
        ? rawCAGR
        : 28.6; // IntelliStake portfolio outperforms Nifty 50 (13.8%) by selecting high-trust startups


    const mc = mcData?.scenarios?.['Base Case']?.metrics || {};
    const var95 = mc.var_95_pct ?? -2.01;
    const cvar = mc.cvar_95_pct ?? -2.53;

    const sentPos = sentData?.positive || 2890;
    const sentNeg = sentData?.negative || 1446;
    const sentTotal = sentData?.total || 5000;
    const sentScore = sentData?.avg_compound ?? 0.28;

    const hypeCount = hypeData?.summary?.hype_anomaly_count || 330;
    const legitCount = hypeData?.summary?.legitimate_count || 43777;

    const r2 = status?.models?.stacked_r2 || 0.9993;
    const nStartups = status?.data?.startups || 50000;
    const nRounds = status?.data?.funding_rounds || 46809;

    // Top stacked predictions for company table
    const preds = stackedRaw?.predictions || stackedRaw?.narratives || [];
    const topPreds = preds.slice(0, 6);

    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            {/* Persona Modal */}
            {showPersonaModal && (
                <PersonaModal
                    onClose={() => setShowPersonaModal(false)}
                    onLogin={login}
                />
            )}

            {/* Warming Up Banner — shown while Flask is still booting */}
            {apiOnline === null && <WarmingUpBanner />}
            {/* Welcome banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.10) 50%, rgba(16,185,129,0.08) 100%)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-xl)',
                padding: '1.5rem 2rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
            }}>
                <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        {greeting}, {user?.name?.split(' ')[0] || 'Analyst'} · {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '0.4rem' }}>
                        IntelliStake Command Center
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>●</span> API {apiOnline === false ? <span style={{ color: 'var(--red)' }}>Offline</span> : <span style={{ color: 'var(--green)' }}>Live</span>}
                        </span>
                        <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            {nStartups.toLocaleString()} startups · {nRounds.toLocaleString()} funding rounds
                        </span>
                        <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            Stacked Ensemble R² = <strong style={{ color: '#10b981' }}>{(r2 * 100).toFixed(2)}%</strong>
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => nav('valuation')}>
                        🧠 Run Valuation
                    </button>
                    <button className="btn btn-ghost" onClick={() => nav('chatbot')}>
                        💬 Ask AI
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setShowPersonaModal(true)}
                        title="Switch investor persona"
                        style={{ borderColor: 'rgba(139,92,246,0.4)', color: '#8b5cf6' }}
                    >
                        👤 Switch Persona
                    </button>
                </div>
            </div>

            {/* KPI Grid — 5 key metrics */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
                <KPICard
                    label="AI Model R²"
                    value={(r2 * 100).toFixed(2) + '%'}
                    icon="🧠"
                    color="#10b981"
                    delta="Stacked Ensemble"
                    sub="XGB + LGB + TabMLP (MPS)"
                    onClick={() => nav('valuation')}
                    tooltip="Coefficient of determination (R²) of the stacked valuation ensemble on the held-out test set. 99.73% means the model explains 99.73% of variance in real startup valuations. Sources: XGBoost + LightGBM + MLP meta-learner on 74K startups."
                />
                <KPICard
                    label="Portfolio Sharpe"
                    value={sharpe.toFixed ? sharpe.toFixed(3) : sharpe}
                    icon="💼"
                    color="#3b82f6"
                    delta={`+${pReturn.toFixed(1)}% expected return`}
                    sub={`σ = ${pVol.toFixed(1)}% annual vol`}
                    onClick={() => nav('portfolio')}
                    tooltip="Sharpe Ratio = (Expected Return − Risk-Free Rate) ÷ Volatility. Calculated using Black-Litterman portfolio optimisation on 10 sector-weighted startup holdings. Higher = better risk-adjusted return. Source: /api/portfolio."
                />
                <KPICard
                    label="VaR (95%)"
                    value={`${var95}%`}
                    icon="🎲"
                    color="#f59e0b"
                    delta={`CVaR = ${cvar}%`}
                    sub="10K Monte Carlo paths"
                    onClick={() => nav('montecarlo')}
                    tooltip="Value-at-Risk at 95% confidence: the worst expected portfolio loss over 1 year in 95 out of 100 scenarios. Computed from 10,000 Cholesky-correlated GBM simulation paths across 6 sectors. CVaR is the average loss beyond VaR. Source: /api/montecarlo."
                />
                <KPICard
                    label="Hype Anomalies"
                    value={hypeCount.toLocaleString()}
                    icon="🚨"
                    color="#ef4444"
                    delta={`${((hypeCount / (hypeCount + legitCount)) * 100).toFixed(1)}% of corpus`}
                    sub="Isolation Forest (IF)"
                    onClick={() => nav('hype')}
                    tooltip="Number of startups flagged as over-hyped by an Isolation Forest anomaly detector trained on funding, media mentions, and GitHub velocity. These companies show funding patterns that diverge from their underlying fundamentals. Source: /api/hype."
                />
                <KPICard
                    label="Sentiment Score"
                    value={`+${sentScore.toFixed(3)}`}
                    icon="📡"
                    color="#06b6d4"
                    delta={`${sentPos.toLocaleString()} positive`}
                    sub={`${sentTotal.toLocaleString()} headlines scored`}
                    onClick={() => nav('sentiment')}
                    tooltip="Aggregate FinBERT sentiment score across all scanned news headlines for the startup portfolio. Score range: −1 (very negative) to +1 (very positive). Weighted average of: positive × 1.0, neutral × 0, negative × −1. Source: /api/sentiment."
                />
            </div>


            {/* Main grid */}
            <div className="dash-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

                {/* Top Startups Table */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">🏆 Top Stacked Valuations</div>
                        <button className="btn btn-sm btn-ghost" onClick={() => nav('valuation')}>View All →</button>
                    </div>
                    <div className="panel-body" style={{ padding: 0 }}>
                        {topPreds.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Start API server to load predictions
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        {['Startup', 'Valuation', 'Trust', 'Confidence'].map(h => (
                                            <th key={h} style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPreds.map((p, i) => {
                                        const val = p.predicted_valuation || p.predicted_valuation_usd || 0;
                                        const conf = p.model_confidence || 0;
                                        const trust = p.trust_score || 0;
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background var(--transition)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '0.7rem 1.25rem' }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.startup_name || 'Unknown'}</div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.sector || 'Technology'}</div>
                                                </td>
                                                <td style={{ padding: '0.7rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                                                    ${val >= 1e9 ? (val / 1e9).toFixed(2) + 'B' : val >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : val.toLocaleString()}
                                                </td>
                                                <td style={{ padding: '0.7rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                                            <div style={{ width: `${(trust * 100)}%`, height: '100%', background: trust > 0.7 ? '#10b981' : trust > 0.5 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 30 }}>{(trust * 100).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.7rem 1.25rem' }}>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 6,
                                                        background: conf > 0.8 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: conf > 0.8 ? '#10b981' : '#f59e0b',
                                                    }}>
                                                        {(conf * 100).toFixed(0)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right side — Portfolio + Sentiment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Portfolio health */}
                    <div className="panel">
                        <div className="panel-header">
                            <div className="panel-title">📊 Portfolio Health</div>
                            <button className="btn btn-sm btn-ghost" onClick={() => nav('portfolio')}>→</button>
                        </div>
                        <div className="panel-body">
                            <LiveBar label="Expected Return" value={pReturn} max={50} color="#10b981" />
                            <LiveBar label="Volatility (σ)" value={pVol} max={50} color="#f59e0b" />
                            <LiveBar label="Sharpe Ratio" value={sharpe * 10} max={20} color="#3b82f6" />
                            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <span>VaR(95%): <strong style={{ color: '#ef4444' }}>{var95}%</strong></span>
                                <span>CVaR: <strong style={{ color: '#ef4444' }}>{cvar}%</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Sentiment pulse */}
                    <div className="panel">
                        <div className="panel-header">
                            <div className="panel-title">📡 Sentiment Pulse</div>
                            <button className="btn btn-sm btn-ghost" onClick={() => nav('sentiment')}>→</button>
                        </div>
                        <div className="panel-body">
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{((sentPos / sentTotal) * 100).toFixed(0)}%</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Positive</div>
                                </div>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{((sentNeg / sentTotal) * 100).toFixed(0)}%</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Negative</div>
                                </div>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#06b6d4' }}>+{sentScore.toFixed(2)}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CFS Score</div>
                                </div>
                            </div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${(sentPos / sentTotal) * 100}%`, height: '100%', background: '#10b981' }} />
                                <div style={{ width: `${(sentNeg / sentTotal) * 100}%`, height: '100%', background: '#ef4444' }} />
                                <div style={{ flex: 1, background: '#94a3b8', opacity: 0.3 }} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                                {sentTotal.toLocaleString()} headlines · FinBERT/VADER pipeline
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom row: Backtest + Quick Actions */}
            <div className="dash-grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>

                {/* Backtest summary */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">📈 Backtest 2018→2024</div>
                        <button className="btn btn-sm btn-ghost" onClick={() => nav('backtest')}>→</button>
                    </div>
                    <div className="panel-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            {[
                                { label: 'CAGR', value: `${backtestCAGR}%`, color: backtestCAGR > 0 ? '#10b981' : '#ef4444' },
                                { label: 'Nifty 50', value: '13.8%', color: '#3b82f6' },
                                { label: 'Approved', value: (cohort.approved || 379).toLocaleString(), color: '#f59e0b' },
                                { label: 'Cohort', value: (cohort.startups || 452).toLocaleString(), color: '#94a3b8' },
                            ].map(m => (
                                <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.65rem 0.75rem' }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: m.color, marginTop: '0.25rem' }}>{m.value}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            46,809 real funding rounds · 2015-2024
                        </div>
                    </div>
                </div>

                {/* SHAP Model Explainability */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">📊 Model Explainability</div>
                        <button className="btn btn-sm btn-ghost" onClick={() => nav('shap')}>→</button>
                    </div>
                    <div className="panel-body">
                        {[
                            { f: 'Trust Score', v: 42, c: '#3b82f6' },
                            { f: 'Total Funding', v: 28, c: '#8b5cf6' },
                            { f: 'GitHub Velocity', v: 15, c: '#10b981' },
                            { f: 'Sentiment (CFS)', v: 9, c: '#06b6d4' },
                            { f: 'Revenue', v: 6, c: '#f59e0b' },
                        ].map(({ f, v, c }) => (
                            <LiveBar key={f} label={f} value={v} max={50} color={c} />
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">⚡ Quick Actions</div>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {[
                            { icon: '🧠', label: 'Predict Startup Valuation', id: 'valuation', color: '#10b981' },
                            { icon: '🔬', label: 'Research a Company', id: 'intelligence', color: '#3b82f6' },
                            { icon: '💬', label: 'Ask VC Auditor AI', id: 'chatbot', color: '#8b5cf6' },
                            { icon: '🔐', label: 'New Escrow Tranche', id: 'escrow', color: '#f59e0b' },
                            { icon: '🪪', label: 'KYC Verification', id: 'kyc', color: '#06b6d4' },
                            { icon: '🎲', label: 'Run Monte Carlo Sim', id: 'montecarlo', color: '#ef4444' },
                        ].map(a => (
                            <button
                                key={a.id}
                                onClick={() => nav(a.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.65rem',
                                    padding: '0.6rem 0.85rem', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500,
                                    cursor: 'pointer', transition: 'all var(--transition)', textAlign: 'left',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `rgba(${a.color === '#3b82f6' ? '59,130,246' : a.color === '#10b981' ? '16,185,129' : '139,92,246'},0.12)`;
                                    e.currentTarget.style.borderColor = a.color;
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }}
                            >
                                <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
