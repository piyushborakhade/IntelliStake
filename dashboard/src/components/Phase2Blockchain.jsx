import { Shield, CheckCircle, Lock, Users, Coins } from 'lucide-react';

function Phase2Blockchain() {
    const complianceChecks = [
        'KYC verified (sender)',
        'KYC verified (recipient)',
        'Accredited investor status',
        'Within max holding limit',
        'Above minimum investment',
        'External compliance module',
    ];

    return (
        <div className="section">
            <div className="container">
                <div className="section-title fade-in">
                    <h1>
                        <Shield size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '1rem' }} />
                        Phase 2: Blockchain Domain
                    </h1>
                    <p className="section-subtitle">
                        ERC-3643 (T-REX) compliant security token with identity verification, milestone-based
                        escrow, and comprehensive transfer compliance enforcement.
                    </p>
                </div>

                {/* Key Features */}
                <div className="grid grid-3 mb-6 fade-in">
                    <div className="metric-card">
                        <Users size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                        <div className="metric-value">KYC</div>
                        <div className="metric-label">Identity Verification</div>
                    </div>
                    <div className="metric-card">
                        <Lock size={32} style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }} />
                        <div className="metric-value">Escrow</div>
                        <div className="metric-label">Milestone-Based</div>
                    </div>
                    <div className="metric-card">
                        <Coins size={32} style={{ color: 'var(--accent-tertiary)', marginBottom: '1rem' }} />
                        <div className="metric-value">500+</div>
                        <div className="metric-label">Lines Solidity</div>
                    </div>
                </div>

                {/* Contract Architecture */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Smart Contract Architecture</h2>
                    <div className="card-content">
                        <div className="architecture-grid">
                            <div className="arch-item">
                                <h4>Standard</h4>
                                <p>ERC-3643 (T-REX Protocol)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Language</h4>
                                <p>Solidity 0.8.20</p>
                            </div>
                            <div className="arch-item">
                                <h4>Dependencies</h4>
                                <p>OpenZeppelin (Ownable, ReentrancyGuard, Pausable)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Functions</h4>
                                <p>15 external, 2 internal</p>
                            </div>
                            <div className="arch-item">
                                <h4>Events</h4>
                                <p>7 compliance & escrow events</p>
                            </div>
                            <div className="arch-item">
                                <h4>Security</h4>
                                <p>Custom errors, reentrancy protection</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Compliance Checks */}
                <div className="card mb-6 fade-in">
                    <h2 className="card-title">Transfer Compliance Rules</h2>
                    <div className="card-content">
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                            Every token transfer must pass ALL of the following compliance checks:
                        </p>
                        <div className="compliance-list">
                            {complianceChecks.map((check, idx) => (
                                <div key={idx} className="compliance-item">
                                    <CheckCircle size={20} style={{ color: 'var(--accent-success)', flexShrink: 0 }} />
                                    <span>{check}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Milestone Escrow Flow */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Milestone-Based Escrow Flow</h2>
                    <div className="card-content">
                        <div className="flow-diagram">
                            <div className="flow-step">
                                <div className="flow-number">1</div>
                                <div className="flow-content">
                                    <h4>Lock Tranche</h4>
                                    <p>Owner calls <code>lockTranche()</code> with startup ID, amount, milestone hash</p>
                                </div>
                            </div>
                            <div className="flow-arrow">↓</div>
                            <div className="flow-step">
                                <div className="flow-number">2</div>
                                <div className="flow-content">
                                    <h4>Tokens Escrowed</h4>
                                    <p>Tokens minted to contract address, held until milestone verified</p>
                                </div>
                            </div>
                            <div className="flow-arrow">↓</div>
                            <div className="flow-step">
                                <div className="flow-number">3</div>
                                <div className="flow-content">
                                    <h4>Milestone Completion</h4>
                                    <p>Startup achieves milestone (revenue target, product launch, etc.)</p>
                                </div>
                            </div>
                            <div className="flow-arrow">↓</div>
                            <div className="flow-step">
                                <div className="flow-number">4</div>
                                <div className="flow-content">
                                    <h4>Oracle Verification</h4>
                                    <p>Chainlink oracle provides cryptographic proof of milestone completion</p>
                                </div>
                            </div>
                            <div className="flow-arrow">↓</div>
                            <div className="flow-step">
                                <div className="flow-number">5</div>
                                <div className="flow-content">
                                    <h4>Release Funds</h4>
                                    <p>Owner calls <code>releaseTranche()</code>, tokens transferred to startup</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Code Sample */}
                <div className="card">
                    <h2 className="card-title">Smart Contract Code (Excerpt)</h2>
                    <div className="code-block">
                        <pre>{`// Transfer Compliance Check
function canTransfer(address from, address to, uint256 amount) 
    public view returns (bool) 
{
    // KYC verification
    if (!isIdentityVerified(from) || !isIdentityVerified(to)) {
        return false;
    }
    
    // Accredited investor check
    if (from == address(0) && !accreditedInvestors[to]) {
        return false;
    }
    
    // Maximum holding limit
    if (balanceOf(to) + amount > maxHoldingPerAddress) {
        return false;
    }
    
    return true;
}

// Release Milestone Tranche
function releaseTranche(uint256 startupId, uint256 trancheIndex, 
                        bytes calldata proof) external onlyOwner 
{
    Tranche storage tranche = startupTranches[startupId][trancheIndex];
    require(!tranche.released, "Already released");
    
    // Verify milestone with oracle proof
    require(verifyMilestone(tranche.milestoneHash, proof), "Invalid proof");
    
    tranche.released = true;
    _transfer(address(this), tranche.beneficiary, tranche.amount);
    
    emit TrancheReleased(startupId, trancheIndex, tranche.amount);
}`}</pre>
                    </div>
                </div>

                <div className="phase-nav">
                    <a href="/phase2-oracle" className="btn btn-primary">
                        Next: Oracle Integration →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default Phase2Blockchain;
