import { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:5500';

const QUICK_COMPANIES = ['Zepto', 'Razorpay', 'CRED', 'PhonePe', 'Meesho', 'Nykaa', 'Groww', 'Slice'];

const PARAMS = [
    {
        id: 'burn_multiplier', label: 'Cash Burn Rate', icon: '🔥',
        desc: 'How fast the startup consumes capital vs baseline',
        min: 0.25, max: 4, step: 0.25, default: 1,
        unit: '×', badLow: false,
        format: v => `${v.toFixed(2)}×`,
        impact: v => v > 2 ? 'danger' : v > 1.5 ? 'warn' : v < 0.7 ? 'good' : 'neutral',
    },
    {
        id: 'velocity_delta', label: 'Tech Velocity Δ', icon: '⚡',
        desc: 'GitHub activity / engineering output vs baseline (%)',
        min: -80, max: 100, step: 5, default: 0,
        unit: '%', badLow: false,
        format: v => `${v > 0 ? '+' : ''}${v}%`,
        impact: v => v < -40 ? 'danger' : v < -15 ? 'warn' : v > 20 ? 'good' : 'neutral',
    },
    {
        id: 'sentiment_delta', label: 'Market Sentiment Δ', icon: '📡',
        desc: 'Change in FinBERT compound score vs baseline',
        min: -0.9, max: 0.9, step: 0.05, default: 0,
        unit: '', badLow: false,
        format: v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`,
        impact: v => v < -0.4 ? 'danger' : v < -0.15 ? 'warn' : v > 0.3 ? 'good' : 'neutral',
    },
    {
        id: 'market_size_delta', label: 'TAM / Market Size Δ', icon: '📊',
        desc: 'Total addressable market expansion or contraction',
        min: -50, max: 200, step: 10, default: 0,
        unit: '%', badLow: false,
        format: v => `${v > 0 ? '+' : ''}${v}%`,
        impact: v => v < -30 ? 'danger' : v > 50 ? 'good' : 'neutral',
    },
    {
        id: 'investor_exit_pct', label: 'Key Investor Exit', icon: '🚪',
        desc: 'Percentage of high-centrality investors exiting the sector',
        min: 0, max: 100, step: 5, default: 0,
        unit: '%', badLow: true,
        format: v => `${v}%`,
        impact: v => v > 60 ? 'danger' : v > 30 ? 'warn' : v === 0 ? 'good' : 'neutral',
    },
];

const impactColors = { danger: '#ef4444', warn: '#f59e0b', good: '#10b981', neutral: '#94a3b8' };

function Delta({ before, after, unit = '', bigger = 'good' }) {
    const diff = after - before;
    const pct = before !== 0 ? ((after - before) / Math.abs(before)) * 100 : 0;
    const isGood = bigger === 'good' ? diff >= 0 : diff <= 0;
    const col = Math.abs(diff) < 0.005 ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: col, lineHeight: 1 }}>
                {(after * 100).toFixed(1)}{unit}
            </div>
            <div style={{ fontSize: '0.66rem', color: col, fontWeight: 600 }}>
                {diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '– '}{Math.abs(pct).toFixed(1)}% from baseline
            </div>
        </div>
    );
}

export default function ScenarioAnalysis({ onNav }) {
    const [company, setCompany] = useState('');
    const [inputVal, setInputVal] = useState('');
    const [params, setParams] = useState(Object.fromEntries(PARAMS.map(p => [p.id, p.default])));
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const debounceRef = useRef();

    const runScenario = useCallback(async (co, p) => {
        if (!co) return;
        setLoading(true); setError('');
        try {
            const r = await fetch(`${API}/api/scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: co, params: p }),
            });
            const d = await r.json();
            if (d.error) setError(d.error);
            else setResult(d);
        } catch (e) {
            setError('API offline — start chatbot_api.py on port 5500');
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce slider changes
    useEffect(() => {
        if (!company) return;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runScenario(company, params), 400);
        return () => clearTimeout(debounceRef.current);
    }, [params, company, runScenario]);

    const handleCompany = (co) => {
        setCompany(co); setInputVal(co); setResult(null);
        runScenario(co, params);
    };

    const reset = () => setParams(Object.fromEntries(PARAMS.map(p => [p.id, p.default])));

    const loadCrisis = () => {
        const crisisParams = {
            burn_multiplier: 4.0, velocity_delta: -60, sentiment_delta: -0.7,
            market_size_delta: -30, investor_exit_pct: 70,
        };
        setParams(crisisParams);
        handleCompany('Byju');
    };

    const loadUnicorn = () => {
        const unicornParams = {
            burn_multiplier: 0.5, velocity_delta: 80, sentiment_delta: 0.7,
            market_size_delta: 100, investor_exit_pct: 0,
        };
        setParams(unicornParams);
        handleCompany('Zepto');
    };

    const isBaseline = PARAMS.every(p => params[p.id] === p.default);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">Digital Twin</span>
                        <span className="badge badge-purple">Scenario Analysis</span>
                        <span className="badge badge-green">AutoGluon + CoxPH</span>
                    </div>
                    <div className="page-title">🔬 Digital Twin Simulator</div>
                    <div className="page-sub">
                        Adjust parameters — see trust score & survival probability change in real-time using your trained models
                    </div>
                </div>
                <button className="btn btn-ghost" onClick={reset} disabled={isBaseline}>↺ Reset</button>
            </div>

            {/* Company input */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div className="input-wrapper">
                            <span className="input-icon">🏢</span>
                            <input
                                className="input-field has-icon"
                                placeholder='Select startup to simulate — e.g. "Zepto"'
                                value={inputVal}
                                onChange={e => setInputVal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCompany(inputVal)}
                            />
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleCompany(inputVal)} disabled={!inputVal.trim()}>
                        🔬 Load Twin
                    </button>
                    <button onClick={loadCrisis} title="Auto-fill Byju crisis scenario" style={{
                        padding: '0.5rem 0.85rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)',
                        background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.78rem',
                        fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>🚨 Crisis</button>
                    <button onClick={loadUnicorn} title="Auto-fill Zepto bull scenario" style={{
                        padding: '0.5rem 0.85rem', borderRadius: 8, border: '1px solid rgba(16,185,129,0.35)',
                        background: 'rgba(16,185,129,0.1)', color: '#34d399', fontSize: '0.78rem',
                        fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>🚀 Unicorn</button>

                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick:</span>
                    {QUICK_COMPANIES.map(q => (
                        <button key={q} onClick={() => handleCompany(q)} style={{
                            padding: '0.25rem 0.65rem', borderRadius: 6, border: `1px solid ${company === q ? 'var(--blue)' : 'var(--border)'}`,
                            background: company === q ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                            color: company === q ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer',
                        }}>{q}</button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem' }}>
                {/* LEFT: Sliders */}
                <div className="card">
                    <div className="card-title">⚙️ Scenario Parameters</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {PARAMS.map(p => {
                            const val = params[p.id];
                            const imp = p.impact(val);
                            const col = impactColors[imp];
                            const pct = ((val - p.min) / (p.max - p.min)) * 100;
                            return (
                                <div key={p.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1rem' }}>{p.icon}</span>
                                            <div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '0.25rem 0.7rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 800,
                                            background: `${col}18`, color: col, border: `1px solid ${col}33`, minWidth: 70, textAlign: 'center',
                                        }}>
                                            {p.format(val)}
                                        </div>
                                    </div>
                                    {/* Custom styled slider */}
                                    <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                                        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }} />
                                        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: col, transition: 'width 0.1s' }} />
                                        <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                                            onChange={e => setParams(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) }))}
                                            style={{ width: '100%', opacity: 0, height: 20, cursor: 'pointer', position: 'relative', zIndex: 1 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        <span>{p.format(p.min)}</span>
                                        {val !== p.default && (
                                            <span style={{ color: col, cursor: 'pointer' }} onClick={() => setParams(prev => ({ ...prev, [p.id]: p.default }))}>
                                                ↺ baseline ({p.format(p.default)})
                                            </span>
                                        )}
                                        <span>{p.format(p.max)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {!company && (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔬</div>
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Select a Startup</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Then adjust sliders to see how your scenarios affect trust score and survival probability
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: '0.8rem', color: '#ef4444' }}>
                            ❌ {error}
                        </div>
                    )}

                    {company && !error && (
                        <>
                            {/* Baseline vs Modified */}
                            <div className="card">
                                <div className="card-title">
                                    {loading ? '⏳ Recalculating…' : '📊 Baseline vs. Scenario'}
                                </div>

                                {result && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔵 Baseline</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{(result.original?.trust_score * 100).toFixed(1)}%</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Trust Score</div>
                                                <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#6366f1' }}>{(result.original?.survival_prob * 100).toFixed(1)}%</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>5-yr Survival</div>
                                            </div>
                                            <div style={{
                                                padding: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                                                border: `1px solid ${result.modified?.trust_score > result.original?.trust_score ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            }}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    {isBaseline ? '⚖️ Scenario' : '🔴 Scenario'}
                                                </div>
                                                <Delta before={result.original?.trust_score} after={result.modified?.trust_score} unit="%" bigger="good" />
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Trust Score</div>
                                                <Delta before={result.original?.survival_prob} after={result.modified?.survival_prob} unit="%" bigger="good" />
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>5-yr Survival</div>
                                            </div>
                                        </div>

                                        {/* Impact breakdown */}
                                        {result.impact_breakdown && (
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Parameter Contributions</div>
                                                {Object.entries(result.impact_breakdown).map(([key, val]) => {
                                                    const p = PARAMS.find(x => x.id === key);
                                                    if (!p) return null;
                                                    const isPos = val >= 0;
                                                    return (
                                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                                            <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{p.icon}</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                                                    <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{p.label}</span>
                                                                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: isPos ? '#10b981' : '#ef4444' }}>
                                                                        {isPos ? '+' : ''}{(val * 100).toFixed(2)}%
                                                                    </span>
                                                                </div>
                                                                <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: 2, transition: 'width 0.3s',
                                                                        width: `${Math.min(100, Math.abs(val) * 200)}%`,
                                                                        background: isPos ? '#10b981' : '#ef4444',
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Warning flags */}
                                        {result.warnings?.length > 0 && (
                                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                                                {result.warnings.map((w, i) => (
                                                    <div key={i} style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: i < result.warnings.length - 1 ? '0.25rem' : 0 }}>
                                                        ⚠ {w}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {loading && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
                                        <div>Running {company} Digital Twin…</div>
                                    </div>
                                )}
                            </div>

                            {/* Company baseline info */}
                            {result?.company_info && (
                                <div className="card">
                                    <div className="card-title">🏢 {company} — Baseline Profile</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        {[
                                            { label: 'Sector', v: result.company_info.sector },
                                            { label: 'Funding', v: result.company_info.funding_display },
                                            { label: 'GitHub Score', v: result.company_info.github_score },
                                            { label: 'Risk Level', v: result.company_info.risk_severity },
                                        ].map(m => (
                                            <div key={m.label} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{m.label}</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.v || '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
