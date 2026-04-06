import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';

const SECTORS = ['FinTech', 'EdTech', 'HealthTech', 'SaaS', 'eCommerce', 'AgriTech', 'Logistics', 'AI/ML', 'D2C', 'CleanTech'];

export default function ValuationEngine({ onNav }) {
    const [form, setForm] = useState({
        company_name: '',
        revenue: 5000000,
        funding: 15000000,
        trust: 0.75,
        sentiment: 0.1,
        age: 4,
        webVisits: 800000,
        sector: 'FinTech',
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [topData, setTopData] = useState(null);
    const [searchResult, setSearchResult] = useState(null);
    const [quickSearch, setQuickSearch] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const searching = searchLoading; // alias used in JSX
    const [memoLoading, setMemoLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestRef = useRef(null);

    const downloadMemo = async (name) => {
        setMemoLoading(true);
        try {
            const res = await fetch(`${API}/api/memo`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: name }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `IntelliStake_${name.replace(/\s+/g, '_')}.pdf`;
            a.click(); URL.revokeObjectURL(url);
        } catch (e) { alert(`Memo error: ${e.message}`); }
        finally { setMemoLoading(false); }
    };

    // Load top valuations on mount
    useEffect(() => {
        fetch(`${API}/api/shap`)
            .then(r => r.json())
            .then(d => setTopData(d))
            .catch(() => { });
    }, []);

    // Autocomplete: query /api/search as user types
    useEffect(() => {
        if (!quickSearch.trim() || quickSearch.length < 2) { setSuggestions([]); return; }
        const timer = setTimeout(() => {
            fetch(`${API}/api/search?q=${encodeURIComponent(quickSearch)}&limit=8`)
                .then(r => r.json())
                .then(d => {
                    const results = Array.isArray(d) ? d : (d.results || d.startups || []);
                    setSuggestions(results.slice(0, 8));
                    setShowSuggestions(results.length > 0);
                })
                .catch(() => setSuggestions([]));
        }, 200);
        return () => clearTimeout(timer);
    }, [quickSearch]);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e) => { if (!suggestRef.current?.contains(e.target)) setShowSuggestions(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePredict = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`${API}/api/valuation/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            setResult(d);
        } catch {
            setResult({ error: 'Backend not reachable — start Flask server on port 5500' });
        } finally {
            setLoading(false);
        }
    };

    const doSearch = async (name) => {
        if (!name.trim()) return;
        setSearchLoading(true);
        setSearchResult(null);
        setShowSuggestions(false);
        try {
            const res = await fetch(`${API}/api/valuation/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_name: name }),
            });
            const d = await res.json();
            setSearchResult(d);
        } catch {
            setSearchResult({ error: 'Search failed' });
        } finally {
            setSearchLoading(false);
        }
    };

    const handleQuickSearch = () => doSearch(quickSearch);

    const selectSuggestion = (s) => {
        const name = s.startup_name || s.name || s;
        setQuickSearch(name);
        doSearch(name);
    };

    const topNarratives = topData?.narratives || [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-purple">XGBoost + LightGBM</span>
                        <span className="badge badge-green">R² {topData?.model_r2 || '0.9201'}</span>
                        <span className="badge badge-blue">Stacked Ensemble</span>
                    </div>
                    <div className="page-title">🧠 AI Valuation Engine</div>
                    <div className="page-sub">
                        Stacked ensemble: XGBoost + LightGBM + TabMLP → Ridge meta-learner. Enter startup parameters to get an AI-powered valuation.
                    </div>
                </div>
            </div>

            {/* Quick search */}
            <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }} ref={suggestRef}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                            Quick Lookup — Search any of our 50K real startups
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    value={quickSearch}
                                    onChange={e => { setQuickSearch(e.target.value); setShowSuggestions(true); }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleQuickSearch(); if (e.key === 'Escape') setShowSuggestions(false); }}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    placeholder='Type startup name e.g. "Zepto", "Razorpay", "CRED"…'
                                    style={{ flex: 1, padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.84rem' }}
                                />
                                <button className="btn btn-primary" onClick={handleQuickSearch} disabled={searching} style={{ padding: '0.6rem 1.2rem' }}>
                                    {searching ? '⏳' : '🔍 Search'}
                                </button>
                            </div>
                            {/* Autocomplete suggestions */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                                    background: 'rgba(13,21,37,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(24px)', marginTop: 4, overflow: 'hidden'
                                }}>
                                    {suggestions.map((s, i) => {
                                        const name = s.startup_name || s.name || s;
                                        const sector = s.sector || '';
                                        const trust = s.trust_score ? parseFloat(s.trust_score).toFixed(2) : null;
                                        return (
                                            <div key={i}
                                                onMouseDown={() => selectSuggestion(s)}
                                                style={{
                                                    padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    transition: 'background 0.1s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                                                    {sector && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sector}</div>}
                                                </div>
                                                {trust && <span style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 700 }}>Trust: {trust}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    {searchResult && !searchResult.error && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, minWidth: 280 }}>
                            <div style={{ fontWeight: 800, marginBottom: '0.25rem' }}>{searchResult.company}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                                Source: <span style={{ color: searchResult.data_source === 'verified_market_data' ? 'var(--green)' : 'var(--blue)' }}>
                                    {searchResult.data_source === 'verified_market_data' ? '✓ Verified Market Data' : searchResult.data_source}
                                </span>
                            </div>
                            {searchResult.source_note && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontStyle: 'italic' }}>
                                    {searchResult.source_note}
                                </div>
                            )}
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--green)' }}>
                                ${((searchResult.ensemble_valuation || 0) / 1e9).toFixed(2)}B
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Trust: {searchResult.trust_score?.toFixed?.(3) || 'N/A'} · Risk: {searchResult.risk_severity || 'N/A'}
                            </div>
                            <button
                                onClick={() => downloadMemo(searchResult.company)}
                                disabled={memoLoading}
                                style={{
                                    padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid rgba(244,114,182,0.3)',
                                    background: 'rgba(244,114,182,0.1)', color: '#f472b6', fontSize: '0.72rem',
                                    fontWeight: 700, cursor: memoLoading ? 'not-allowed' : 'pointer', opacity: memoLoading ? 0.6 : 1,
                                }}
                            >{memoLoading ? '⏳ Generating…' : '📄 Download Memo'}</button>
                        </div>
                    )}

                    {searchResult?.error && (
                        <div style={{ padding: '0.75rem', color: 'var(--red)', fontSize: '0.78rem' }}>{searchResult.error}</div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                {/* Input form */}
                <div className="card">
                    <div className="card-title">⚙️ Custom Startup Valuation</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        Not in data lake? Enter parameters manually — all monetary values are in <strong>USD ($)</strong>. Stacked ensemble computes a live valuation.
                    </div>

                    <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Company Name</label>
                        <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                            placeholder="e.g. MyStartup AI"
                            style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        {[
                            { key: 'revenue', label: 'Annual Revenue (USD $)', min: 0, max: 1e9, step: 1e5 },
                            { key: 'funding', label: 'Total Funding (USD $)', min: 0, max: 5e9, step: 1e5 },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{f.label}</label>
                                <input type="number" min={f.min} max={f.max} step={f.step} value={form[f.key]}
                                    onChange={e => setForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                            </div>
                        ))}
                    </div>

                    {[
                        { key: 'trust', label: `Trust Score: ${form.trust}`, min: 0, max: 1, step: 0.01 },
                        { key: 'sentiment', label: `Sentiment (CFS): ${form.sentiment}`, min: -1, max: 1, step: 0.01 },
                        { key: 'age', label: `Company Age: ${form.age} years`, min: 1, max: 20, step: 1 },
                        { key: 'webVisits', label: `Monthly Web Visits: ${form.webVisits.toLocaleString()}`, min: 0, max: 5000000, step: 50000 },
                    ].map(f => (
                        <div key={f.key} style={{ marginBottom: '0.85rem' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{f.label}</label>
                            <input type="range" min={f.min} max={f.max} step={f.step} value={form[f.key]}
                                onChange={e => setForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                                style={{ width: '100%', accentColor: 'var(--blue)' }} />
                        </div>
                    ))}

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Sector</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {SECTORS.map(s => (
                                <button key={s} onClick={() => setForm(p => ({ ...p, sector: s }))}
                                    style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: `1px solid ${form.sector === s ? 'var(--blue)' : 'var(--border)'}`, background: form.sector === s ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', color: form.sector === s ? 'var(--blue)' : 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className="btn btn-primary w-full" onClick={handlePredict} disabled={loading}
                        style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9rem' }}>
                        {loading ? '⏳ Running AI models…' : '🧠 Run Valuation'}
                    </button>
                </div>

                {/* Results */}
                <div>
                    {result && !result.error && (
                        <div className="card" style={{ marginBottom: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Stacked Ensemble Valuation</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--green)', lineHeight: 1 }}>
                                    ${((result.ensemble_valuation || 0) / 1e6).toFixed(2)}M
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                    {result.company} · Source: <span style={{ color: 'var(--blue)' }}>{result.data_source}</span>
                                </div>
                            </div>

                            <div className="card-title">Model Breakdown</div>
                            {[
                                { label: 'XGBoost', value: result.xgb_valuation, color: 'var(--blue)' },
                                { label: 'LightGBM', value: result.lgbm_valuation, color: 'var(--purple)' },
                                { label: 'Ensemble (Meta-Ridge)', value: result.ensemble_valuation, color: 'var(--green)' },
                            ].map(m => {
                                const pct = Math.min(m.value / (result.ensemble_valuation * 1.1) * 100, 100);
                                return (
                                    <div key={m.label} style={{ marginBottom: '0.65rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ fontSize: '0.8rem' }}>{m.label}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: m.color }}>${((m.value || 0) / 1e6).toFixed(2)}M</span>
                                        </div>
                                        <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>R² Score</div>
                                    <div style={{ fontWeight: 800, color: 'var(--green)' }}>{result.r2}</div>
                                </div>
                                <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Trust Score</div>
                                    <div style={{ fontWeight: 800, color: 'var(--blue)' }}>{parseFloat(result.trust_score || form.trust).toFixed(3)}</div>
                                </div>
                                {result.risk_severity && (
                                    <div style={{ flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Risk</div>
                                        <div style={{ fontWeight: 800, color: result.risk_severity === 'HIGH' ? 'var(--red)' : 'var(--amber)' }}>{result.risk_severity}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {result?.error && (
                        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', marginBottom: '1rem' }}>
                            <div style={{ color: 'var(--red)', fontSize: '0.84rem' }}>❌ {result.error}</div>
                        </div>
                    )}

                    {/* Top valuations */}
                    <div className="card">
                        <div className="card-title">🏆 Top AI Valuations (Data Lake)</div>
                        {topNarratives.slice(0, 8).map((n, i) => (
                            <div key={n.startup_name + i} style={{
                                display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0',
                                borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer'
                            }}
                                onClick={() => setQuickSearch(n.startup_name)}
                            >
                                <div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{n.startup_name}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{n.sector}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--green)' }}>
                                        ${((n.predicted_valuation || 0) / 1e6).toFixed(1)}M
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Trust: {parseFloat(n.trust_score || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
