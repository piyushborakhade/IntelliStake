import { useState, useRef } from 'react';

const API = 'http://localhost:5500';

const DEMO_COMPANIES = [
    'Zepto', 'Razorpay', 'CRED', 'Meesho', 'PhonePe',
    'Swiggy', 'Zomato', 'Byju', 'Groww', 'Ola Electric',
    'Urban Company', 'Infra.Market', 'Khatabook', 'MobiKwik',
];

export default function MemoGenerator({ onNav }) {
    const [company, setCompany] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [generated, setGenerated] = useState([]);
    const inputRef = useRef();

    const generate = async (name) => {
        const target = name || company.trim();
        if (!target) return;
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`${API}/api/memo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: target }),
            });
            if (!res.ok) {
                const j = await res.json();
                if (j.fix) {
                    setError(`${j.error} — Fix: ${j.fix}`);
                } else {
                    setError(j.error || 'Generation failed');
                }
                return;
            }
            // Download the PDF
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `IntelliStake_Memo_${target.replace(/\s+/g, '_')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);

            const now = new Date().toLocaleTimeString('en-IN');
            setGenerated(prev => [{ name: target, time: now }, ...prev.slice(0, 9)]);
            setSuccess(`✅ Investment Memo for "${target}" downloaded!`);
            setCompany('');
        } catch (e) {
            setError('Flask API not reachable — is the server running on port 5500?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">AI Generated</span>
                        <span className="badge badge-purple">reportlab PDF</span>
                        <span className="badge badge-green">SHAP + RAISE</span>
                    </div>
                    <div className="page-title">📄 Investment Memo Generator</div>
                    <div className="page-sub">
                        Generate a 2-page, VC-grade Due Diligence PDF for any startup — with Spider Chart, SHAP analysis, and Blockchain Kill Switch clause.
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.25rem' }}>

                {/* Left — Generator */}
                <div>
                    {/* Search input */}
                    <div className="card" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-title">🔍 Generate Memo</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Enter any startup name from the 74,577-company knowledge graph.
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            <input
                                ref={inputRef}
                                value={company}
                                onChange={e => setCompany(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && generate()}
                                placeholder="e.g. Zepto, Razorpay, CRED…"
                                style={{
                                    flex: 1, padding: '0.65rem 1rem',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8, color: 'var(--text-primary)',
                                    fontSize: '0.88rem',
                                }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => generate()}
                                disabled={loading || !company.trim()}
                                style={{ minWidth: 140, justifyContent: 'center' }}
                            >
                                {loading ? '⏳ Generating…' : '📄 Generate PDF'}
                            </button>
                        </div>

                        {success && (
                            <div style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, color: 'var(--green)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                {success}
                            </div>
                        )}
                        {error && (
                            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: 'var(--red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                ❌ {error}
                            </div>
                        )}

                        {/* Quick picks */}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Quick picks:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {DEMO_COMPANIES.map(c => (
                                <button
                                    key={c}
                                    onClick={() => generate(c)}
                                    disabled={loading}
                                    style={{
                                        padding: '0.3rem 0.7rem',
                                        background: 'rgba(59,130,246,0.08)',
                                        border: '1px solid rgba(59,130,246,0.25)',
                                        borderRadius: 6, color: 'var(--blue)',
                                        fontSize: '0.72rem', cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.18)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recent generations */}
                    {generated.length > 0 && (
                        <div className="card">
                            <div className="card-title">📋 Recent Memos</div>
                            {generated.map((g, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.55rem 0', borderBottom: '1px solid var(--border)',
                                    fontSize: '0.8rem',
                                }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>📄 {g.name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{g.time}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right — What's inside */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                        {
                            icon: '📋', title: 'Executive Summary', color: '#3b82f6',
                            desc: 'Auto-generated from live data: trust score, funding, valuation, survival probability, and sector context.',
                        },
                        {
                            icon: '🕸️', title: 'AI Risk Radar (Spider Chart)', color: '#8b5cf6',
                            desc: '6-axis radar chart covering GitHub Velocity, FinBERT Sentiment, Funding, 5-yr Survival, Trust Score, and Revenue.',
                        },
                        {
                            icon: '🔍', title: 'SHAP Explainability', color: '#10b981',
                            desc: '"Why did the AI give this valuation?" — Top 5 features with their SHAP contribution values and direction.',
                        },
                        {
                            icon: '🚨', title: 'Hype Anomaly Check', color: '#f59e0b',
                            desc: 'Isolation Forest classification: LEGITIMATE / HYPE_ANOMALY / STAGNANT with disconnect ratio.',
                        },
                        {
                            icon: '⛓️', title: 'Blockchain Kill Switch', color: '#ef4444',
                            desc: 'MilestoneEscrow.sol 4-tranche table + TrustOracle freeze advisory if trust < 0.35.',
                        },
                        {
                            icon: '⚖️', title: 'Analyst Verdict', color: '#06b6d4',
                            desc: 'AI-generated verdict: WATCHLIST / CAUTION / NEUTRAL with key supporting factors.',
                        },
                    ].map(s => (
                        <div key={s.title} style={{
                            padding: '0.85rem 1rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                        }}>
                            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{s.icon}</span>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: s.color, marginBottom: '0.2rem' }}>{s.title}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                            </div>
                        </div>
                    ))}

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        💡 <strong style={{ color: '#f59e0b' }}>Viva tip:</strong> Print 5 copies of the top portfolio companies. Hand one to each professor — it's the only capstone that gives professors something to take home.
                    </div>
                </div>
            </div>
        </div>
    );
}
