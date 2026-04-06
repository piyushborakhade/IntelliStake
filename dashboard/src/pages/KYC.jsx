import { useState, useEffect } from 'react';

const API = 'http://localhost:5500';

export default function KYC({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', wallet: '', email: '', tier: 'RETAIL' });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API}/api/kyc`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch(`${API}/api/kyc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (d.error) { setError(d.error); }
            else { setResult(d); setForm({ name: '', wallet: '', email: '', tier: 'RETAIL' }); }
        } catch (err) {
            setError('Backend not reachable — start the Flask server.');
        } finally {
            setSubmitting(false);
        }
    };

    const tiers = data?.tiers || { RETAIL: 0, ACCREDITED: 0, INSTITUTIONAL: 0 };
    const totalInvestors = data?.total || 0;

    const TIER_COLORS = { RETAIL: 'var(--blue)', ACCREDITED: 'var(--purple)', INSTITUTIONAL: 'var(--amber)' };
    const TIER_LIMITS = { RETAIL: '₹25K', ACCREDITED: '₹1L', INSTITUTIONAL: '₹5L' };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-purple">ERC-3643</span>
                        <span className="badge badge-green">IdentityRegistry.sol</span>
                    </div>
                    <div className="page-title">🪪 KYC / Identity Verification</div>
                    <div className="page-sub">
                        On-chain identity registry. Register investors, assign KYC tiers, control token access.
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Total Registered', value: totalInvestors.toLocaleString(), color: 'var(--blue)', sub: 'on-chain identities' },
                    { label: 'Retail (L1)', value: tiers.RETAIL?.toLocaleString(), color: 'var(--blue)', sub: 'Investment limit ₹25K' },
                    { label: 'Accredited (L2)', value: tiers.ACCREDITED?.toLocaleString(), color: 'var(--purple)', sub: 'Investment limit ₹1L' },
                    { label: 'Institutional (L3)', value: tiers.INSTITUTIONAL?.toLocaleString(), color: 'var(--amber)', sub: 'Investment limit ₹5L' },
                ].map(m => (
                    <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{ color: m.color, fontSize: '1.4rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem' }}>

                {/* Registration form */}
                <div className="card">
                    <div className="card-title">🔐 Register New Investor</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        Calls <code style={{ color: 'var(--green)' }}>registerInvestor(wallet, kycLevel)</code> on IdentityRegistry.sol
                    </div>

                    {result && (
                        <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                                ✅ Registration Confirmed
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{result.message}</div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                                TX: {result.tx_hash}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                Block #{result.block} · Limit: ₹{result.investment_limit?.toLocaleString()}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: '1rem', color: 'var(--red)', fontSize: '0.82rem' }}>
                            ❌ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {[
                            { key: 'name', label: 'Full Name', placeholder: 'Investor full name', type: 'text' },
                            { key: 'wallet', label: 'Wallet Address', placeholder: '0x742d35Cc6634C0532925a3b8D4C9C...', type: 'text' },
                            { key: 'email', label: 'Email (optional)', placeholder: 'investor@fund.com', type: 'email' },
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom: '0.85rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                                    {f.label}
                                </label>
                                <input
                                    type={f.type}
                                    placeholder={f.placeholder}
                                    value={form[f.key]}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                                />
                            </div>
                        ))}

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                                KYC Tier
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
                                {['RETAIL', 'ACCREDITED', 'INSTITUTIONAL'].map(tier => (
                                    <button
                                        key={tier}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, tier }))}
                                        style={{
                                            padding: '0.6rem 0.4rem', borderRadius: 8, border: `1px solid ${form.tier === tier ? TIER_COLORS[tier] : 'var(--border)'}`,
                                            background: form.tier === tier ? `${TIER_COLORS[tier]}15` : 'rgba(255,255,255,0.02)',
                                            color: form.tier === tier ? TIER_COLORS[tier] : 'var(--text-muted)',
                                            fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div>{tier}</div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 400, marginTop: '0.15rem', opacity: 0.7 }}>{TIER_LIMITS[tier]}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={submitting || !form.name || !form.wallet}
                            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
                        >
                            {submitting ? '⏳ Registering on-chain…' : '⛓️ Register Identity'}
                        </button>
                    </form>
                </div>

                {/* Investor list */}
                <div className="card">
                    <div className="card-title">👥 Registered Investors ({totalInvestors.toLocaleString()})</div>
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ERC-3643 compliant · <code style={{ color: 'var(--green)' }}>isVerified()</code> called before every token transfer
                    </div>

                    {/* Tier donut stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                        {Object.entries(tiers).map(([tier, count]) => (
                            <div key={tier} style={{ padding: '0.65rem', background: `${TIER_COLORS[tier]}0a`, border: `1px solid ${TIER_COLORS[tier]}25`, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: TIER_COLORS[tier] }}>{count.toLocaleString()}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{tier}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {(data?.investors || []).map((inv, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.55rem 0.65rem', borderRadius: 8, marginBottom: '0.25rem',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                                transition: 'border-color 0.15s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
                            >
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{inv.name}</div>
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                        {inv.wallet?.slice(0, 22)}…
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4, background: `${TIER_COLORS[inv.tier]}15`, color: TIER_COLORS[inv.tier] }}>
                                        {inv.tier_display || inv.tier}
                                    </span>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>✅ Verified</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
