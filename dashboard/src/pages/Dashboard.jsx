import { useAuth, ROLES } from '../context/AuthContext';

const PORTFOLIO_DATA = {
    return: 28.7, vol: 16.2, sharpe: 0.9351, sortino: 1.24, alpha: 12.3, holdings: 10,
};

const DOMAINS = [
    {
        id: 'ai', name: 'AI Intelligence', icon: '🧠', color: '#10b981',
        bg: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)',
        desc: 'Stacked ensemble models, explainability, and anomaly detection',
        tiles: [
            { id: 'valuation', icon: '🧠', name: 'Stacked Valuation', desc: 'XGBoost + LightGBM + TabMLP · R² > 0.93', tag: 'R² 0.93+' },
            { id: 'risk', icon: '🔍', name: 'Risk Auditor', desc: 'R.A.I.S.E. framework · 16-thread live audit', tag: 'Live' },
            { id: 'sentiment', icon: '📡', name: 'Sentiment OSINT', desc: 'FinBERT · live RSS · Contextual Financial Score', tag: 'FinBERT' },
            { id: 'shap', icon: '📊', name: 'SHAP Explainer', desc: 'XGBoost TreeExplainer · waterfall plots · AI narratives', tag: 'XAI' },
            { id: 'hype', icon: '🚨', name: 'Hype Detector', desc: 'Isolation Forest · disconnect ratio analysis', tag: 'ISO Forest' },
        ],
    },
    {
        id: 'finance', name: 'Quantitative Finance', icon: '💼', color: '#3b82f6',
        bg: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.2)',
        desc: 'Portfolio construction, risk simulation, and historical validation',
        tiles: [
            { id: 'portfolio', icon: '💼', name: 'BL Portfolio', desc: 'Black-Litterman · Sharpe 0.9351 · Sortino 1.24', tag: 'S: 0.94' },
            { id: 'montecarlo', icon: '🎲', name: 'Monte Carlo', desc: '10,000 paths · VaR(95%) · CVaR · Efficient Frontier', tag: '10K sims' },
            { id: 'backtest', icon: '📈', name: 'Backtest Engine', desc: '2018→2024 cohort · +12.3% alpha vs Nifty 50', tag: '+α12%' },
        ],
    },
    {
        id: 'blockchain', name: 'Blockchain & Identity', icon: '⛓️', color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.2)',
        desc: 'ERC-3643 smart contracts, oracle integration, and KYC management',
        tiles: [
            { id: 'escrow', icon: '🔐', name: 'Milestone Escrow', desc: '4-tranche ERC-3643 · oracle-triggered freeze at risk < 0.35', tag: 'ERC-3643' },
            { id: 'oracle', icon: '⛓️', name: 'Oracle Bridge', desc: 'Off-chain R.A.I.S.E. trust score → on-chain push', tag: 'Web3' },
            { id: 'kyc', icon: '🪪', name: 'KYC / Identity', desc: 'IdentityRegistry.sol · 1,247 wallets · tiered KYC', tag: 'Compliant' },
        ],
    },
    {
        id: 'genai', name: 'GenAI & Chatbot', icon: '🤖', color: '#f59e0b',
        bg: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)',
        desc: 'Retrieval-augmented generation over your entire data lake',
        tiles: [
            { id: 'chatbot', icon: '🤖', name: 'VC Auditor Chatbot', desc: 'ChromaDB + sentence-transformers + Ollama llama3 · 50K startups', tag: 'RAG' },
        ],
    },
    {
        id: 'data', name: 'Data & System', icon: '🗄️', color: '#64748b',
        bg: 'rgba(100,116,139,0.07)', borderColor: 'rgba(100,116,139,0.2)',
        desc: 'Data lake management, system architecture, and project roadmap',
        tiles: [
            { id: 'datalake', icon: '🗄️', name: 'Data Lake', desc: '4-tier tiered storage · SHA-256 audit manifest · 3.2M data points', tag: '3.2M pts' },
            { id: 'architecture', icon: '🏗️', name: 'Architecture', desc: '6-layer R.A.I.S.E. stack overview', tag: '' },
            { id: 'roadmap', icon: '🗺️', name: 'Roadmap', desc: 'Phase 1–4 progress tracker', tag: '' },
        ],
    },
];

export default function Dashboard({ onNav }) {
    const { user } = useAuth();

    return (
        <div>
            {/* Welcome header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
                            Welcome back, <span className="grad-text">{user?.name?.split(' ')[0] || 'Analyst'}</span> {user?.avatar}
                        </h1>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {ROLES[user?.role]?.label} · KYC: {user?.kyc} · {user?.wallet?.slice(0, 14)}…
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-green">✅ Phase 3 Complete</span>
                        <span className="badge badge-ai">R² 0.93+</span>
                        <span className="badge badge-blockchain">ERC-3643</span>
                    </div>
                </div>
            </div>

            {/* Top metrics */}
            <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '2rem' }}>
                {[
                    { label: 'Portfolio Return', value: `${PORTFOLIO_DATA.return}%`, sub: '2018→2024 CAGR', color: 'var(--green)', trend: '↑ +12.3% vs Nifty' },
                    { label: 'Sharpe Ratio', value: PORTFOLIO_DATA.sharpe, sub: 'Risk-adjusted return', color: 'var(--blue)' },
                    { label: 'Startups Audited', value: '50,000', sub: '3.2M data points', color: 'var(--purple)' },
                    { label: 'Funding Rounds', value: '46,809', sub: 'Real funding data', color: 'var(--amber)' },
                    { label: 'Alpha vs Nifty', value: `+${PORTFOLIO_DATA.alpha}%`, sub: 'Annualised outperformance', color: 'var(--green)', trend: '↑ Strong' },
                ].map(m => (
                    <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{ color: m.color, fontSize: '1.4rem' }}>{m.value}</div>
                        <div className="metric-sub">{m.sub}</div>
                        {m.trend && <div className="metric-trend up">{m.trend}</div>}
                    </div>
                ))}
            </div>

            {/* Domain sections */}
            {DOMAINS.map(domain => (
                <div key={domain.id} className={`domain-section domain-${domain.id}`}>
                    <div className="domain-header">
                        <div className="domain-icon-wrap" style={{ background: domain.bg, color: domain.color, border: `1px solid ${domain.borderColor}` }}>
                            {domain.icon}
                        </div>
                        <div>
                            <div className="domain-name" style={{ color: domain.color }}>{domain.name}</div>
                            <div className="domain-desc">{domain.desc}</div>
                        </div>
                    </div>
                    <div className="feature-tile-grid">
                        {domain.tiles.map(tile => (
                            <div key={tile.id} className="feature-tile" onClick={() => onNav(tile.id)}
                                style={{ borderColor: 'var(--border)' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = domain.borderColor}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span className="feature-tile-icon">{tile.icon}</span>
                                    {tile.tag && <span className="badge" style={{ background: domain.bg, color: domain.color, border: `1px solid ${domain.borderColor}`, fontSize: '0.65rem' }}>{tile.tag}</span>}
                                </div>
                                <div className="feature-tile-name">{tile.name}</div>
                                <div className="feature-tile-desc">{tile.desc}</div>
                                <div className="feature-tile-arrow" style={{ color: domain.color }}>Open →</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
