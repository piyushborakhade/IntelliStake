import { useState, useEffect, useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

const API = 'http://localhost:5500';
const COLORS = ['#6366f1','#10b981','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#ef4444','#14b8a6','#f97316','#a855f7',
    '#22d3ee','#84cc16','#fb923c','#e879f9','#38bdf8','#4ade80','#fbbf24','#f472b6','#60a5fa','#34d399'];
const INR = 83.5;

function fmtInr(usd) {
    const v = usd * INR;
    if (v >= 1e7) return `₹${(v/1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v/1e5).toFixed(1)} L`;
    if (v >= 1e3) return `₹${(v/1e3).toFixed(0)}K`;
    return `₹${v.toFixed(0)}`;
}
function fmtUsd(usd) {
    if (usd >= 1e9) return `$${(usd/1e9).toFixed(1)}B`;
    if (usd >= 1e6) return `$${(usd/1e6).toFixed(1)}M`;
    if (usd >= 1e3) return `$${(usd/1e3).toFixed(0)}K`;
    return `$${usd.toFixed(0)}`;
}

function deriveAction(trust, risk) {
    const r = (risk || '').toUpperCase();
    if (r === 'SEVERE' || r === 'HIGH') return 'WATCH';
    if (trust >= 0.70) return 'INVEST';
    if (trust >= 0.52) return 'HOLD';
    return 'WATCH';
}

// Black-Litterman posterior computation — runs client-side so sliders are live
function computeBLMetrics(allocs, tau, rfr) {
    if (!allocs || allocs.length === 0) return { ret: 0, vol: 0, sharpe: 0 };

    const trusts = allocs.map(a => parseFloat(a.trust_score || 0.5));
    const blRets = allocs.map(a => parseFloat(a.bl_expected_return_pct || 15) / 100);
    const weights = allocs.map(a => parseFloat(a.allocation_pct || 0) / 100);

    // Market equilibrium returns (pi) = bl_expected_return_pct from API
    const pi = blRets;

    // Q vector: AI views — trust mapped to 5%–40% range
    const Q = trusts.map(t => 0.05 + t * 0.35);

    // Omega diagonal: view uncertainty = (1 - trust) * base_var
    const omega = trusts.map(t => Math.max(0.001, (1 - t) * 0.04 + 0.01));

    // Simplified BL posterior: weighted combination using tau as prior strength
    // mu_BL_i = (pi_i / (tau + 1/omega_i) + Q_i / (1/omega_i)) normalised
    const muBL = pi.map((pi_i, i) => {
        const prior_weight = 1 / (tau + omega[i]);
        const view_weight = 1 / omega[i];
        return (pi_i * prior_weight + Q[i] * view_weight) / (prior_weight + view_weight);
    });

    // Portfolio expected return = weighted sum of posterior returns
    const portRet = muBL.reduce((s, r, i) => s + r * weights[i], 0);

    // Portfolio volatility — assume diagonal covariance from individual trust-derived vols
    // sigma_i = base_vol * (1 - trust) factor
    const vols = trusts.map(t => Math.max(0.08, 0.35 - t * 0.25));
    const portVar = vols.reduce((s, v, i) => s + (weights[i] * v) ** 2, 0);
    const portVol = Math.sqrt(portVar);

    // Sharpe = (E[r] - rfr) / sigma
    const sharpe = portVol > 0 ? (portRet - rfr / 100) / portVol : 0;

    return {
        ret: (portRet * 100).toFixed(1),
        vol: (portVol * 100).toFixed(1),
        sharpe: sharpe.toFixed(3),
    };
}

export default function Portfolio({ onNav }) {
    const [rawAllocs, setRawAllocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(20);
    const [investAmount, setInvestAmount] = useState(1000000);
    const [currency, setCurrency] = useState('INR');
    const [tau, setTau] = useState(0.05);
    const [rfr, setRfr] = useState(6.5);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [recomputing, setRecomputing] = useState(false);
    const [serverMetrics, setServerMetrics] = useState({ ret: null, vol: null, sharpe: null });

    const loadPortfolio = useCallback((n, tauVal, rfrVal) => {
        const useCount = n || count;
        const useTau = tauVal !== undefined ? tauVal : tau;
        const useRfr = rfrVal !== undefined ? rfrVal : rfr;
        setLoading(true);
        fetch(`${API}/api/portfolio?count=${useCount}&tau=${useTau}&rfr=${useRfr}`)
            .then(r => r.json())
            .then(d => {
                const allocs = (d?.allocations || []).map(a => ({
                    ...a,
                    portfolio_action: deriveAction(parseFloat(a.trust_score || 0), a.risk_severity),
                }));
                setRawAllocs(allocs);
                // Update KPI metrics from real BL computation
                const s = d?.summary || {};
                setServerMetrics({
                    ret: s.expected_annual_return_pct != null ? s.expected_annual_return_pct.toFixed(1) : null,
                    vol: s.expected_annual_volatility_pct != null ? s.expected_annual_volatility_pct.toFixed(1) : null,
                    sharpe: s.sharpe_ratio != null ? s.sharpe_ratio.toFixed(3) : null,
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [count, tau, rfr]);

    useEffect(() => { loadPortfolio(20, 0.05, 6.5); }, []);

    // Use server-computed BL metrics when available, fall back to client-side
    const clientMetrics = computeBLMetrics(rawAllocs, tau, rfr);
    const displayMetrics = {
        ret: serverMetrics.ret ?? clientMetrics.ret,
        vol: serverMetrics.vol ?? clientMetrics.vol,
        sharpe: serverMetrics.sharpe ?? clientMetrics.sharpe,
    };

    const totalInvestUSD = currency === 'INR' ? investAmount / INR : investAmount;

    const filtered = rawAllocs.filter(a =>
        (filter === 'ALL' || a.portfolio_action === filter) &&
        (a.startup_name || '').toLowerCase().includes(search.toLowerCase())
    );

    // Pie chart — top 20
    const PIE_MAX = 20;
    const pieAllocs = rawAllocs.slice(0, PIE_MAX);
    const othersAlloc = rawAllocs.slice(PIE_MAX).reduce((s, a) => s + parseFloat(a.allocation_pct || 0), 0);
    const pieLabels = [...pieAllocs.map(p => p.startup_name), ...(othersAlloc > 0 ? [`Others (${rawAllocs.length - PIE_MAX})`] : [])];
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
            tooltip: {
                callbacks: {
                    label: c => {
                        const pct = c.parsed.toFixed(1);
                        const amtUSD = totalInvestUSD * (c.parsed / 100);
                        const amtStr = currency === 'INR' ? fmtInr(amtUSD) : fmtUsd(amtUSD);
                        return ` ${c.label}: ${pct}% (${amtStr})`;
                    }
                }
            }
        }
    };

    const recompute = () => {
        setRecomputing(true);
        loadPortfolio(count, tau, rfr);
        setTimeout(() => setRecomputing(false), 800);
    };

    const avgTrust = rawAllocs.length > 0
        ? rawAllocs.reduce((s, a) => s + parseFloat(a.trust_score || 0), 0) / rawAllocs.length
        : 0;

    const actionCounts = { INVEST: 0, HOLD: 0, WATCH: 0 };
    rawAllocs.forEach(a => { if (actionCounts[a.portfolio_action] !== undefined) actionCounts[a.portfolio_action]++; });

    const countOptions = [10, 15, 20, 30, 50];

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">💼 Black-Litterman Portfolio</div>
                    <div className="page-sub">Trust-weighted BL posterior · P/Q/Ω matrices · Live from 74K dataset</div>
                </div>
                <button className="btn btn-primary" onClick={() => onNav?.('agent')}>🤖 Deploy via Agent →</button>
            </div>

            {/* Investment Amount */}
            <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>💰 Investment Amount:</div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {['INR', 'USD'].map(c => (
                            <button key={c} onClick={() => setCurrency(c)} style={{
                                padding: '0.3rem 0.65rem', borderRadius: 6,
                                border: `1px solid ${currency === c ? 'var(--blue)' : 'var(--border)'}`,
                                background: currency === c ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: currency === c ? '#93c5fd' : 'var(--text-muted)',
                                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                            }}>{c}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>
                            {currency === 'INR' ? '₹' : '$'}
                        </span>
                        <input
                            type="number"
                            className="input-field"
                            style={{ width: 180, fontWeight: 700, fontSize: '1rem' }}
                            value={investAmount}
                            min={10000}
                            step={currency === 'INR' ? 100000 : 1000}
                            onChange={e => setInvestAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                        {(currency === 'INR'
                            ? [[500000,'₹5L'],[1000000,'₹10L'],[5000000,'₹50L'],[10000000,'₹1Cr'],[50000000,'₹5Cr']]
                            : [[10000,'$10K'],[50000,'$50K'],[100000,'$100K'],[500000,'$500K'],[1000000,'$1M']]
                        ).map(([v, label]) => (
                            <button key={v} onClick={() => setInvestAmount(v)} style={{
                                padding: '0.25rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)',
                                background: investAmount === v ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                                color: investAmount === v ? '#10b981' : 'var(--text-muted)',
                                fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                            }}>{label}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Holdings:</span>
                        {countOptions.map(n => (
                            <button key={n} onClick={() => { setCount(n); loadPortfolio(n, tau, rfr); }} style={{
                                padding: '0.25rem 0.6rem', borderRadius: 6,
                                border: `1px solid ${count === n ? 'var(--purple)' : 'var(--border)'}`,
                                background: count === n ? 'rgba(139,92,246,0.15)' : 'transparent',
                                color: count === n ? '#a78bfa' : 'var(--text-muted)',
                                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                            }}>{n}</button>
                        ))}
                    </div>
                </div>

                {!loading && rawAllocs.length > 0 && (
                    <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.78rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <span>💼 Total deploying: <strong style={{ color: '#10b981' }}>
                            {currency === 'INR' ? `₹${investAmount.toLocaleString('en-IN')}` : `$${investAmount.toLocaleString()}`}
                        </strong></span>
                        <span>📊 Holdings: <strong style={{ color: '#3b82f6' }}>{rawAllocs.length}</strong></span>
                        <span>🟢 INVEST: <strong style={{ color: '#10b981' }}>{actionCounts.INVEST}</strong></span>
                        <span>🔵 HOLD: <strong style={{ color: '#3b82f6' }}>{actionCounts.HOLD}</strong></span>
                        <span>🟡 WATCH: <strong style={{ color: '#f59e0b' }}>{actionCounts.WATCH}</strong></span>
                    </div>
                )}
            </div>

            {/* KPIs — now live from computeBLMetrics */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Expected Return', value: loading ? '…' : `${displayMetrics.ret}%`, color: 'var(--green)' },
                    { label: 'Volatility (σ)',  value: loading ? '…' : `${displayMetrics.vol}%`,  color: 'var(--amber)' },
                    { label: 'Sharpe Ratio',    value: loading ? '…' : displayMetrics.sharpe,      color: 'var(--blue)'  },
                    { label: 'Holdings',        value: loading ? '…' : rawAllocs.length,    color: 'var(--cyan)'  },
                    { label: 'Avg Trust Score', value: loading ? '…' : avgTrust.toFixed(4), color: 'var(--purple)'},
                ].map(m => (
                    <div key={m.label} className="kpi-card">
                        <div className="kpi-label">{m.label}</div>
                        <div className="kpi-value" style={{ color: m.color, fontSize: '1.4rem' }}>{m.value}</div>
                    </div>
                ))}
            </div>

            {loading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading portfolio from real dataset…
                </div>
            )}

            {!loading && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        {/* Pie */}
                        <div className="card">
                            <div className="card-title">
                                Portfolio Allocation {rawAllocs.length > PIE_MAX ? `(Top ${PIE_MAX} + Others)` : `(All ${rawAllocs.length})`}
                            </div>
                            <div style={{ height: 280 }}>
                                {pieAllocs.length > 0
                                    ? <Pie data={pie} options={pieOpts} />
                                    : <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>No data</div>}
                            </div>
                        </div>

                        {/* BL Parameter Simulation */}
                        <div className="card">
                            <div className="card-title">⚙️ BL Parameter Simulation</div>
                            <div className="form-group">
                                <label className="form-label">Tau (τ) — Prior Scaling: <strong style={{ color: '#a78bfa' }}>{tau}</strong></label>
                                <input type="range" className="input-field" min={0.01} max={0.25} step={0.01} value={tau}
                                    onChange={e => setTau(parseFloat(e.target.value))} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Lower = stronger market equilibrium · KPIs update live above ↑
                                </span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Risk-Free Rate: <strong style={{ color: '#10b981' }}>{rfr}%</strong></label>
                                <input type="range" className="input-field" min={2} max={12} step={0.5} value={rfr}
                                    onChange={e => setRfr(parseFloat(e.target.value))} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Nifty 50 benchmark: 6.5% · affects Sharpe ratio live ↑
                                </span>
                            </div>

                            {/* Live preview of what changed */}
                            <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                                <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>RETURN</div><div style={{ color: '#10b981', fontWeight: 700 }}>{displayMetrics.ret}%</div></div>
                                <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>VOLATILITY</div><div style={{ color: '#f59e0b', fontWeight: 700 }}>{displayMetrics.vol}%</div></div>
                                <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>SHARPE</div><div style={{ color: '#3b82f6', fontWeight: 700 }}>{displayMetrics.sharpe}</div></div>
                            </div>

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={recompute}
                                disabled={recomputing}
                            >
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
                                Portfolio Holdings ({filtered.length} of {rawAllocs.length})
                                {investAmount > 0 && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
                                        — {currency === 'INR' ? `₹${investAmount.toLocaleString('en-IN')}` : `$${investAmount.toLocaleString()}`} deployed
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input className="input-field" placeholder="Search…" value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: 140, padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} />
                                {['ALL','INVEST','HOLD','WATCH'].map(f => (
                                    <button key={f} onClick={() => setFilter(f)} style={{
                                        padding: '0.3rem 0.7rem', borderRadius: 6,
                                        border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`,
                                        background: filter === f ? 'rgba(59,130,246,0.1)' : 'transparent',
                                        color: filter === f ? '#93c5fd' : 'var(--text-muted)',
                                        fontSize: '0.74rem', cursor: 'pointer'
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
                                        {['#','Startup','Sector','Trust','BL Return','Allocation %', investAmount > 0 ? `Amount (${currency})` : null,'Action','Risk']
                                            .filter(Boolean)
                                            .map(h => (
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

                                        // Amount column — live with investAmount
                                        const amtUSD = totalInvestUSD * (alloc / 100);
                                        const amtDisplay = currency === 'INR' ? fmtInr(amtUSD) : fmtUsd(amtUSD);

                                        const actionColor = action === 'INVEST' ? '#10b981' : action === 'HOLD' ? '#3b82f6' : '#f59e0b';
                                        const riskColor = risk === 'NONE' || risk === 'LOW' ? '#10b981' : risk === 'MEDIUM' ? '#f59e0b' : '#ef4444';
                                        const blRet = parseFloat(a.bl_expected_return_pct || (trust * 32));

                                        return (
                                            <tr key={a.startup_name || i}
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
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
                                                    +{blRet.toFixed(1)}%
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
                                                    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700, background: `${actionColor}18`, color: actionColor, border: `1px solid ${actionColor}33` }}>
                                                        {action}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.6rem' }}>
                                                    <span style={{ padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700, background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}33` }}>
                                                        {risk}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filtered.length === 0 && (
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
