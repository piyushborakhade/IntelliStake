export default function Architecture() {
    const LAYERS = [
        {
            label: 'Data Ingestion', color: 'ai',
            items: ['MCA Filings API', 'GitHub REST API v3', 'SimilarWeb Scraper', 'RSS News Feeds', 'LinkedIn Pedigree Parser'],
        },
        {
            label: 'Data Scaling Engine', color: 'ai',
            items: ['Dask Parallel Processor (IO + CPU)', 'Entity Fuzzy Matching (88 threshold)', 'Sentiment Harvester', 'Master Knowledge Graph (3.2M nodes)', 'GitHub Rate-Limit Controller (Burst=30)'],
        },
        {
            label: 'R.A.I.S.E Engine', color: 'ai',
            items: ['Valuation Engine v2 (XGB+LGB Ensemble)', 'Risk Auditor v2 (16-thread parallel, cached)', 'Portfolio Optimizer v2 (BL Posterior + Sharpe)', 'Live Audit Agent (parallel RSS, retry, pooled)'],
        },
        {
            label: 'Finance Layer', color: 'finance',
            items: ['Black-Litterman Portfolio (τ=0.05, P/Q/Ω)', 'Sharpe + Sortino Ratio Calculator', 'Monte Carlo Stress Tester (10k paths)', 'Sector Cap (35%) + Country Cap (60%)'],
        },
        {
            label: 'Blockchain Layer', color: 'blockchain',
            items: ['ERC-3643 Security Token (T-REX)', 'MilestoneEscrow.sol (4-tranche)', 'TrustOracle.sol (Chainlink-style)', 'ComplianceRegistry.sol (KYC + Whitelist)', 'Hardhat + ethers.js + OpenZeppelin'],
        },
        {
            label: 'Dashboard', color: 'ai',
            items: ['Vite + React 19', 'Chart.js (Bar, Pie, Line)', 'Interactive sliders, simulators', 'Live VADER analyzer', 'Real-time oracle simulator'],
        },
    ];

    return (
        <div className="page fade-in">
            <div className="page-header">
                <div className="badge badge-ai mb-2">System · Architecture</div>
                <h1 className="page-title">🏗️ System Architecture</h1>
                <p className="page-desc">6-layer RAISE framework — Data ingestion → Scaling → AI Engine → Finance → Blockchain → Dashboard. All layers actively running in February 2026.</p>
            </div>

            {/* Flow Diagram */}
            <div className="card card-ai card-p mb-3" style={{ textAlign: 'center' }}>
                <div className="section-title" style={{ justifyContent: 'center' }}>End-to-End Data Flow</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 0', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['MCA + GitHub + Web', '→', 'Data Lake', '→', 'Knowledge Graph', '→', 'R.A.I.S.E Engine', '→', 'BL Portfolio', '→', 'Blockchain Escrow', '→', 'Investor Dashboard'].map((item, i) => (
                        <div key={i}>
                            {item === '→' ? (
                                <span style={{ color: 'var(--text-3)', fontSize: '1.5rem', padding: '0 0.25rem' }}>→</span>
                            ) : (
                                <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg-glass)', border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{item}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Layer Cards */}
            <div className="grid g2">
                {LAYERS.map(l => (
                    <div key={l.label} className={`card card-${l.color} card-p`}>
                        <div className={`badge badge-${l.color}`} style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>{l.label}</div>
                        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                            {l.items.map(item => (
                                <li key={item} className="flex items-center gap-1" style={{ padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                                    <span style={{ color: `var(--${l.color})`, fontSize: '0.7rem' }}>▸</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="card card-ai card-p mt-3">
                <div className="section-title">📦 Tech Stack</div>
                <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                    {['Python 3.12', 'XGBoost 2.x', 'LightGBM 4.x', 'joblib', 'VADER Sentiment', 'Dask', 'pandas / numpy', 'scikit-learn', 'Solidity ^0.8.24', 'Hardhat', 'OpenZeppelin', 'ethers.js', 'React 19', 'Vite', 'Chart.js', 'requests + urllib3'].map(t => (
                        <span key={t} className="badge badge-neutral">{t}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
