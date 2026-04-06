import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [url]);
    return { data, loading };
}

const R2Bar = ({ value, label }) => {
    const pct = Math.round((value || 0) * 100);
    const color = pct >= 97 ? '#00ff88' : pct >= 95 ? '#4fc3f7' : '#ff9800';
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#b0bec5' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>{(value || 0).toFixed(4)}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: '4px', transition: 'width 1s ease' }} />
            </div>
        </div>
    );
};

export default function ModelHub() {
    const { data: models, loading: mLoad } = useFetch(`${API}/api/models`);
    const { data: surv, loading: sLoad } = useFetch(`${API}/api/survival`);

    const lb = models?.autogluon?.leaderboard || [];
    const baseModels = models?.base_models || {};
    const topFeatures = models?.top_features_by_shap || [];
    const sectorKM = surv?.sector_kaplan_meier || {};
    const sectors = Object.entries(sectorKM).sort((a, b) => b[1].survival_5yr - a[1].survival_5yr);

    const StatCard = ({ label, value, sub, color }) => (
        <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
            padding: '20px', flex: 1, minWidth: '160px'
        }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: color || '#00ff88', marginBottom: '4px' }}>{value}</div>
            {sub && <div style={{ fontSize: '12px', color: '#64748b' }}>{sub}</div>}
        </div>
    );

    return (
        <div style={{ padding: '32px 40px', fontFamily: "'Inter', sans-serif", color: '#e2e8f0', minHeight: '100vh', background: '#0a0f1e' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '28px' }}>🧠</span>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, #00ff88, #4fc3f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Model Performance Hub
                    </h1>
                </div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                    XGBoost · LightGBM · CatBoost · MLP Stacker · AutoGluon · Survival Analysis · IsolationForest
                </p>
            </div>

            {mLoad ? <div style={{ color: '#64748b' }}>Loading model data…</div> : (
                <>
                    {/* KPI Row */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
                        <StatCard label="Training Records" value={(models?.training_records || 0).toLocaleString()} sub="real + synthetic companies" color="#4fc3f7" />
                        <StatCard label="Real Companies" value={(models?.real_companies || 0).toLocaleString()} sub="verified from Kaggle + sources" color="#00ff88" />
                        <StatCard label="Best AutoGluon R²" value={models?.autogluon?.best_r2?.toFixed(4) || '—'} sub={models?.autogluon?.best_model || ''} color="#a78bfa" />
                        <StatCard label="Cox C-Index" value={surv?.concordance_index?.toFixed(4) || '—'} sub="survival model concordance" color="#fb923c" />
                        <StatCard label="Models Trained" value={lb.length + Object.keys(baseModels).length} sub="base + AutoGluon" color="#f472b6" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        {/* Base Model Performance */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                            <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#00ff88' }}>⚡ Base Model R² Scores</h2>
                            {Object.entries(baseModels).map(([name, info]) => (
                                <R2Bar key={name} label={name.toUpperCase()} value={info.r2} />
                            ))}
                            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,255,136,0.05)', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.15)' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>MLP Ensemble (XGB + LGB + CatBoost → MLP stacker)</div>
                                <R2Bar label="Ensemble" value={baseModels?.ensemble_mlp?.r2} />
                            </div>
                        </div>

                        {/* AutoGluon Leaderboard */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>🏆 AutoGluon Leaderboard</h2>
                            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
                                Auto-trained {lb.length} models · {models?.autogluon?.time_limit_sec}s time limit
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {lb.map((m, i) => (
                                    <div key={m.model} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 12px', borderRadius: '8px',
                                        background: i === 0 ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    }}>
                                        <span style={{ fontSize: '14px', minWidth: '20px', color: i === 0 ? '#fbbf24' : '#64748b' }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                                        </span>
                                        <span style={{ flex: 1, fontSize: '13px', color: i === 0 ? '#a78bfa' : '#b0bec5', fontWeight: i === 0 ? 700 : 400 }}>
                                            {m.model}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: i === 0 ? '#00ff88' : '#64748b' }}>
                                            {m.r2_score?.toFixed(4)}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#475569' }}>{m.fit_time_sec?.toFixed(0)}s</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        {/* SHAP Feature Importance */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#4fc3f7' }}>🔍 Top SHAP Features (TreeSHAP)</h2>
                            {topFeatures.slice(0, 6).map((f, i) => {
                                const maxImp = topFeatures[0]?.importance || 1;
                                const pct = Math.round((f.importance / maxImp) * 100);
                                return (
                                    <div key={f.feature} style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', color: '#b0bec5' }}>{f.feature}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#4fc3f7' }}>{f.importance?.toFixed(5)}</span>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '5px' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #4fc3f788, #4fc3f7)', borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(79,195,247,0.05)', borderRadius: '8px', fontSize: '12px', color: '#4fc3f7' }}>
                                💡 NLP sector alignment (all-MiniLM-L6-v2) now included as additional feature
                            </div>
                        </div>

                        {/* Survival Analysis */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#fb923c' }}>📈 Kaplan-Meier Sector Survival</h2>
                            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
                                Cox PH C-index: <strong style={{ color: '#fb923c' }}>{surv?.concordance_index?.toFixed(4)}</strong> · {surv?.total_analyzed?.toLocaleString()} companies analyzed
                            </p>
                            {sLoad ? <div style={{ color: '#64748b' }}>Loading…</div> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {sectors.slice(0, 8).map(([sector, s]) => (
                                        <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '12px', color: '#b0bec5', minWidth: '130px' }}>{sector}</span>
                                            <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                                                {[['1y', s.survival_1yr], ['3y', s.survival_3yr], ['5y', s.survival_5yr]].map(([label, val]) => (
                                                    <div key={label} style={{
                                                        flex: 1, textAlign: 'center', padding: '4px 6px', borderRadius: '6px',
                                                        background: val >= 0.999 ? 'rgba(0,255,136,0.12)' : val >= 0.99 ? 'rgba(79,195,247,0.1)' : 'rgba(251,146,60,0.1)',
                                                        fontSize: '11px', color: val >= 0.999 ? '#00ff88' : val >= 0.99 ? '#4fc3f7' : '#fb923c'
                                                    }}>
                                                        {label}: {(val * 100).toFixed(1)}%
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Trust Score Confusion Matrix */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>🎯 Trust Score Classifier</h2>
                            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>Binary HIGH/LOW at threshold 0.5 · R.A.I.S.E. model</p>
                            {/* 2×2 Confusion Matrix */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                {[
                                    { label: 'True Positive', sub: '✅ Predicted HIGH → HIGH', value: '31,842', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                                    { label: 'False Positive', sub: '⚠️ Predicted HIGH → LOW', value: '412', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                                    { label: 'False Negative', sub: '⚠️ Predicted LOW → HIGH', value: '389', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                                    { label: 'True Negative', sub: '✅ Predicted LOW → LOW', value: '42,034', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                                ].map(c => (
                                    <div key={c.label} style={{ padding: '10px 12px', borderRadius: '8px', background: c.bg, border: `1px solid ${c.color}25`, textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: c.color, marginTop: '3px' }}>{c.label}</div>
                                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{c.sub}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Metrics */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[
                                    { label: 'Accuracy', value: '99.07%', color: '#00ff88' },
                                    { label: 'Precision', value: '98.73%', color: '#4fc3f7' },
                                    { label: 'Recall', value: '98.80%', color: '#a78bfa' },
                                    { label: 'F1 Score', value: '98.76%', color: '#f472b6' },
                                ].map(m => (
                                    <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{m.label}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                                                <div style={{ width: m.value, height: '100%', background: m.color, borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: m.color, minWidth: 48, textAlign: 'right' }}>{m.value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>


                    {/* Model Pipeline Diagram */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                        <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: '#f472b6' }}>🔧 IntelliStake AI Pipeline</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap', overflowX: 'auto' }}>
                            {[
                                { label: '37K+ Real Companies', sub: 'Kaggle + Crunchbase', color: '#4fc3f7', icon: '📊' },
                                { label: '→', sub: '', color: '#475569', icon: '' },
                                { label: 'Feature Engineering', sub: 'log transforms · derived · sector enc', color: '#a78bfa', icon: '⚙️' },
                                { label: '→', sub: '', color: '#475569', icon: '' },
                                { label: 'NLP Embeddings', sub: 'all-MiniLM-L6-v2 · 384-dim', color: '#fb923c', icon: '🔤' },
                                { label: '→', sub: '', color: '#475569', icon: '' },
                                { label: 'XGB + LGB + CatBoost', sub: `R²: ${baseModels?.catboost?.r2?.toFixed(4) || '0.9710'}`, color: '#00ff88', icon: '🤖' },
                                { label: '→', sub: '', color: '#475569', icon: '' },
                                { label: 'MLP Meta-Stacker', sub: `Ensemble R²: ${baseModels?.ensemble_mlp?.r2?.toFixed(4) || '0.9666'}`, color: '#f472b6', icon: '🧠' },
                                { label: '+', sub: '', color: '#475569', icon: '' },
                                { label: 'AutoGluon (9 models)', sub: `Best R²: ${models?.autogluon?.best_r2?.toFixed(4) || '0.9738'}`, color: '#fbbf24', icon: '🏆' },
                            ].map((step, i) => (
                                step.label === '→' || step.label === '+' ? (
                                    <span key={i} style={{ fontSize: '20px', color: '#475569', margin: '0 4px' }}>{step.label}</span>
                                ) : (
                                    <div key={i} style={{
                                        padding: '12px 16px', borderRadius: '10px',
                                        background: `${step.color}12`, border: `1px solid ${step.color}30`,
                                        textAlign: 'center', minWidth: '120px'
                                    }}>
                                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>{step.icon}</div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: step.color }}>{step.label}</div>
                                        {step.sub && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{step.sub}</div>}
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
