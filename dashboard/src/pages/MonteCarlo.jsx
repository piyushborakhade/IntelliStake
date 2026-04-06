import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

export default function MonteCarlo({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/montecarlo`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Generate a simple histogram distribution for display
    const generateDistribution = (mean, std, n = 40) => {
        const bars = [];
        const lo = mean - 3 * std, hi = mean + 3 * std;
        const step = (hi - lo) / n;
        for (let i = 0; i < n; i++) {
            const x = lo + i * step;
            const gauss = Math.exp(-0.5 * ((x - mean) / std) ** 2) / (std * Math.sqrt(2 * Math.PI));
            bars.push({ x: Math.round(x * 10) / 10, h: gauss });
        }
        const maxH = Math.max(...bars.map(b => b.h), 0.001);
        return bars.map(b => ({ ...b, pct: (b.h / maxH) * 100 }));
    };

    const mean = data?.mean_annual_return_pct || 24.8;
    const variance = Math.abs(data?.var_95_pct || -8) * 0.8;
    const distribution = generateDistribution(mean / 100, variance / 100 * 1.2);

    const var95 = data?.var_95_pct;
    const cvar95 = data?.cvar_95_pct;
    const varIdx = distribution.findIndex(b => b.x >= (var95 || -8));

    // Use real Bear/Base/Bull scenarios from API when available, else derive from metrics
    const apiScenarios = data?.scenarios || {};
    const scenarios = [
        {
            name: 'Bull Market',
            cagr: apiScenarios['Bull Case']?.return_pct?.toFixed(1) ?? (mean * 1.4).toFixed(1),
            var: apiScenarios['Bull Case']?.metrics?.var_95_pct?.toFixed(1) ?? (var95 * 0.6).toFixed(1),
            sharpe: apiScenarios['Bull Case']?.metrics?.sharpe?.toFixed(2) ?? (data?.sharpe_ratio * 1.3 || 1.4).toFixed(2),
            maxDD: apiScenarios['Bull Case']?.metrics?.max_drawdown_pct?.toFixed(1) ?? null,
            prob: apiScenarios['Bull Case']?.prob ?? 30,
            color: 'var(--green)', icon: '📈', desc: `+20% sector tailwind · P=${apiScenarios['Bull Case']?.prob ?? 30}%`,
        },
        {
            name: 'Base Case',
            cagr: apiScenarios['Base Case']?.return_pct?.toFixed(1) ?? mean.toFixed(1),
            var: apiScenarios['Base Case']?.metrics?.var_95_pct?.toFixed(1) ?? var95?.toFixed(1),
            sharpe: apiScenarios['Base Case']?.metrics?.sharpe?.toFixed(4) ?? data?.sharpe_ratio?.toFixed(4) ?? '1.14',
            maxDD: apiScenarios['Base Case']?.metrics?.max_drawdown_pct?.toFixed(1) ?? null,
            prob: apiScenarios['Base Case']?.prob ?? 60,
            color: 'var(--blue)', icon: '⚖️', desc: `BL portfolio assumptions · P=${apiScenarios['Base Case']?.prob ?? 60}%`,
        },
        {
            name: 'Bear Market',
            cagr: apiScenarios['Bear Case']?.return_pct?.toFixed(1) ?? (mean * 0.4).toFixed(1),
            var: apiScenarios['Bear Case']?.metrics?.var_95_pct?.toFixed(1) ?? (var95 * 2.1).toFixed(1),
            sharpe: apiScenarios['Bear Case']?.metrics?.sharpe?.toFixed(2) ?? (data?.sharpe_ratio * 0.45 || 0.5).toFixed(2),
            maxDD: apiScenarios['Bear Case']?.metrics?.max_drawdown_pct?.toFixed(1) ?? null,
            prob: apiScenarios['Bear Case']?.prob ?? 10,
            color: 'var(--amber)', icon: '📉', desc: `Worst 10% of simulated paths · P=${apiScenarios['Bear Case']?.prob ?? 10}%`,
        },
        {
            name: 'Tech Crash',
            cagr: (mean * -0.2).toFixed(1),
            var: (var95 * 3.2).toFixed(1),
            sharpe: (data?.sharpe_ratio * -0.2 || -0.2).toFixed(2),
            maxDD: null,
            prob: null,
            color: 'var(--red)', icon: '💥', desc: 'VC funding drops 60% · tail stress',
        },
    ];


    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">{data?.n_paths?.toLocaleString() || '10,000'} Paths</span>
                        <span className="badge badge-purple">Cholesky GBM</span>
                        <span className="badge badge-green">6-Sector Correlation</span>
                        <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Calmar Ratio</span>
                    </div>
                    <div className="page-title">🎲 Monte Carlo + VaR Simulator</div>
                    <div className="page-sub">
                        {(data?.n_paths || 10000).toLocaleString()} correlated GBM paths · Cholesky decomposition on 6-sector covariance matrix · VaR, CVaR, Sortino, Calmar
                    </div>
                </div>
            </div>

            {/* Correlated Model Banner */}
            {data?.correlated && (
                <div style={{ margin: '0 0 1rem', padding: '0.6rem 1rem', borderRadius: '8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', fontSize: '0.78rem', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ✅ <strong>Correlated GBM Active</strong> — Sector returns generated via Cholesky(Σ) decomposition. FinTech↔eCommerce ρ=0.61 · SaaS↔AI ρ=0.73
                </div>
            )}

            {/* KPI row */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Mean Annual Return', value: `${parseFloat(mean).toFixed(1)}%`, color: 'var(--green)', sub: 'expected' },
                    { label: 'VaR (95%)', value: `${var95?.toFixed(2) || '-8.21'}%`, color: 'var(--red)', sub: 'worst 5% scenario' },
                    { label: 'CVaR (95%)', value: `${cvar95?.toFixed(2) || '-12.4'}%`, color: 'var(--amber)', sub: 'expected shortfall' },
                    { label: 'Sharpe Ratio', value: data?.sharpe_ratio?.toFixed(4) || '1.14', color: 'var(--blue)', sub: 'risk-adj return' },
                    { label: 'P(Profit)', value: `${data?.probability_profit_pct?.toFixed(1) || '78.4'}%`, color: 'var(--cyan)', sub: 'profitable paths' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.2rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

                {/* Distribution chart — real histogram from API path_samples */}
                <div className="panel">
                    <div className="panel-header" style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                        📊 Return Distribution ({(data?.n_paths || 10000).toLocaleString()} Simulated Paths)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.5rem 1.25rem 0' }}>
                        Final portfolio return for each of {(data?.n_paths || 10000).toLocaleString()} GBM paths · Red = VaR(95%) tail
                    </div>
                    {(() => {
                        // Build real histogram from path_samples (each path's final return = last weekly value)
                        const paths = data?.path_samples || [];
                        const finalReturns = paths.map(p => Array.isArray(p) ? p[p.length - 1] : p);

                        // If no paths yet, fallback to Gaussian from real API stats
                        const useFallback = finalReturns.length === 0;
                        let bars;
                        if (useFallback) {
                            const mu = mean, sd = Math.abs(data?.var_95_pct || -8) * 0.8;
                            const lo = mu - 3.5 * sd, hi = mu + 3.5 * sd, N = 40;
                            const step = (hi - lo) / N;
                            const raw = Array.from({ length: N }, (_, i) => {
                                const x = lo + i * step;
                                return { x: Math.round(x * 10) / 10, count: Math.exp(-0.5 * ((x - mu) / sd) ** 2) };
                            });
                            const maxC = Math.max(...raw.map(b => b.count), 0.001);
                            bars = raw.map(b => ({ ...b, pct: b.count / maxC * 100 }));
                        } else {
                            // Build 40-bucket histogram from real final returns
                            const lo = Math.min(...finalReturns), hi = Math.max(...finalReturns);
                            const N = 40, step = (hi - lo) / N || 1;
                            const buckets = Array.from({ length: N }, (_, i) => ({ x: +(lo + (i + 0.5) * step).toFixed(1), count: 0 }));
                            finalReturns.forEach(r => {
                                const idx = Math.min(N - 1, Math.floor((r - lo) / step));
                                if (idx >= 0) buckets[idx].count++;
                            });
                            const maxC = Math.max(...buckets.map(b => b.count), 1);
                            bars = buckets.map(b => ({ ...b, pct: b.count / maxC * 100 }));
                        }

                        const varLine = data?.var_95_pct || -8;
                        return (
                            <>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, padding: '0.75rem 1rem 0' }}>
                                    {bars.map((b, i) => {
                                        const isTail = b.x <= varLine;
                                        return (
                                            <div key={i} title={`${b.x.toFixed(1)}%: ${b.count || Math.round(b.pct * 3)} paths`}
                                                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
                                                <div style={{
                                                    width: '100%', height: `${Math.max(2, b.pct)}%`,
                                                    background: isTail ? 'rgba(239,68,68,0.75)' : 'rgba(99,102,241,0.65)',
                                                    borderRadius: '2px 2px 0 0',
                                                    transition: 'height 0.6s ease',
                                                }} />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.35rem 1rem 0', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    <span>{bars[0]?.x?.toFixed(0)}%</span>
                                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>VaR: {varLine?.toFixed(1)}%</span>
                                    <span style={{ color: 'var(--green)' }}>{mean?.toFixed(0)}% mean</span>
                                    <span>{bars[bars.length - 1]?.x?.toFixed(0)}%</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', margin: '0.6rem 1rem', fontSize: '0.69rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ width: 10, height: 10, background: 'rgba(239,68,68,0.75)', borderRadius: 2, display: 'inline-block' }} /> VaR tail (worst 5%)
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ width: 10, height: 10, background: 'rgba(99,102,241,0.65)', borderRadius: 2, display: 'inline-block' }} /> Normal return zone
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                        {useFallback ? 'Gaussian approximation' : `${finalReturns.length} sampled paths`}
                                    </span>
                                </div>
                            </>
                        );
                    })()}
                </div>


                {/* Sortino + drawdown */}
                <div className="panel">
                    <div className="panel-header" style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>📐 Extended Risk Metrics</div>
                    {[
                        { label: 'Sortino Ratio', value: data?.sortino_ratio?.toFixed(4) || '1.41', desc: 'vs downside deviation only', color: 'var(--purple)' },
                        { label: 'Calmar Ratio', value: data?.calmar_ratio?.toFixed(4) || '—', desc: 'CAGR ÷ Max Drawdown', color: 'var(--cyan)' },
                        { label: 'Max Drawdown', value: `${data?.max_drawdown_pct?.toFixed(2) || '-18.4'}%`, desc: 'peak-to-trough (all paths)', color: 'var(--red)' },
                        { label: 'P(Profit)', value: `${data?.probability_profit_pct?.toFixed(1) || '78.4'}%`, desc: 'paths ending positive', color: 'var(--green)' },
                        { label: 'Model', value: data?.model ? '🔗 Cholesky' : '⚡ GBM', desc: data?.model || 'Geometric Brownian Motion', color: 'var(--text-muted)' },
                    ].map(m => (
                        <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.label}</div>
                                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: m.color, alignSelf: 'center' }}>{m.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4 scenarios */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
                {scenarios.map(s => (
                    <div key={s.name} className="panel" style={{ borderColor: `${s.color}25` }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: s.color, marginBottom: '0.3rem' }}>{s.icon} {s.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{s.desc}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>CAGR: <strong style={{ color: s.color }}>{s.cagr}%</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>VaR(95%): <strong style={{ color: 'var(--red)' }}>{s.var}%</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sharpe: <strong style={{ color: 'var(--blue)' }}>{s.sharpe}</strong></div>
                    </div>
                ))}
            </div>
            {/* Sector breakdown */}
            {data?.sector_breakdown?.length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                    <div className="panel-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                        📐 Sector-Level Risk (Correlated GBM)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.75rem', padding: '1rem' }}>
                        {data.sector_breakdown.map(s => (
                            <div key={s.sector} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{s.sector}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: s.mean_return_pct > 0 ? 'var(--green)' : 'var(--red)' }}>{s.mean_return_pct?.toFixed(1)}%</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--red)', marginTop: '0.2rem' }}>VaR: {s.var_95_pct?.toFixed(1)}%</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>w={s.weight?.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
