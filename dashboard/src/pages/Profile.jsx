import { useState } from 'react';
import { useAuth, ROLES } from '../context/AuthContext';

export default function Profile() {
    const { user, logout, getChainStats } = useAuth();
    const [tab, setTab] = useState('overview');
    const stats = getChainStats();
    const role = ROLES[user?.role] || ROLES.ANALYST;

    const joinDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div>
            {/* Profile hero */}
            <div className="profile-hero" style={{ marginBottom: '1.5rem' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 80% 50%, rgba(59,130,246,0.05), transparent)', borderRadius: 'inherit' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                    <div className="profile-avatar-lg">{user?.avatar}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                            <div className="profile-name">{user?.name}</div>
                            <span className="badge" style={{ background: `${role.color}20`, color: role.color, border: `1px solid ${role.color}40` }}>
                                {role.badge} {role.label}
                            </span>
                            <span className={`badge ${user?.kyc === 'INSTITUTIONAL' ? 'badge-amber' : user?.kyc === 'ACCREDITED' ? 'badge-purple' : 'badge-blue'}`}>
                                KYC: {user?.kyc}
                            </span>
                        </div>
                        <div className="profile-email">{user?.email}</div>
                        <div className="profile-wallet">{user?.wallet}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Member since {joinDate} · Credential Chain: {stats.totalBlocks} blocks · {stats.logins} sessions
                        </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={logout}>🚪 Sign Out</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.25rem', width: 'fit-content', marginBottom: '1.5rem' }}>
                {[['overview', '👤 Overview'], ['chain', '⛓️ Credential Chain'], ['access', '🔑 Access Control']].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                        style={{
                            padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s',
                            background: tab === id ? 'rgba(59,130,246,0.2)' : 'none',
                            color: tab === id ? '#93c5fd' : 'var(--text-muted)'
                        }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Identity card */}
                    <div className="card">
                        <div className="card-title">🪪 Identity Details</div>
                        {[
                            ['Full Name', user?.name],
                            ['Email', user?.email],
                            ['Role', `${role.badge} ${role.label}`],
                            ['KYC Tier', user?.kyc],
                            ['IdentityRegistry Level', user?.kyc === 'INSTITUTIONAL' ? 'Level 3' : user?.kyc === 'ACCREDITED' ? 'Level 2' : 'Level 1'],
                        ].map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Wallet card */}
                    <div className="card">
                        <div className="card-title">🦊 Blockchain Identity</div>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Wallet Address</div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--green)', wordBreak: 'break-all', padding: '0.5rem', background: 'rgba(16,185,129,0.05)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                                {user?.wallet}
                            </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Key Derivation</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>PBKDF2-SHA256 · 100,000 iterations</div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>IdentityRegistry.sol Status</div>
                            <span className="badge badge-green">✅ isVerified() → TRUE</span>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Credential Chain Blocks</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{stats.totalBlocks}</div>
                        </div>
                    </div>

                    {/* Session stats */}
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-title">📊 Usage Overview</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
                            {[
                                { label: 'Total Logins', value: stats.logins, icon: '🔐', color: 'var(--blue)' },
                                { label: 'Chain Blocks', value: stats.totalBlocks, icon: '⛓️', color: 'var(--green)' },
                                { label: 'Registered Users', value: stats.users, icon: '👥', color: 'var(--purple)' },
                                { label: 'Session TTL', value: '8 hrs', icon: '⏱️', color: 'var(--amber)' },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{s.icon}</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Chain tab */}
            {tab === 'chain' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div className="card" style={{ flex: 1, padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{stats.totalBlocks}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Blocks</div>
                        </div>
                        <div className="card" style={{ flex: 1, padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{stats.logins}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Login Events</div>
                        </div>
                        <div className="card" style={{ flex: 2, padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Latest Block Hash</div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--green)', wordBreak: 'break-all' }}>{stats.latestHash}</div>
                        </div>
                    </div>

                    <div className="card-title" style={{ marginBottom: '0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Recent Blocks (Latest 5)
                    </div>

                    {stats.chain.slice().reverse().map((block, i) => (
                        <div key={block.index}>
                            {i > 0 && <div className="chain-connector" />}
                            <div className={`chain-block ${block.eventType?.toLowerCase()}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ color: block.eventType === 'REGISTER' ? 'var(--green)' : block.eventType === 'LOGIN' ? 'var(--blue)' : 'var(--amber)', fontWeight: 700 }}>
                                        #{block.index} {block.eventType}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                        {new Date(block.timestamp).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                                    Data: <span style={{ color: '#e2e8f0' }}>{JSON.stringify(block.data).slice(0, 60)}…</span>
                                </div>
                                <div>hash: <span style={{ color: 'var(--green)' }}>{block.blockHash.slice(0, 32)}…</span></div>
                                <div>prev: <span style={{ color: 'var(--text-muted)' }}>{block.prevHash.slice(0, 32)}…</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Access control tab */}
            {tab === 'access' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="card">
                        <div className="card-title">🔑 Role Permissions</div>
                        {[
                            ['View Portfolio', true],
                            ['Run Risk Audit', true],
                            ['Export Data', user?.role !== 'ANALYST'],
                            ['Push Oracle TXs', user?.role === 'ADMIN'],
                            ['Manage KYC Identities', user?.role !== 'ANALYST'],
                            ['Admin Panel Access', user?.role === 'ADMIN'],
                            ['Freeze Escrow Funding', user?.role === 'ADMIN'],
                        ].map(([perm, granted]) => (
                            <div key={perm} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{perm}</span>
                                <span className={`badge ${granted ? 'badge-green' : 'badge-red'}`}>{granted ? '✅ Granted' : '❌ Denied'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="card">
                        <div className="card-title">⛓️ IdentityRegistry.sol</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', lineHeight: 2, color: 'var(--text-muted)' }}>
                            <div>contract.isVerified(<span style={{ color: 'var(--green)' }}>{user?.wallet?.slice(0, 12)}…</span>)</div>
                            <div style={{ color: 'var(--green)', marginBottom: '0.5rem' }}>→ <strong>true</strong></div>
                            <div>kyc.level = <span style={{ color: 'var(--blue)' }}>{user?.kyc === 'INSTITUTIONAL' ? 3 : user?.kyc === 'ACCREDITED' ? 2 : 1}</span></div>
                            <div>role.id   = <span style={{ color: 'var(--purple)' }}>"{user?.role}"</span></div>
                            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 6, color: 'var(--green)', fontSize: '0.72rem' }}>
                                ✅ Token transfer authorized<br />MilestoneEscrow: eligible for T{user?.kyc === 'INSTITUTIONAL' ? '1-4' : user?.kyc === 'ACCREDITED' ? '1-3' : '1'} tranches
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
