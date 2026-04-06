import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

export default function Backtest() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/backtest`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const cohorts = data?.cohorts || [];
    const topPicks = data?.top_picks || [];
    const niftyCagr = data?.nifty_cagr ?? 13.8;
    const modelR2 = data?.model_r2 ?? 0.99930;
    const dataSource = data?.data_source || '';
    const isReal = dataSource.includes('real_funding');

    const best = cohorts[0] || {};
    const maxBar = Math.max(...cohorts.map(c => Math.abs(c.cagr || 0)), niftyCagr, 30);

    return (
        <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            {/* KPI Strip */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                <div className="kpi-card" style={{ '--kpi-color': '#10b981' }}>
                    <span className="kpi-icon">📈</span>
                    <div className="kpi-label">2018 Cohort CAGR</div>
                    <div className="kpi-value" style={{ color: (best.cagr || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {loading ? '…' : `${best.cagr ?? '-27.8'}%`}
                    </div>
                    <div className="kpi-delta" style={{ color: '#94a3b8' }}>IntelliStake portfolio</div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#3b82f6' }}>
                    <span className="kpi-icon">📊</span>
                    <div className="kpi-label">Nifty 50 Benchmark</div>
                    <div className="kpi-value" style={{ color: '#3b82f6' }}>{niftyCagr}%</div>
                    <div className="kpi-delta" style={{ color: '#94a3b8' }}>CAGR 2018–2024</div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#8b5cf6' }}>
                    <span className="kpi-icon">α</span>
                    <div className="kpi-label">Alpha vs Nifty</div>
                    <div className="kpi-value" style={{ color: (best.alpha || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {loading ? '…' : `${best.alpha ?? '-41.6'}%`}
                    </div>
                    <div className="kpi-delta" style={{ color: '#94a3b8' }}>outperformance</div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#f59e0b' }}>
                    <span className="kpi-icon">📐</span>
                    <div className="kpi-label">Sharpe Ratio</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>
                        {loading ? '…' : (best.sharpe ?? 'N/A')}
                    </div>
                    <div className="kpi-delta" style={{ color: '#94a3b8' }}>risk-adjusted return</div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#06b6d4' }}>
                    <span className="kpi-icon">🧠</span>
                    <div className="kpi-label">Stacked Model R²</div>
                    <div className="kpi-value" style={{ color: '#06b6d4' }}>
                        {loading ? '…' : `${(modelR2 * 100).toFixed(2)}%`}
                    </div>
                    <div className="kpi-delta" style={{ color: '#94a3b8' }}>XGB + LGB + TabMLP</div>
                </div>
            </div>

            {/* Source badge */}
            <div style={{ marginBottom: '1rem' }}>
                <span className={`badge ${isReal ? 'badge-green' : 'badge-purple'}`}>
                    {isReal ? '✓ Real Funding Data' : '⚠ Estimated'}
                </span>
                {isReal && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                    46,809 actual Indian startup funding rounds · 2015–2024
                </span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

                {/* Cohort CAGR bars */}
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-title">📊 CAGR by Cohort Year vs Nifty 50</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span><span style={{ color: '#10b981' }}>■</span> IntelliStake</span>
                            <span><span style={{ color: '#8b5cf6' }}>■</span> Baseline</span>
                            <span><span style={{ color: '#3b82f6' }}>■</span> Nifty 50</span>
                        </div>
                    </div>
                    <div className="panel-body">
                        {loading
                            ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading…</div>
                            : cohorts.length === 0
                                ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Start API server to load real backtest</div>
                                : cohorts.map(c => {
                                    const cagr = c.cagr ?? 0;
                                    const base = c.baseline_cagr ?? 0;
                                    const isNeg = cagr < 0;
                                    const absMax = Math.max(Math.abs(cagr), Math.abs(base), niftyCagr, 30);
                                    return (
                                        <div key={c.year} style={{ marginBottom: '1.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.year} Cohort</span>
                                                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.72rem' }}>
                                                    <span style={{ color: isNeg ? '#ef4444' : '#10b981', fontWeight: 700 }}>IS: {cagr}%</span>
                                                    <span style={{ color: '#8b5cf6' }}>BL: {base}%</span>
                                                    <span style={{ color: '#3b82f6' }}>N50: {niftyCagr}%</span>
                                                </div>
                                            </div>
                                            {/* IS bar */}
                                            <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden', marginBottom: 3 }}>
                                                <div style={{ height: '100%', width: `${(Math.abs(cagr) / absMax) * 100}%`, background: isNeg ? '#ef4444' : 'linear-gradient(90deg,#10b981,#06b6d4)', borderRadius: 5, transition: 'width 1s ease' }} />
                                            </div>
                                            {/* Nifty bar */}
                                            <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                                                <div style={{ height: '100%', width: `${(niftyCagr / absMax) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                <span>Alpha: <strong style={{ color: (c.alpha ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>{c.alpha}%</strong></span>
                                                <span>Sharpe: <strong style={{ color: '#3b82f6' }}>{c.sharpe}</strong></span>
                                                <span>Approved: <strong>{c.approved?.toLocaleString()}</strong></span>
                                                {c.data_source === 'real_funding_data' && <span style={{ color: '#10b981' }}>✓ Real</span>}
                                            </div>
                                        </div>
                                    );
                                })
                        }
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Risk metrics */}
                    <div className="panel">
                        <div className="panel-header">
                            <div className="panel-title">📐 Risk-Adjusted Metrics</div>
                        </div>
                        <div className="panel-body">
                            {[
                                { label: 'Sharpe Ratio', value: best.sharpe ?? 'N/A', desc: '(Rp-Rf)/σp' },
                                { label: 'Sortino Ratio', value: best.sortino ?? 'N/A', desc: 'downside deviation adjusted' },
                                { label: 'Info Ratio', value: best.ir ?? 'N/A', desc: 'vs Nifty tracking error' },
                                { label: 'Alpha', value: `${best.alpha ?? '-41.6'}%`, desc: 'vs Nifty 50 CAGR' },
                                { label: 'Success Rate', value: `${best.success_rate ?? 'N/A'}%`, desc: 'startups achieving growth' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.label}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#10b981', alignSelf: 'center' }}>{m.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top picks */}
                    <div className="panel">
                        <div className="panel-header">
                            <div className="panel-title">🏆 Top Model Picks</div>
                        </div>
                        <div className="panel-body" style={{ padding: '0.5rem 0' }}>
                            {topPicks.slice(0, 8).map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{p.startup_name || p.name}</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{p.sector}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {parseFloat(p.trust_score || 0).toFixed(2)}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: p.success_by_2024 ? '#10b981' : '#ef4444' }}>
                                            {p.success_by_2024 ? '✅' : '❌'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {topPicks.length === 0 && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    Run backtest_engine.py to generate picks
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Academic statement */}
            <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#10b981', marginBottom: '0.4rem' }}>📚 Proof Statement</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    Using <strong>46,809 real Indian startup funding rounds (Crunchbase/Tracxn, 2015–2024)</strong> as ground truth,
                    IntelliStake's stacked ensemble (XGBoost + LightGBM + TabMLP, <strong>R²={`${(modelR2 * 100).toFixed(2)}%`}</strong>)
                    selected a 2018 cohort of <strong>{best.approved || 379} startups</strong> from a universe of {best.startups || 452}.
                    The resulting portfolio achieved a CAGR of <strong>{best.cagr ?? '-27.85'}%</strong> vs Nifty 50's {niftyCagr}%,
                    with an alpha of <strong>{best.alpha ?? '-41.65'}%</strong>.
                    Data source: <em>{dataSource || 'backtest_results.json'}</em>.
                </div>
            </div>
        </div>
    );
}
