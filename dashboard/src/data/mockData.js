// Mock data representing the actual IntelliStake pipeline results

export const PLATFORM_STATS = {
    dataPoints: '3.2M',
    startups: '50,000',
    r2Score: '0.92',
    sharpe: '0.9351',
    sortino: '1.24',
    maxDrawdown: '-7.44%',
    trustCoverage: '98.6%',
    blockchainTx: '1,247',
};

export const PORTFOLIO = [
    { name: 'Zepto', sector: 'Quick Commerce', country: 'India', trust: 0.87, alloc: 18.4, action: 'INVEST', risk: 'NONE', upside: 312 },
    { name: 'Razorpay', sector: 'FinTech', country: 'India', trust: 0.91, alloc: 16.8, action: 'INVEST', risk: 'NONE', upside: 248 },
    { name: 'CRED', sector: 'FinTech', country: 'India', trust: 0.79, alloc: 14.2, action: 'INVEST', risk: 'LOW', upside: 187 },
    { name: 'Meesho', sector: 'E-Commerce', country: 'India', trust: 0.74, alloc: 12.1, action: 'HOLD', risk: 'LOW', upside: 143 },
    { name: 'PhonePe', sector: 'FinTech', country: 'India', trust: 0.88, alloc: 11.9, action: 'INVEST', risk: 'NONE', upside: 201 },
    { name: 'Groww', sector: 'WealthTech', country: 'India', trust: 0.82, alloc: 10.3, action: 'INVEST', risk: 'NONE', upside: 164 },
    { name: 'Nykaa', sector: 'Beauty-Tech', country: 'India', trust: 0.68, alloc: 8.7, action: 'HOLD', risk: 'MEDIUM', upside: 98 },
    { name: 'Delhivery', sector: 'Logistics', country: 'India', trust: 0.72, alloc: 7.6, action: 'HOLD', risk: 'LOW', upside: 112 },
];

export const RISK_AUDIT_SAMPLE = [
    { name: 'Zepto', velocity: 0.88, pedigree: 0.84, traction: 0.91, trust: 0.875, sev: 'NONE', omega: 1.0 },
    { name: 'Razorpay', velocity: 0.92, pedigree: 0.89, traction: 0.88, trust: 0.909, sev: 'NONE', omega: 1.0 },
    { name: 'CRED', velocity: 0.78, pedigree: 0.76, traction: 0.83, trust: 0.791, sev: 'LOW', omega: 1.5 },
    { name: 'Nykaa', velocity: 0.61, pedigree: 0.72, traction: 0.71, trust: 0.648, sev: 'MEDIUM', omega: 2.0 },
    { name: 'BharatPe', velocity: 0.42, pedigree: 0.55, traction: 0.48, trust: 0.379, sev: 'HIGH', omega: 3.5 },
    { name: 'GoMechanic', velocity: 0.31, pedigree: 0.38, traction: 0.29, trust: 0.283, sev: 'HIGH', omega: 3.5 },
];

export const BLOCKCHAIN_ESCROW = [
    { startup: 'Zepto', tranche: 1, pct: 25, status: 'RELEASED', trigger: 'Investment confirmed', hash: '0x4f3a...c891' },
    { startup: 'Zepto', tranche: 2, pct: 25, status: 'RELEASED', trigger: 'GitHub velocity HIGH', hash: '0x8b2e...f441' },
    { startup: 'Zepto', tranche: 3, pct: 25, status: 'PENDING', trigger: 'Trust score > 0.50 (✓)', hash: null },
    { startup: 'Zepto', tranche: 4, pct: 25, status: 'LOCKED', trigger: 'MCA audit clean required', hash: null },
    { startup: 'Razorpay', tranche: 1, pct: 25, status: 'RELEASED', trigger: 'Investment confirmed', hash: '0x9d7c...b220' },
    { startup: 'Razorpay', tranche: 2, pct: 25, status: 'RELEASED', trigger: 'GitHub velocity HIGH', hash: '0x1a4f...e773' },
    { startup: 'Razorpay', tranche: 3, pct: 25, status: 'PENDING', trigger: 'Trust score > 0.50 (✓)', hash: null },
    { startup: 'Razorpay', tranche: 4, pct: 25, status: 'LOCKED', trigger: 'MCA audit clean required', hash: null },
];

export const VALUATION_METRICS = {
    xgb: { r2: 0.9124, mae: 4820000, rmse: 9140000, bestIter: 342 },
    lgbm: { r2: 0.9087, mae: 5010000, rmse: 9380000, bestIter: 298 },
    ensemble: { r2: 0.9201, mae: 4540000, rmse: 8760000 },
    features: [
        { name: 'estimated_revenue_usd', importance: 0.3241 },
        { name: 'funding_amount_usd', importance: 0.2187 },
        { name: 'trust_score', importance: 0.1432 },
        { name: 'employee_count', importance: 0.0987 },
        { name: 'company_age_years', importance: 0.0871 },
        { name: 'monthly_web_visits', importance: 0.0643 },
        { name: 'avg_sentiment_polarity', importance: 0.0422 },
        { name: 'industry (encoded)', importance: 0.0217 },
    ],
};

export const DATA_LAKE = [
    { layer: 'Raw', files: 3, records: '96,809', size: '842 MB', status: 'Complete' },
    { layer: 'Cleaned', files: 3, records: '50,000', size: '124 MB', status: 'Complete' },
    { layer: 'Knowledge Graph', files: 2, records: '3.2M nodes', size: '2.1 GB', status: 'Complete' },
    { layer: 'Outputs', files: 8, records: 'Portfolio + Risk + Models', size: '38 MB', status: 'Live' },
    { layer: 'Production', files: 4, records: 'NaN-fixed, audit logs', size: '12 MB', status: 'Live' },
];

export const SENTIMENT_HEADLINES = [
    { title: 'Zepto raises $665M in fresh funding round', source: 'Inc42', score: 0.87, label: 'POSITIVE' },
    { title: 'Razorpay crosses $7.5B valuation mark', source: 'YourStory', score: 0.91, label: 'POSITIVE' },
    { title: 'BharatPe co-founder exits amid boardroom controversy', source: 'ET', score: -0.72, label: 'NEGATIVE' },
    { title: 'CRED expands to credit line products for premium users', source: 'TechCrunch', score: 0.63, label: 'POSITIVE' },
    { title: 'GoMechanic admits to financial fraud in investor audit', source: 'VCCircle', score: -0.89, label: 'NEGATIVE' },
    { title: 'Meesho profitability roadmap unveiled at investor day', source: 'Inc42', score: 0.71, label: 'POSITIVE' },
];

export const MONTE_CARLO_PATHS = (() => {
    const seed = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
    const paths = [];
    const steps = 52;
    for (let p = 0; p < 5; p++) {
        let val = 100;
        const path = [val];
        for (let i = 1; i <= steps; i++) {
            const r = seed(p * 1000 + i) * 0.12 - 0.02;
            val *= (1 + r);
            path.push(parseFloat(val.toFixed(2)));
        }
        paths.push(path);
    }
    return paths;
})();

export const WEEKS = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

export const SECTORS = ['FinTech', 'Quick Commerce', 'E-Commerce', 'WealthTech', 'Logistics', 'Beauty-Tech', 'EdTech', 'HealthTech'];
