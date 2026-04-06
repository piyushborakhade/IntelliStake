import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

const PHASE_ITEMS = [
    {
        phase: 'Phase 1 — Data Engineering',
        status: 'COMPLETE',
        color: 'var(--green)',
        pct: 100,
        items: [
            { name: 'Startup Data Collection', detail: '50K+ startups from OSINT sources' },
            { name: 'Funding Rounds Dataset', detail: '46,809 real Indian startup rounds' },
            { name: 'GitHub Velocity Analysis', detail: 'Commits, stars, issues tracked' },
            { name: 'Risk Signal Ingestion', detail: 'MCA, news, regulatory flags' },
            { name: '4-Tier Data Lake', detail: 'Raw → Cleaned → Outputs → Production' },
        ],
    },
    {
        phase: 'Phase 2 — AI + Finance + Blockchain',
        status: 'COMPLETE',
        color: 'var(--blue)',
        pct: 100,
        items: [
            { name: 'Stacked Ensemble Model', detail: 'XGBoost + LightGBM + TabMLP · R²0.9201' },
            { name: 'FinBERT Sentiment', detail: 'ProsusAI/finbert transformer scoring' },
            { name: 'SHAP Explainability', detail: 'XAI narratives for every startup' },
            { name: 'Black-Litterman Portfolio', detail: 'Sharpe 0.9351 · Sortino 1.24' },
            { name: 'Blockchain Contracts', detail: '3 Solidity contracts deployed' },
        ],
    },
    {
        phase: 'Phase 3 — Production Dashboard',
        status: 'COMPLETE',
        color: 'var(--purple)',
        pct: 100,
        items: [
            { name: 'React Dashboard', detail: '22 pages · React Router v6 · URL routing' },
            { name: 'Live Flask API', detail: '1,400+ lines · 16+ endpoints' },
            { name: 'Monte Carlo + Backtest', detail: 'VaR/CVaR · 2018→2024 alpha proof' },
            { name: 'AgentVault', detail: 'Autonomous investment agent + deposit modal' },
            { name: 'RAG Chatbot', detail: 'ChromaDB + Ollama llama3 optional' },
        ],
    },
    {
        phase: 'Phase 4 — Submission Package',
        status: 'IN PROGRESS',
        color: 'var(--amber)',
        pct: 15,
        items: [
            { name: 'Investment Memo PDFs', detail: 'Top 5 portfolio startups · reportlab' },
            { name: 'Research Paper (12 pages)', detail: 'Academic format · All results cited' },
            { name: 'DAO Governance Contract', detail: 'IntelliStakeDAO.sol · 48h voting' },
            { name: 'Hardhat Deployment', detail: 'Real on-chain TXs · testnet' },
            { name: 'Demo Video (8 min)', detail: 'End-to-end platform walkthrough' },
        ],
    },
];

const DOMAIN_CARDS = [
    {
        title: '🧠 AI Domain',
        color: 'var(--blue)',
        stack: ['XGBoost + LightGBM + TabMLP (stacked)', 'R²0.9201 · 5-Fold Cross-Validation', 'SHAP XAI · Isolation Forest', 'FinBERT (ProsusAI) transformer', 'Live valuation prediction API'],
    },
    {
        title: '💼 Finance Domain',
        color: 'var(--purple)',
        stack: ['Black-Litterman P/Q/Ω matrices', 'Sharpe 0.9351 · Sortino 1.24', 'Monte Carlo VaR/CVaR (1000 paths)', 'Historical backtest 2018→2024', 'Efficient Frontier · 4 risk ratios'],
    },
    {
        title: '⛓️ Blockchain Domain',
        color: 'var(--green)',
        stack: ['MilestoneEscrow.sol (4-tranche)', 'IdentityRegistry.sol (ERC-3643)', 'TrustOracle.sol (Chainlink-style)', 'AgentVault.sol (autonomous)', 'IntelliStakeDAO.sol (governance)'],
    },
    {
        title: '🤖 GenAI Domain',
        color: 'var(--amber)',
        stack: ['RAG chatbot (ChromaDB)', 'Optional: Ollama llama3 enrichment', 'Intent detection (15+ patterns)', 'OSINT daemon (GitHub + RSS)', 'Company Intelligence (11 models)'],
    },
];

export default function Roadmap({ onNav }) {
    const [status, setStatus] = useState(null);

    useEffect(() => {
        fetch(`${API}/api/status`)
            .then(r => r.json())
            .then(d => setStatus(d))
            .catch(() => { });
    }, []);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-green">Phase 3 Complete</span>
                        <span className="badge badge-amber">Phase 4 In Progress</span>
                        <span className="badge badge-blue">NMIMS MCA 2025-26</span>
                    </div>
                    <div className="page-title">🗺️ Project Roadmap</div>
                    <div className="page-sub">
                        4-phase development roadmap · Live completion tracking · IntelliStake v3.0
                    </div>
                </div>
            </div>

            {/* Phase progress grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {PHASE_ITEMS.map(p => (
                    <div key={p.phase} className="card" style={{ borderColor: `${p.color}30` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: p.color, lineHeight: 1.3, flex: 1, marginRight: '0.5rem' }}>{p.phase}</div>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 4,
                                background: p.status === 'COMPLETE' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                color: p.status === 'COMPLETE' ? 'var(--green)' : 'var(--amber)', flexShrink: 0
                            }}>
                                {p.status}
                            </span>
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.85rem' }}>
                            <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>

                        {p.items.map(item => (
                            <div key={item.name} style={{ marginBottom: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ color: p.pct === 100 ? 'var(--green)' : 'var(--amber)', fontSize: '0.65rem', flexShrink: 0 }}>
                                        {p.pct === 100 ? '✓' : '›'}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{item.name}</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '1rem', marginTop: '0.1rem' }}>{item.detail}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Domain architecture cards */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-title">🏗️ 4-Domain Technology Stack</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '1rem' }}>
                    {DOMAIN_CARDS.map(d => (
                        <div key={d.title} style={{ padding: '1rem', background: `${d.color}06`, border: `1px solid ${d.color}25`, borderRadius: 12 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: d.color, marginBottom: '0.65rem' }}>{d.title}</div>
                            {d.stack.map(s => (
                                <div key={s} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.18rem 0', display: 'flex', gap: '0.35rem' }}>
                                    <span style={{ color: d.color }}>▸</span>{s}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Live API status */}
            {status && (
                <div className="card">
                    <div className="card-title">📡 Live System Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '0.75rem' }}>
                        {[
                            { label: 'Startups loaded', value: status.data?.startups?.toLocaleString(), color: 'var(--blue)' },
                            { label: 'Funding rounds', value: status.data?.funding?.toLocaleString(), color: 'var(--purple)' },
                            { label: 'KYC investors', value: status.data?.investors?.toLocaleString(), color: 'var(--green)' },
                            { label: 'Portfolio holdings', value: status.data?.portfolio, color: 'var(--cyan)' },
                            { label: 'Hype flags', value: status.data?.hype_flags, color: 'var(--amber)' },
                            { label: 'SHAP narratives', value: status.data?.shap, color: 'var(--text-muted)' },
                        ].map(m => (
                            <div key={m.label} className="metric-card">
                                <div className="metric-label">{m.label}</div>
                                <div className="metric-value" style={{ color: m.color, fontSize: '1.1rem' }}>{m.value ?? '…'}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(16,185,129,0.05)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ✅ API: <strong style={{ color: 'var(--green)' }}>{status.status}</strong> · Ollama: {status.ollama?.running ? <strong style={{ color: 'var(--green)' }}>Running ({status.ollama.models?.[0]})</strong> : <span style={{ color: 'var(--red)' }}>Not running (direct mode)</span>}
                    </div>
                </div>
            )}
        </div>
    );
}
