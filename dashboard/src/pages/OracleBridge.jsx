import { useState, useEffect } from 'react';
import { useSepoliaData } from '../hooks/useSepoliaData';

const API = 'http://localhost:5500';

const ACTION_META = {
    FREEZE_MILESTONE_FUNDING: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: '🔴', label: 'FREEZE' },
    APPROVE_TRANCHE: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: '✅', label: 'APPROVE' },
    CONDITIONAL_HOLD: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '⏸', label: 'HOLD' },
    PUSH_SCORE: { color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', icon: '📡', label: 'PUSH' },
    ORACLE_PUSH: { color: '#06b6d4', bg: 'rgba(6,182,212,0.06)', icon: '⛓️', label: 'ORACLE' },
};

function TxCard({ tx, i, total }) {
    const [copied, setCopied] = useState(false);
    const meta = ACTION_META[tx.action] || { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', icon: '◆', label: tx.action };

    const copyHash = () => {
        navigator.clipboard?.writeText(tx.tx_hash || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            {/* Timeline spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: '50%', border: `2px solid ${meta.color}`,
                    background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', zIndex: 1, flexShrink: 0,
                }}>{meta.icon}</div>
                {i < total - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />}
            </div>

            {/* Content */}
            <div style={{
                flex: 1, padding: '0.75rem', marginBottom: '0.5rem', borderRadius: 10,
                background: meta.bg, border: `1px solid ${meta.color}25`,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                            padding: '0.15rem 0.55rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800,
                            background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30`,
                        }}>{meta.label}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>{tx.startup_name || tx.company || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Block #{tx.block_number || tx.block}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{tx.timestamp}</span>
                    </div>
                </div>
                {tx.reason && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{tx.reason}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={copyHash} title="Copy tx hash" style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: copied ? '#10b981' : '#06b6d4',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}>
                        {copied ? '✓ Copied' : `${(tx.tx_hash || '0x…').slice(0, 42)}…`}
                    </button>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Trust: {parseFloat(tx.trust_score || 0).toFixed(3)}</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Gas: {tx.gas_used?.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

export default function OracleBridge({ onNav }) {
    const [data, setData] = useState(null);
    const [chain, setChain] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [oracleTxs, setOracleTxs] = useState([]);
    const { data: sepoliaData } = useSepoliaData();

    useEffect(() => {
        Promise.all([
            fetch(`${API}/api/oracle`).then(r => r.json()).catch(() => null),
            fetch(`${API}/api/blockchain/status`).then(r => r.json()).catch(() => null),
            fetch(`${API}/api/oracle/transactions`).then(r => r.json()).catch(() => null),
        ]).then(([oracleData, chainData, txData]) => {
            setData(oracleData);
            setChain(chainData);
            if (Array.isArray(txData)) setOracleTxs(txData);
            else if (txData?.transactions) setOracleTxs(txData.transactions);
            setLoading(false);
        });
    }, []);

    const txs = data?.transactions || [];
    const summary = data?.summary || {};

    const filtered = txs.filter(t => {
        if (filter === 'ALL') return true;
        if (filter === 'FREEZE') return t.action?.includes('FREEZE');
        if (filter === 'APPROVE') return t.action?.includes('APPROVE');
        if (filter === 'HOLD') return t.action?.includes('HOLD');
        return true;
    });

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-purple">TrustOracle.sol</span>
                        <span className="badge badge-green">Chainlink-style</span>
                        {chain?.is_live
                            ? <span className="badge badge-amber">⛓️ Sepolia Testnet · Chain ID: 11155111</span>
                            : <span className="badge badge-blue">Chain ID: 31337</span>}
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: 20, background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}>⛓️ Execute — Step 4 of 5</span>
                    </div>
                    <div className="page-title">⛓️ Oracle Bridge</div>
                    <div className="page-sub">Off-chain R.A.I.S.E. trust scores → on-chain oracle push → MilestoneEscrow trigger</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['ALL', 'APPROVE', 'HOLD', 'FREEZE'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}>
                            {f === 'APPROVE' ? '✅' : f === 'FREEZE' ? '🔴' : f === 'HOLD' ? '⏸' : ''} {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Total Transactions', value: summary.total_transactions, color: '#3b82f6', sub: 'on-chain events', tip: 'Each oracle push or freeze is a real on-chain transaction recorded on Hardhat local chain (Chain ID 31337)' },
                    { label: 'Freeze Events', value: summary.freeze_events, color: '#ef4444', sub: 'smart freeze triggered', tip: 'Triggered when trust score falls below 0.35 — smart contract halts further escrow tranches' },
                    { label: 'Approve Events', value: summary.approve_events, color: '#10b981', sub: 'tranche unlocked', tip: 'Milestone reached — escrow contract releases next funding tranche to startup' },
                    { label: 'Gas Used (total)', value: summary.total_gas_used?.toLocaleString(), color: '#f59e0b', sub: 'Gwei units', tip: 'Total computational cost of all oracle transactions on-chain' },
                ].map(m => (
                    <div key={m.label} className="metric-card" title={m.tip} style={{ cursor: 'help', position: 'relative' }}>
                        <div className="metric-label">{m.label} <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>ℹ️</span></div>
                        <div className="metric-value" style={{ color: m.color, fontSize: '1.1rem' }}>{loading ? '…' : m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
                {/* Timeline */}
                <div className="card">
                    <div className="card-title">🔗 Blockchain Transaction Timeline ({filtered.length} events)</div>
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Contract: <code style={{ color: '#10b981' }}>{summary.oracle_contract || chain?.contracts?.IntelliStakeInvestment?.address || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'}</code> · {summary.network || chain?.network}
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {filtered.map((tx, i) => <TxCard key={i} tx={tx} i={i} total={filtered.length} />)}
                        {filtered.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No events match filter</div>
                        )}
                    </div>
                </div>

                {/* Right panel */}
                <div>
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-title">📡 Contract Registry</div>
                        {[
                            chain?.is_live || chain?.contracts?.IntelliStakeInvestment?.address
                                ? { label: 'IntelliStakeInvestment.sol', addr: chain.contracts?.IntelliStakeInvestment?.address, color: '#8b5cf6', link: chain.contracts?.IntelliStakeInvestment?.etherscan }
                                : { label: 'IntelliStakeInvestment.sol', addr: summary.oracle_contract || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', color: '#8b5cf6', link: null },
                            chain?.contracts?.IdentityRegistry?.address
                                ? { label: 'IdentityRegistry.sol', addr: chain.contracts?.IdentityRegistry?.address, color: '#10b981', link: chain.contracts?.IdentityRegistry?.etherscan }
                                : { label: 'IdentityRegistry.sol', addr: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', color: '#10b981', link: null },
                            chain?.contracts?.IntelliStakeToken?.address
                                ? { label: 'IntelliStakeToken ($ISTK)', addr: chain.contracts?.IntelliStakeToken?.address, color: '#3b82f6', link: chain.contracts?.IntelliStakeToken?.etherscan }
                                : { label: 'IntelliStakeToken ($ISTK)', addr: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', color: '#3b82f6', link: null },
                        ].map(c => (
                            <div key={c.label} style={{ marginBottom: '0.75rem', padding: '0.65rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.color, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                                    {c.label}
                                    {c.link && <a href={c.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.62rem', color: '#60a5fa' }}>Etherscan ↗</a>}
                                </div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{c.addr}</div>
                            </div>
                        ))}
                    </div>

                    {/* Oracle Deals Table */}
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <div className="card-title" style={{ marginBottom: 0 }}>⛓️ Oracle Deals</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: sepoliaData.live ? '#10b981' : '#f59e0b',
                                    animation: sepoliaData.live ? 'pulse 1.4s infinite' : 'none',
                                }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: sepoliaData.live ? '#10b981' : '#f59e0b' }}>
                                    {sepoliaData.live ? 'SEPOLIA' : 'FALLBACK'}
                                </span>
                            </div>
                        </div>
                        {loading ? (
                            <div style={{ fontSize: 12, color: '#475569' }}>Loading…</div>
                        ) : oracleTxs.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#475569' }}>No oracle transactions found</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {oracleTxs.slice(0, 3).map((deal, i) => {
                                    const statusColor = deal.status === 'active' ? '#10b981' : deal.status === 'frozen' ? '#ef4444' : '#f59e0b';
                                    const statusIcon  = deal.status === 'active' ? '🟢' : deal.status === 'frozen' ? '🔴' : '🟡';
                                    return (
                                        <div key={i} style={{
                                            padding: '10px 12px', borderRadius: 9,
                                            background: `${statusColor}08`, border: `1px solid ${statusColor}25`,
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#e2e8f0' }}>{deal.startup_name || deal.company}</span>
                                                <span style={{ fontSize: 10, fontWeight: 800, color: statusColor }}>{statusIcon} {(deal.status || '').toUpperCase()}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                                                <span>Trust: <span style={{ color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>{parseFloat(deal.trust_score || 0).toFixed(3)}</span></span>
                                                {deal.amount && <span>Amount: <span style={{ color: '#94a3b8' }}>{deal.amount}</span></span>}
                                            </div>
                                            {deal.tx_hash && (
                                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#06b6d4', marginTop: 4 }}>
                                                    {deal.tx_hash.slice(0, 30)}…
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ marginTop: chain?.is_live ? '1rem' : '0' }}>
                        <div className="card-title">⚙️ How It Works</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.9 }}>
                            <div>1. <strong style={{ color: 'var(--text-secondary)' }}>R.A.I.S.E.</strong> computes trust scores off-chain</div>
                            <div>2. <code style={{ color: '#06b6d4' }}>oracle_bridge.py</code> reads trust score</div>
                            <div>3. Calls <code style={{ color: '#10b981' }}>pushScore(id, score)</code> on-chain</div>
                            <div>4. If score &lt; 0.35 → <code style={{ color: '#ef4444' }}>freezeMilestoneFunding()</code></div>
                            <div>5. MilestoneEscrow halts remaining tranches</div>
                        </div>
                        <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'rgba(16,185,129,0.05)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>✅ Network: {summary.network || 'Hardhat Local'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
