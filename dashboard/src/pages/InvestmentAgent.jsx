import { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5500';

// ── Deposit Modal ─────────────────────────────────────────────────────────────
function DepositModal({ onClose, onSuccess }) {
    const [amount, setAmount] = useState(100000);
    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [depositError, setDepositError] = useState('');
    const PRESETS = [10000, 50000, 100000, 500000, 1000000];

    const submit = async () => {
        if (amount <= 0) return;
        setLoading(true);
        setDepositError('');
        try {
            const res = await fetch(`${API}/api/deposit`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount }),
            });
            const data = await res.json();
            if (data.tx_hash) {
                setTxHash(data.tx_hash);
                setTimeout(() => { onSuccess(data.vault); onClose(); }, 1500);
            } else {
                setDepositError(data.error || 'Deposit failed — backend returned no transaction hash.');
            }
        } catch {
            setDepositError('⚠️ Backend offline — start the Flask server on port 5500 before depositing.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2rem', width: 400, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.25rem' }}>💎 Deposit to Vault</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Funds are locked in AgentVault.sol until withdrawn</div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {PRESETS.map(p => (
                        <button key={p} onClick={() => setAmount(p)}
                            style={{ padding: '0.35rem 0.8rem', borderRadius: 20, border: `1px solid ${amount === p ? 'var(--blue)' : 'var(--border)'}`, background: amount === p ? 'rgba(59,130,246,0.12)' : 'transparent', color: amount === p ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer' }}>
                            ₹{(p / 1000).toFixed(0)}K
                        </button>
                    ))}
                </div>

                <input className="input-field" type="number" value={amount} style={{ marginBottom: '1rem' }}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)} placeholder="Custom amount (₹)" />

                {txHash && (
                    <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.74rem', marginBottom: '1rem' }}>
                        ✅ Deposited · TX: <span style={{ fontFamily: 'monospace', color: 'var(--green)' }}>{txHash.slice(0, 28)}…</span>
                    </div>
                )}
                {depositError && (
                    <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--red)', marginBottom: '1rem' }}>
                        {depositError}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={submit} disabled={loading || txHash}>
                        {loading ? '⏳ Confirming…' : `⛓️ Deposit ₹${amount.toLocaleString('en-IN')}`}
                    </button>
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

const AGENT_MODES = {
    CONSERVATIVE: { label: 'Conservative 🛡️', minCIS: 0.80, maxPct: 10, color: '#10b981' },
    BALANCED: { label: 'Balanced ⚖️', minCIS: 0.65, maxPct: 20, color: '#3b82f6' },
    AGGRESSIVE: { label: 'Aggressive 🚀', minCIS: 0.50, maxPct: 35, color: '#f59e0b' },
};

const TYPE_CONFIG = {
    PERIODIC: { color: 'var(--blue)', icon: '🔄', label: 'Periodic' },
    MILESTONE: { color: 'var(--purple)', icon: '🎯', label: 'Milestone' },
    VELOCITY: { color: 'var(--green)', icon: '⚡', label: 'Velocity' },
    SENTIMENT: { color: 'var(--cyan)', icon: '📡', label: 'Sentiment' },
    EMERGENCY: { color: 'var(--red)', icon: '🚨', label: 'Emergency' },
};

function TxFeed({ investments }) {
    return (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {investments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    No transactions yet. The agent will execute investments here.
                </div>
            ) : (
                investments.slice().reverse().map((inv, i) => {
                    const tc = TYPE_CONFIG[inv.type] || TYPE_CONFIG.PERIODIC;
                    const isEmergency = inv.type === 'EMERGENCY';
                    return (
                        <div key={inv.id || i} style={{
                            padding: '0.85rem', marginBottom: '0.5rem',
                            background: isEmergency ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isEmergency ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                            borderRadius: 10, display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                        }}>
                            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{tc.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isEmergency ? 'var(--red)' : 'var(--text-primary)' }}>
                                        {isEmergency ? '🚨 EMERGENCY WITHDRAWAL' : inv.company}
                                    </div>
                                    <span className="badge" style={{ background: `${tc.color}20`, color: tc.color, border: `1px solid ${tc.color}40`, flexShrink: 0, fontSize: '0.62rem' }}>{tc.label}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isEmergency ? 'var(--red)' : 'var(--green)' }}>
                                        {isEmergency ? '−' : '+'}₹{(inv.amount || 0).toLocaleString('en-IN')}
                                    </span>
                                    {inv.cis > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CIS: {inv.cis?.toFixed(2)}</span>}
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {new Date(inv.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {inv.tx_hash && (
                                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--green)', marginTop: '0.15rem' }}>
                                        TX: {inv.tx_hash.slice(0, 28)}…
                                    </div>
                                )}
                                {inv.reason && !isEmergency && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{inv.reason}</div>
                                )}
                            </div>
                            <span className={`badge ${inv.status === 'WITHDRAWN' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.6rem', flexShrink: 0 }}>
                                {inv.status}
                            </span>
                        </div>
                    );
                })
            )}
        </div>
    );
}

export default function InvestmentAgent({ onNav }) {
    const [vault, setVault] = useState(null);
    const [loading, setLoading] = useState(true);
    const [backendDown, setBackendDown] = useState(false);
    const [agentMode, setAgentMode] = useState('BALANCED');
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawn, setWithdrawn] = useState(false);
    const [newInvest, setNewInvest] = useState({ company: '', amount: 10000, type: 'MILESTONE' });
    const [submitting, setSubmitting] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);

    const loadVault = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/vault`);
            if (!res.ok) throw new Error('Non-2xx response');
            const data = await res.json();
            setVault(data);
            setBackendDown(false);
        } catch {
            setBackendDown(true);
            setVault(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadVault();
        // Auto-refresh vault every 30 seconds
        const iv = setInterval(loadVault, 30000);
        return () => clearInterval(iv);
    }, [loadVault]);

    const investedPct = vault ? Math.round((vault.total_invested / Math.max(vault.total_deposited, 1)) * 100) : 0;

    const handleEmergencyWithdraw = async () => {
        if (!window.confirm('⚠️ EMERGENCY WITHDRAWAL\n\nThis will instantly withdraw all available funds from the vault and freeze the agent.\n\nAre you sure?')) return;
        setWithdrawing(true);
        try {
            const res = await fetch(`${API}/api/emergency_withdraw`, { method: 'POST' });
            const data = await res.json();
            setWithdrawn(true);
            await loadVault();
        } catch {
            setWithdrawn(true);
            if (vault) setVault(v => ({ ...v, available: 0 }));
        } finally {
            setWithdrawing(false);
        }
    };

    const handleScheduleInvest = async () => {
        if (!newInvest.company.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/invest`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newInvest, reason: `Manual — Agent Mode: ${agentMode}`, cis: AGENT_MODES[agentMode].minCIS }),
            });
            const data = await res.json();
            await loadVault();
            setNewInvest(n => ({ ...n, company: '' }));
        } catch {
            await loadVault();
        } finally {
            setSubmitting(false);
        }
    };

    const totalTx = (vault?.investments || []).length;

    return (
        <>
            {showDeposit && (
                <DepositModal
                    onClose={() => setShowDeposit(false)}
                    onSuccess={(updatedVault) => { if (updatedVault) setVault(updatedVault); else loadVault(); }}
                />
            )}
            <div>
                {/* Backend-down banner */}
                {backendDown && (
                    <div style={{ marginBottom: '1.25rem', padding: '1rem 1.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>🔌</span>
                        <div>
                            <div style={{ fontWeight: 800, color: '#f87171', marginBottom: '0.15rem' }}>Backend Offline</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Flask server is not running on port 5500. Start it with{' '}
                                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                    python engine/chatbot_api.py
                                </code>{' '}
                                to use the Investment Agent.
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={loadVault}>↻ Retry</button>
                    </div>
                )}
                {/* Header */}
                <div className="page-header">
                    <div>
                        <div className="page-title">🤖 Autonomous Investment Agent</div>
                        <div className="page-sub">AI-driven capital deployment via blockchain smart contracts · {totalTx} transactions recorded</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                        <span className={`badge ${vault?.agent_active && !withdrawn ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem' }}>
                            {vault?.agent_active && !withdrawn ? '● Agent Active' : '● Agent Stopped'}
                        </span>
                        <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => setShowDeposit(true)}>
                            💎 Deposit Funds
                        </button>
                    </div>
                </div>

                {/* EMERGENCY BUTTON */}
                <div style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f87171', marginBottom: '0.2rem' }}>🚨 Emergency Protocol</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Instantly withdraw ALL available funds · Freeze agent · No delay · Powered by AgentVault.sol <code>emergencyWithdraw()</code>
                        </div>
                    </div>
                    <button
                        onClick={handleEmergencyWithdraw}
                        disabled={withdrawing || withdrawn || vault?.available === 0}
                        style={{
                            padding: '0.7rem 1.75rem', borderRadius: 10, border: 'none', cursor: withdrawing || withdrawn ? 'not-allowed' : 'pointer',
                            fontWeight: 800, fontSize: '0.88rem', letterSpacing: '-0.01em',
                            background: withdrawing || withdrawn ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.85)',
                            color: '#fff', transition: 'all 0.2s', opacity: (withdrawing || withdrawn) ? 0.6 : 1,
                            boxShadow: withdrawing || withdrawn ? 'none' : '0 4px 20px rgba(239,68,68,0.4)',
                        }}>
                        {withdrawing ? '⏳ Withdrawing…' : withdrawn ? '✅ Withdrawn' : '🚨 Emergency Withdraw'}
                    </button>
                </div>

                {/* Vault metrics */}
                <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Total Deposited', value: vault ? `₹${(vault.total_deposited / 1000).toFixed(0)}K` : '…', color: 'var(--blue)' },
                        { label: 'Deployed', value: vault ? `₹${(vault.total_invested / 1000).toFixed(0)}K` : '…', color: 'var(--purple)' },
                        { label: 'Available', value: vault ? `₹${(vault.available / 1000).toFixed(0)}K` : '…', color: 'var(--green)' },
                        { label: 'Invested %', value: `${investedPct}%`, color: investedPct > 70 ? 'var(--amber)' : 'var(--green)' },
                    ].map(m => (
                        <div key={m.label} className="metric-card">
                            <div className="metric-label">{m.label}</div>
                            <div className="metric-value" style={{ color: m.color, fontSize: '1.5rem' }}>{m.value}</div>
                        </div>
                    ))}
                </div>

                {/* Deployed bar */}
                <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Capital Deployed</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--purple)', fontWeight: 700 }}>{investedPct}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-fill" style={{ width: `${investedPct}%`, background: investedPct > 80 ? 'var(--amber)' : 'var(--grad-primary)', transition: 'width 1s ease' }} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Left: Agent config + manual invest */}
                    <div>
                        {/* Agent mode */}
                        <div className="card" style={{ marginBottom: '1rem' }}>
                            <div className="card-title">⚙️ Agent Mode</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {Object.entries(AGENT_MODES).map(([key, cfg]) => (
                                    <div key={key} onClick={() => setAgentMode(key)}
                                        style={{
                                            padding: '0.75rem 1rem', borderRadius: 10, cursor: 'pointer',
                                            background: agentMode === key ? `${cfg.color}15` : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${agentMode === key ? `${cfg.color}40` : 'var(--border)'}`,
                                            transition: 'all 0.2s',
                                        }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: agentMode === key ? cfg.color : 'var(--text-secondary)' }}>{cfg.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                            Min CIS: {cfg.minCIS} · Max {cfg.maxPct}% per position
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Manual invest */}
                        <div className="card">
                            <div className="card-title">📤 Schedule Investment</div>
                            <div className="form-group">
                                <label className="form-label">Company Name</label>
                                <div className="input-wrapper">
                                    <span className="input-icon">🏢</span>
                                    <input className="input-field has-icon" placeholder="e.g. Zepto" value={newInvest.company}
                                        onChange={e => setNewInvest(n => ({ ...n, company: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleScheduleInvest()} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount (₹)</label>
                                <input className="input-field" type="number" value={newInvest.amount}
                                    onChange={e => setNewInvest(n => ({ ...n, amount: parseFloat(e.target.value) || 0 }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Investment Type</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.4rem' }}>
                                    {['PERIODIC', 'MILESTONE', 'VELOCITY', 'SENTIMENT'].map(t => (
                                        <div key={t} onClick={() => setNewInvest(n => ({ ...n, type: t }))}
                                            style={{ padding: '0.4rem', borderRadius: 8, border: `1px solid ${newInvest.type === t ? 'var(--blue)' : 'var(--border)'}`, background: newInvest.type === t ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: newInvest.type === t ? '#93c5fd' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                                            {TYPE_CONFIG[t]?.icon} {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button className="btn btn-primary w-full" style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem' }}
                                onClick={handleScheduleInvest} disabled={submitting || !newInvest.company.trim()}>
                                {submitting ? '⏳ Executing…' : '⛓️ Execute via AgentVault'}
                            </button>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Or use{' '}
                                <button onClick={() => onNav?.('intelligence')}
                                    style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}>
                                    Company Intelligence
                                </button>{' '}to research first
                            </div>
                        </div>
                    </div>

                    {/* Right: TX feed */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div className="card-title" style={{ marginBottom: 0 }}>⛓️ Transaction Feed</div>
                            <button className="btn btn-ghost btn-sm" onClick={loadVault}>↻ Refresh</button>
                        </div>
                        <TxFeed investments={vault?.investments || []} />
                    </div>
                </div>

                {/* Investment rules summary */}
                <div className="card" style={{ marginTop: '1.25rem' }}>
                    <div className="card-title">📋 Investment Rules (AgentVault.sol)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.75rem' }}>
                        {[
                            { icon: '🧮', label: 'Min CIS Required', value: `${AGENT_MODES[agentMode].minCIS} (${agentMode})` },
                            { icon: '📊', label: 'Max Per Position', value: `${AGENT_MODES[agentMode].maxPct}% of vault` },
                            { icon: '🪪', label: 'KYC Gate', value: 'IdentityRegistry.sol' },
                            { icon: '🔐', label: 'Escrow Route', value: 'MilestoneEscrow (4 tranches)' },
                            { icon: '⛓️', label: 'Oracle Validation', value: 'TrustOracle.sol pre-signs' },
                            { icon: '🚨', label: 'Emergency Protocol', value: 'Instant · owner-only · no delay' },
                        ].map(r => (
                            <div key={r.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
                                <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{r.icon}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.label}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>{r.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
