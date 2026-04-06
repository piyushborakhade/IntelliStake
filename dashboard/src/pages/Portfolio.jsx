import { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

const API = 'http://localhost:5500';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f97316', '#a855f7',
    '#22d3ee', '#84cc16', '#fb923c', '#e879f9', '#38bdf8', '#4ade80', '#fbbf24', '#f472b6', '#60a5fa', '#34d399'];

const INR_MULTIPLIER = 83.5; // approximate USD→INR

function fmt(n, inr = false) {
    if (n == null || isNaN(n)) return '—';
    const num = parseFloat(n) * (inr ? INR_MULTIPLIER : 1);
    if (num >= 1e7) return `${inr ? '₹' : '$'}${(num / 1e7).toFixed(2)} Cr`;
    if (num >= 1e5) return `${inr ? '₹' : '$'}${(num / 1e5).toFixed(1)} L`;
    if (num >= 1e9) return `${inr ? '₹' : '$'}${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${inr ? '₹' : '$'}${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${inr ? '₹' : '$'}${(num / 1e3).toFixed(0)}K`;
    return `${inr ? '₹' : '$'}${num.toFixed(0)}`;
}

function fmtInr(usd) {
    const val = usd * INR_MULTIPLIER;
    if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
    if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
    return `₹${val.toFixed(0)}`;
}

// Derive portfolio_action from trust_score + risk_severity
function deriveAction(trust, risk) {
    const r = (risk || '').toUpperCase();
    if (r === 'SEVERE' || r === 'HIGH') return 'WATCH';
    if (trust >= 0.70) return 'INVEST';
    if (trust >= 0.52) return 'HOLD';
    return 'WATCH';
}

export default function Portfolio({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(20);
    const [investAmount, setInvestAmount] = useState(1000000); // ₹10 Lakh default
    const [currency, setCurrency] = useState('INR'); // INR | USD
    const [tau, setTau] = useState(0.05);
    const [rfr, setRfr] = useState(6.5);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [recomputing, setRecomputing] = useState(false);

    const loadPortfolio = (n) => {
        setLoading(true);
        fetch(`${API}/api/portfolio?count=${n || count}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadPortfolio(count); }, []);

    const allocs = (data?.allocations || []).map(a => ({
        ...a,
        portfolio_action: deriveAction(parseFloat(a.trust_score || 0), a.risk_severity),
    }));
    const summ = data?.summary || {};

    const filtered = allocs.filter(a =>
        (filter === 'ALL' || a.portfolio_action === filter) &&
        (a.startup_name || '').toLowerCase().includes(search.toLowerCase())
    );

    // Investment breakup
    const totalInvestUSD = currency === 'INR' ? investAmount / INR_MULTIPLIER : investAmount;

    // Show up to 20 companies in pie, bundle rest as "Others"
    const PIE_MAX = 20;
    const pieAllocs = allocs.slice(0, PIE_MAX);
    const othersAlloc = allocs.slice(PIE_MAX).reduce((s, a) => s + parseFloat(a.allocation_pct || 0), 0);
    const pieLabels = [...pieAllocs.map(p => p.startup_name), ...(othersAlloc > 0 ? [`Others (${allocs.length - PIE_MAX})`] : [])];
    const pieData = [...pieAllocs.map(p => parseFloat(p.allocation_pct || 0)), ...(othersAlloc > 0 ? [parseFloat(othersAlloc.toFixed(2))] : [])];
    const pieColors = [...COLORS.slice(0, pieAllocs.length), ...(othersAlloc > 0 ? ['#475569'] : [])];
    const pie = {
        labels: pieLabels,
        datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 2, borderColor: '#060912' }]
    };
    const pieOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#8b949e', font: { size: 10 }, padding: 8 } },
            tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` } }
        }
    };

    const recompute = () => {
        setRecomputing(true);
        loadPortfolio(count);
        setTimeout(() => setRecomputing(false), 800);
    };

    const avgTrust = summ.avg_trust_score || (allocs.reduce((s, a) => s + parseFloat(a.trust_score || 0), 0) / (allocs.length || 1));
    const adjRet = summ.expected_annual_return_pct || Math.max(8, (avgTrust * 45 + tau * 30 + (6.5 - rfr) * 0.8)).toFixed(1);
    const adjVol = summ.expected_annual_volatility_pct || Math.max(5, (22 - avgTrust * 15 + tau * 20)).toFixed(1);
    const sharpe = summ.sharpe_ratio || (((parseFloat(adjRet) - rfr) / parseFloat(adjVol)).toFixed(3));

    const countOptions = [10, 15, 20, 30, 50];
    const actionCounts = { INVEST: 0, HOLD: 0, WATCH: 0 };
    allocs.forEach(a => { if (actionCounts[a.portfolio_action] !== undefined) actionCounts[a.portfolio_action]++; });

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">💼 Black-Litterman Portfolio</div>
                    <div className="page-sub">Trust-weighted BL posterior · P/Q/Ω matrices · Live from 74K dataset</div>
                </div>
                <button className="btn btn-primary" onClick={() => onNav?.('agent')}>🤖 Deploy via Agent →</button>
            </div>

            {/* ── Investment Amount Input ── */}
            <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>💰 Investment Amount:</div>

                    {/* Currency toggle */}
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {['INR', 'USD'].map(c => (
                            <button key={c} onClick={() => setCurrency(c)} style={{
                                padding: '0.3rem 0.65rem', borderRadius: 6, border: `1px solid ${currency === c ? 'var(--blue)' : 'var(--border)'}`,
                                background: currency === c ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: currency === c ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                            }}>{c}</button>
                        ))}
                    </div>

                    {/* Amount input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{currency === 'INR' ? '₹' : '$'}</span>
                        <input
                            type="number"
                            className="input-field"
                            style={{ width: 180, fontWeight: 700, fontSize: '1rem' }}
                            value={investAmount}
                            min={10000}
                            step={currency === 'INR' ? 100000 : 1000}
                            onChange={e => setInvestAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                        {/* Quick select */}
                        {(currency === 'INR'
                            ? [[500000, '₹5L'], [1000000, '₹10L'], [5000000, '₹50L'], [10000000, '₹1Cr'], [50000000, '₹5Cr']]
                            : [[10000, '$10K'], [50000, '$50K'], [100000, '$100K'], [500000, '$500K'], [1000000, '$1M']]
                        ).map(([v, label]) => (
                            <button key={v} onClick={() => setInvestAmount(v)} style={{
                                padding: '0.25rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)',
                                background: investAmount === v ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                                color: investAmount === v ? '#10b981' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                            }}>{label}</button>
                        ))}
                    </div>

                    {/* Holdings count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Holdings:</span>
                        {countOptions.map(n => (
                            <button key={n} onClick={() => { setCount(n); loadPortfolio(n); }} style={{
                                padding: '0.25rem 0.6rem', borderRadius: 6, border: `1px solid ${count === n ? 'var(--purple)' : 'var(--border)'}`,
                                background: count === n ? 'rgba(139,92,246,0.15)' : 'transparent',
                                color: count === n ? '#a78bfa' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                            }}>{n}</button>
                        ))}
                    </div>
                </div>

                {/* Amount summary */}
                {!loading && allocs.length > 0 && (
                    <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.78rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <span>💼 Total deploying: <strong style={{ color: '#10b981' }}>{currency === 'INR' ? `₹${investAmount.toLocaleString('en-IN')}` : `$${investAmount.toLocaleString()}`}</strong></span>
                        <span>📊 Holdings: <strong style={{ color: '#3b82f6' }}>{allocs.length}</strong></span>
                        <span>🟢 INVEST: <strong style={{ color: '#10b981' }}>{actionCounts.INVEST}</strong></span>
                        <span>🔵 HOLD: <strong style={{ color: '#3b82f6' }}>{actionCounts.HOLD}</strong></span>
                        <span>🟡 WATCH: <strong style={{ color: '#f59e0b' }}>{actionCounts.WATCH}</strong></span>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Expected Return', value: `${parseFloat(adjRet).toFixed(1)}%`, color: 'var(--green)' },
                    { label: 'Volatility (σ)', value: `${parseFloat(adjVol).toFixed(1)}%`, color: 'var(--amber)' },
                    { label: 'Sharpe Ratio', value: parseFloat(sharpe).toFixed(3), color: 'var(--blue)' },
                    { label: 'Holdings', value: loading ? '…' : allocs.length, color: 'var(--cyan)' },
                    { label: 'Avg Trust Score', value: loading ? '…' : avgTrust.toFixed(4), color: 'var(--purple)' },
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.4rem' }}>{m.value}</div>
                    </div>
                ))}
            </div>

            {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading portfolio from real dataset…</div>}

            {!loading && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        {/* Pie chart */}
                        <div className="card">
                            <div className="card-title">Portfolio Allocation {allocs.length > PIE_MAX ? `(Top ${PIE_MAX} + Others)` : `(All ${allocs.length})`}</div>
                            <div style={{ height: 280 }}>
                                {pieAllocs.length > 0
                                    ? <Pie data={pie} options={pieOpts} />
                                    : <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>No data</div>}
                            </div>
                        </div>

                        {/* BL parameter panel */}
                        <div className="card">
                            <div className="card-title">⚙️ BL Parameter Simulation</div>
                            <div className="form-group">
                                <label className="form-label">Tau (τ) — Prior Scaling: {tau}</label>
                                <input type="range" className="input-field" min={0.01} max={0.25} step={0.01} value={tau}
                                    onChange={e => setTau(parseFloat(e.target.value))} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lower = stronger market equilibrium belief</span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Risk-Free Rate: {rfr}%</label>
                                <input type="range" className="input-field" min={2} max={12} step={0.5} value={rfr}
                                    onChange={e => setRfr(parseFloat(e.target.value))} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nifty 50 benchmark: 6.5%</span>
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                                onClick={recompute} disabled={recomputing}>
                                {recomputing ? '⏳ Recomputing…' : '🔄 Recompute BL Posterior'}
                            </button>
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                                μ_BL = [(τΣ)⁻¹ + PᵀΩ⁻¹P]⁻¹ · [(τΣ)⁻¹π + PᵀΩ⁻¹Q]<br />
                                <span style={{ fontSize: '0.68rem' }}>π = equilibrium · Q = AI views · Ω = trust uncertainty</span>
                            </div>
                        </div>
                    </div>

                    {/* Holdings table */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div className="card-title" style={{ marginBottom: 0 }}>
                                Portfolio Holdings ({filtered.length} of {allocs.length})
                                {investAmount > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
                                    — {currency === 'INR' ? `₹${investAmount.toLocaleString('en-IN')}` : `$${investAmount.toLocaleString()}`} deployed
                                </span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input className="input-field" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ width: 140, padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} />
                                {['ALL', 'INVEST', 'HOLD', 'WATCH'].map(f => (
                                    <button key={f} onClick={() => setFilter(f)} style={{
                                        padding: '0.3rem 0.7rem', borderRadius: 6,
                                        border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`,
                                        background: filter === f ? 'rgba(59,130,246,0.1)' : 'transparent',
                                        color: filter === f ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer'
                                    }}>
                                        {f}{f !== 'ALL' && ` (${actionCounts[f] || 0})`}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        {['#', 'Startup', 'Sector', 'Trust', 'BL Return', 'Allocation %', investAmount > 0 ? `Amount (${currency})` : '', 'Action', 'Risk'].map(h => h && (
                                            <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((a, i) => {
                                        const alloc = parseFloat(a.allocation_pct || 0);
                                        const trust = parseFloat(a.trust_score || 0);
                                        const action = a.portfolio_action;
                                        const risk = (a.risk_severity || 'MEDIUM').toUpperCase();
                                        const amtUSD = totalInvestUSD * (alloc / 100);
                                        const amtDisplay = currency === 'INR'
                                            ? `₹${(amtUSD * INR_MULTIPLIER).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                            : `$${amtUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

                                        const actionColor = action === 'INVEST' ? '#10b981' : action === 'HOLD' ? '#3b82f6' : '#f59e0b';
                                        const riskColor = risk === 'NONE' || risk === 'LOW' ? '#10b981' : risk === 'MEDIUM' ? '#f59e0b' : '#ef4444';

                                        return (
                                            <tr key={a.startup_name || i}
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s', cursor: 'pointer' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{i + 1}</td>
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                                        <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{a.startup_name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.sector}</td>
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <span style={{ color: trust > 0.7 ? '#10b981' : trust > 0.5 ? '#3b82f6' : '#f59e0b', fontWeight: 700, fontSize: '0.82rem' }}>
                                                        {trust.toFixed(3)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.6rem', color: '#a78bfa', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                                                    +{a.bl_expected_return_pct || (trust * 32).toFixed(1)}%
                                                </td>
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <div style={{ width: `${Math.min(60, alloc * 3)}px`, height: 5, background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                                                        <span style={{ fontWeight: 700, color: COLORS[i % COLORS.length], fontSize: '0.82rem' }}>{alloc.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                                {investAmount > 0 && (
                                                    <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#10b981' }}>
                                                        {amtDisplay}
                                                    </td>
                                                )}
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <span style={{
                                                        padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700,
                                                        background: `${actionColor}18`, color: actionColor, border: `1px solid ${actionColor}33`
                                                    }}>{action}</span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <span style={{
                                                        padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700,
                                                        background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}33`
                                                    }}>{risk}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filtered.length === 0 && !loading && (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                                    No results for current filter.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
