import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';

function FeatureBar({ feature, value, direction, max = 0.15 }) {
    const pct = Math.min(Math.abs(value) / max * 100, 100);
    const color = direction === 'positive' ? 'var(--green)' : 'var(--red)';
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{feature}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{value > 0 ? '+' : ''}{value.toFixed(4)}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
            </div>
        </div>
    );
}

export default function ShapExplainer({ onNav }) {
    const [data, setData]           = useState(null);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState(0);
    const [search, setSearch]       = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [liveProfile, setLiveProfile]     = useState(null);
    const [liveLoading, setLiveLoading]     = useState(false);
    const debounceRef = useRef(null);

    // Load SHAP narratives (top 500)
    useEffect(() => {
        fetch(`${API}/api/shap`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Debounced search against full dataset when user types
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!search || search.length < 2) {
            setSearchResults([]);
            setLiveProfile(null);
            return;
        }
        debounceRef.current = setTimeout(() => {
            setSearching(true);
            fetch(`${API}/api/search?q=${encodeURIComponent(search)}&limit=12`)
                .then(r => r.json())
                .then(res => {
                    setSearchResults(Array.isArray(res) ? res : (res.results || []));
                    setSearching(false);
                })
                .catch(() => setSearching(false));
        }, 320);
    }, [search]);

    // Fetch full profile for a searched company
    const loadProfile = (name) => {
        setLiveLoading(true);
        setSearch(name);
        setSearchResults([]);
        fetch(`${API}/api/startup/${encodeURIComponent(name)}`)
            .then(r => r.json())
            .then(p => { setLiveProfile(p); setLiveLoading(false); })
            .catch(() => setLiveLoading(false));
    };

    const narratives     = data?.narratives || [];
    const globalFeatures = data?.top_global_features || [];

    // If user has typed and not selected from full-dataset search, filter SHAP 500
    const filtered = search && !liveProfile
        ? narratives.filter(n =>
            n.startup_name?.toLowerCase().includes(search.toLowerCase()) ||
            n.sector?.toLowerCase().includes(search.toLowerCase()))
        : narratives;

    const current = liveProfile || filtered[selected] || filtered[0];

    // Normalise features from both SHAP (features[]) and live profile formats
    const featureList = (() => {
        if (!current) return [];
        // Live profile from /api/startup/:name → features is [{label, value, direction}]
        if (current.features && current.features[0]?.label) return current.features;
        // SHAP narrative from /api/shap → features is [{feature, shap_value, direction}]
        if (current.features) return current.features.map(f => ({
            label: f.feature?.replace(/_/g, ' ') || f.label,
            value: f.shap_value ?? f.value ?? 0,
            direction: f.direction || 'positive',
        }));
        // shap_values dict from raw narrative
        if (current.shap_values) return Object.entries(current.shap_values).map(([k, v]) => ({
            label: k.replace(/_/g, ' '),
            value: v,
            direction: v >= 0 ? 'positive' : 'negative',
        })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8);
        return [];
    })();

    const displayName   = current?.startup_name || '';
    const displayVal    = current?.predicted_valuation || current?.financials?.predicted_valuation_usd || current?.predicted_valuation_usd || 0;
    const displayTrust  = current?.trust_score || 0;
    const displaySector = current?.sector || '';
    const narrative     = current?.narrative_text || current?.narrative || '';
    const isFullShap    = !current?.in_shap_top500 === false || current?.in_shap_top500 !== false;

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-purple">XAI</span>
                        <span className="badge badge-blue">TreeExplainer</span>
                        <span className="badge badge-green">R² {data?.model_r2 || '0.4151'}</span>
                    </div>
                    <div className="page-title">📊 SHAP Explainability Engine</div>
                    <div className="page-sub">
                        Why did the AI give each startup its valuation? Search any of the 107k companies in our dataset.
                    </div>
                </div>
                <div style={{ position: 'relative' }}>
                    <input
                        className="search-input"
                        placeholder="Search any startup or sector…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelected(0); setLiveProfile(null); }}
                        style={{ padding: '0.5rem 0.9rem', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.82rem', width: 260 }}
                    />
                    {/* Live dataset search dropdown */}
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 999,
                            background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border)',
                            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxHeight: 300, overflowY: 'auto'
                        }}>
                            <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                                {searching ? '⏳ Searching…' : `${searchResults.length} results from full dataset`}
                            </div>
                            {searchResults.map((r, i) => (
                                <div key={i}
                                    onClick={() => loadProfile(r.startup_name || r.name)}
                                    style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{r.startup_name || r.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {r.sector} · Trust: {parseFloat(r.trust_score || 0).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    ⏳ Loading SHAP narratives from AI engine…
                </div>
            )}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem' }}>

                    {/* Left: Global Feature Importance + Company list */}
                    <div>
                        <div className="card" style={{ marginBottom: '1rem' }}>
                            <div className="card-title">🌍 Global Feature Importance</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Across all {narratives.length} SHAP-explained startups
                            </div>
                            {globalFeatures.map(f => (
                                <div key={f.feature} style={{ marginBottom: '0.65rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            {f.feature.replace(/_/g, ' ')}
                                        </span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)' }}>
                                            {(f.importance * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${f.importance * 100 / 0.231 * 100}%`, background: 'var(--grad-primary)', borderRadius: 3, transition: 'width 1s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-title">🏢 Startup List ({filtered.length})</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Showing top-500 SHAP-explained · Search above for any of 107k companies
                            </div>
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {filtered.map((n, i) => (
                                    <div key={n.startup_name + i}
                                        onClick={() => { setSelected(i); setLiveProfile(null); setSearch(''); }}
                                        style={{
                                            padding: '0.6rem 0.75rem', cursor: 'pointer', borderRadius: 8,
                                            background: !liveProfile && selected === i ? 'rgba(99,102,241,0.12)' : 'transparent',
                                            border: !liveProfile && selected === i ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                                            marginBottom: '0.3rem', transition: 'all 0.15s'
                                        }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{n.startup_name}</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trust: {parseFloat(n.trust_score || 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{n.sector}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: SHAP waterfall for selected startup */}
                    <div>
                        {liveLoading && (
                            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading profile from dataset…</div>
                            </div>
                        )}
                        {!liveLoading && current ? (
                            <>
                                <div className="card" style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{displayName}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{displaySector}</div>
                                            {current?.in_shap_top500 === false && (
                                                <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.15rem 0.45rem', borderRadius: 5, marginTop: '0.4rem', display: 'inline-block' }}>
                                                    ⚡ Estimated attribution — not in SHAP top-500
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AI Valuation</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green)' }}>
                                                ${(displayVal / 1e6).toFixed(1)}M
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                Trust: {parseFloat(displayTrust || 0).toFixed(3)}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Feature Contributions (SHAP Values)
                                        </div>
                                        {featureList.length > 0
                                            ? featureList.map((f, i) => (
                                                <FeatureBar key={i} feature={f.label || f.feature} value={f.value ?? f.shap_value ?? 0} direction={f.direction} />
                                            ))
                                            : <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No feature data available</div>
                                        }
                                    </div>

                                    {/* Plain-English explanation panel */}
                                    <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.06)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                                            <span style={{ fontSize: '1rem' }}>🧠</span>
                                            <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Why this valuation? — AI Explanation
                                            </div>
                                        </div>

                                        {/* Valuation summary sentence */}
                                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                                            {displayName
                                                ? `The model valued ${displayName} at $${(displayVal / 1e6).toFixed(1)}M because:`
                                                : 'Select a startup to see the explanation.'}
                                        </div>

                                        {/* Bullet explanation from top features */}
                                        {featureList.length > 0 && (
                                            <ul style={{ margin: 0, padding: '0 0 0 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                                {featureList.slice(0, 5).map((f, i) => {
                                                    const name = (f.label || f.feature || '').replace(/_/g, ' ');
                                                    const val  = f.value ?? f.shap_value ?? 0;
                                                    const positive = val >= 0;
                                                    const impact = Math.abs(val) > 0.08 ? 'strongly' : Math.abs(val) > 0.03 ? 'moderately' : 'slightly';
                                                    const direction = positive ? 'increased' : 'decreased';
                                                    return (
                                                        <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                                            <span style={{ color: positive ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                                                {positive ? '▲' : '▼'} {name}
                                                            </span>
                                                            {' '}{impact} {direction} the valuation
                                                            {' '}
                                                            <span style={{ color: positive ? 'var(--green)' : 'var(--red)', fontFamily: 'DM Mono, monospace', fontSize: '0.74rem' }}>
                                                                ({val > 0 ? '+' : ''}{val.toFixed(4)})
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}

                                        {/* Narrative text */}
                                        {narrative && (
                                            <div style={{ marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    Full AI Narrative
                                                </div>
                                                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                                    {narrative}
                                                </div>
                                            </div>
                                        )}

                                        {!narrative && featureList.length === 0 && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No explanation available for this startup.</div>
                                        )}
                                    </div>

                                </div>

                                <div className="card">
                                    <div className="card-title">📐 Model Accuracy Metrics</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                        {[
                                            { label: 'R² Score',            value: data?.model_r2?.toFixed(4) || '0.4151',  color: 'var(--green)' },
                                            { label: 'Median APE',           value: '66.5%',                                  color: 'var(--amber)' },
                                            { label: 'Startups Explained',   value: `${narratives.length} / 107k`,           color: 'var(--blue)' },
                                        ].map(m => (
                                            <div key={m.label} className="kpi-card">
                                                <div className="kpi-label">{m.label}</div>
                                                <div className="kpi-value" style={{ color: m.color, fontSize: '1.2rem' }}>{m.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(16,185,129,0.05)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                        ✅ Stacked Ensemble: XGBoost + LightGBM → Ridge meta-learner · Time-based split (≤2014 / &gt;2014) · 29 features · Leakage-free
                                    </div>
                                </div>
                            </>
                        ) : !liveLoading && (
                            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No matching startups found</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Try searching by company name or sector above</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
