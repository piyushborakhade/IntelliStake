import { Network, ArrowRight } from 'lucide-react';

function Architecture() {
    return (
        <div className="section">
            <div className="container">
                <div className="section-title fade-in">
                    <h1>
                        <Network size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '1rem' }} />
                        Complete System Architecture
                    </h1>
                    <p className="section-subtitle">
                        End-to-end integration of AI, Finance, and Blockchain domains with oracle-based
                        data bridging for a fully decentralized VC platform.
                    </p>
                </div>

                {/* End-to-End Flow */}
                <div className="card mb-6 fade-in">
                    <h2 className="card-title">Complete Data Flow</h2>
                    <div className="card-content">
                        <div className="e2e-flow">
                            <div className="e2e-stage">
                                <div className="e2e-badge ai-badge">Phase 1</div>
                                <h3>AI Domain</h3>
                                <div className="e2e-box">
                                    <h4>valuation_engine.py</h4>
                                    <ul>
                                        <li>Load 50K startup records</li>
                                        <li>Train XGBoost + LightGBM</li>
                                        <li>Predict valuations (R² 0.88)</li>
                                        <li>Output: estimated_valuation_usd</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="e2e-arrow">
                                <ArrowRight size={32} />
                            </div>

                            <div className="e2e-stage">
                                <div className="e2e-badge finance-badge">Phase 2</div>
                                <h3>Finance Domain</h3>
                                <div className="e2e-box">
                                    <h4>portfolio_optimizer.py</h4>
                                    <ul>
                                        <li>AI predictions → views (Q)</li>
                                        <li>Market equilibrium (Π)</li>
                                        <li>Black-Litterman posterior</li>
                                        <li>Output: allocation %</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="e2e-arrow">
                                <ArrowRight size={32} />
                            </div>

                            <div className="e2e-stage">
                                <div className="e2e-badge oracle-badge">Integration</div>
                                <h3>Oracle Layer</h3>
                                <div className="e2e-box">
                                    <h4>IntelliStakeOracle.js</h4>
                                    <ul>
                                        <li>Fetch API data</li>
                                        <li>Validate response</li>
                                        <li>Convert float → uint256</li>
                                        <li>Submit transaction</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="e2e-arrow">
                                <ArrowRight size={32} />
                            </div>

                            <div className="e2e-stage">
                                <div className="e2e-badge blockchain-badge">Phase 2</div>
                                <h3>Blockchain Domain</h3>
                                <div className="e2e-box">
                                    <h4>IntelliStakeToken.sol</h4>
                                    <ul>
                                        <li>Validate KYC status</li>
                                        <li>Check accreditation</li>
                                        <li>Mint tokens per %</li>
                                        <li>Lock in escrow</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Technical Specifications */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Technical Specifications</h2>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th>Technology</th>
                                    <th>Lines of Code</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: '600' }}>AI Valuation Engine</td>
                                    <td>Python, XGBoost, LightGBM</td>
                                    <td>339</td>
                                    <td><span className="badge badge-success">Complete</span></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: '600' }}>Portfolio Optimizer</td>
                                    <td>Python, NumPy, SciPy</td>
                                    <td>600+</td>
                                    <td><span className="badge badge-success">Complete</span></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: '600' }}>Smart Contract</td>
                                    <td>Solidity 0.8.20, OpenZeppelin</td>
                                    <td>500+</td>
                                    <td><span className="badge badge-success">Complete</span></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: '600' }}>Oracle Bridge</td>
                                    <td>JavaScript, Chainlink Functions</td>
                                    <td>350+</td>
                                    <td><span className="badge badge-success">Complete</span></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: '600' }}>Documentation</td>
                                    <td>Markdown</td>
                                    <td>1000+</td>
                                    <td><span className="badge badge-success">Complete</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Performance Metrics Summary */}
                <div className="grid grid-3 mb-6 fade-in">
                    <div className="metric-card">
                        <div className="metric-value">0.88</div>
                        <div className="metric-label">AI Accuracy (R²)</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">9.99%</div>
                        <div className="metric-label">Portfolio Return</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">0.388</div>
                        <div className="metric-label">Sharpe Ratio</div>
                    </div>
                </div>

                {/* Future Roadmap */}
                <div className="card">
                    <h2 className="card-title">Future Roadmap</h2>
                    <div className="card-content">
                        <div className="roadmap">
                            <div className="roadmap-item">
                                <h4>Short Term (1-3 months)</h4>
                                <ul>
                                    <li>Testnet deployment (Sepolia/Goerli)</li>
                                    <li>React frontend dashboard</li>
                                    <li>Comprehensive unit tests</li>
                                    <li>CI/CD pipeline (GitHub Actions)</li>
                                </ul>
                            </div>
                            <div className="roadmap-item">
                                <h4>Medium Term (3-6 months)</h4>
                                <ul>
                                    <li>Security audit (professional firm)</li>
                                    <li>KYC provider integration</li>
                                    <li>Production API deployment</li>
                                    <li>Beta user testing</li>
                                </ul>
                            </div>
                            <div className="roadmap-item">
                                <h4>Long Term (6-12 months)</h4>
                                <ul>
                                    <li>Mainnet deployment</li>
                                    <li>Institutional partnerships</li>
                                    <li>Secondary market (liquidity)</li>
                                    <li>DAO governance</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="phase-nav">
                    <a href="/" className="btn btn-primary">
                        ← Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
}

export default Architecture;
