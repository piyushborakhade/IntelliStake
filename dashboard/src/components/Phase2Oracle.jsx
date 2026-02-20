import './Phase2Blockchain.css';
import { Link2, Zap, RefreshCw, AlertTriangle } from 'lucide-react';

function Phase2Oracle() {
    return (
        <div className="section">
            <div className="container">
                <div className="section-title fade-in">
                    <h1>
                        <Link2 size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '1rem' }} />
                        Phase 2: Oracle Integration
                    </h1>
                    <p className="section-subtitle">
                        Chainlink Functions-based oracle network bridging off-chain AI/Finance computations
                        to on-chain smart contract execution with cryptographic security.
                    </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-3 mb-6 fade-in">
                    <div className="metric-card">
                        <Zap size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                        <div className="metric-value">~15s</div>
                        <div className="metric-label">Request Latency</div>
                    </div>
                    <div className="metric-card">
                        <RefreshCw size={32} style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }} />
                        <div className="metric-value">3x</div>
                        <div className="metric-label">Retry Attempts</div>
                    </div>
                    <div className="metric-card">
                        <AlertTriangle size={32} style={{ color: 'var(--accent-tertiary)', marginBottom: '1rem' }} />
                        <div className="metric-value">>99%</div>
                        <div className="metric-label">Success Rate</div>
                    </div>
                </div>

                {/* Data Flow */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Oracle Data Flow</h2>
                    <div className="card-content">
                        <div className="oracle-flow">
                            <div className="oracle-step">
                                <div className="oracle-icon" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
                                    <span>🐍</span>
                                </div>
                                <h4>Python ML Service</h4>
                                <p>Flask API serving predictions</p>
                            </div>

                            <div className="oracle-connector">
                                <div className="connector-line"></div>
                                <div className="connector-label">HTTP GET</div>
                            </div>

                            <div className="oracle-step">
                                <div className="oracle-icon" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
                                    <span>📡</span>
                                </div>
                                <h4>Chainlink Functions</h4>
                                <p>JavaScript execution (IntelliStakeOracle.js)</p>
                            </div>

                            <div className="oracle-connector">
                                <div className="connector-line"></div>
                                <div className="connector-label">Validate & Encode</div>
                            </div>

                            <div className="oracle-step">
                                <div className="oracle-icon" style={{ background: 'rgba(6, 182, 212, 0.2)' }}>
                                    <span>🌐</span>
                                </div>
                                <h4>Decentralized Oracle Network</h4>
                                <p>Multiple nodes verify data</p>
                            </div>

                            <div className="oracle-connector">
                                <div className="connector-line"></div>
                                <div className="connector-label">On-chain TX</div>
                            </div>

                            <div className="oracle-step">
                                <div className="oracle-icon" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                                    <span>⛓️</span>
                                </div>
                                <h4>Smart Contract</h4>
                                <p>fulfillValuation() callback</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Handling */}
                <div className="card mb-6 fade-in">
                    <h2 className="card-title">Reliability Features</h2>
                    <div className="card-content">
                        <div className="grid grid-2">
                            <div className="reliability-item">
                                <h4>🔄 Retry Logic</h4>
                                <p>Exponential backoff with 3 attempts (1s, 2s, 4s delays)</p>
                            </div>
                            <div className="reliability-item">
                                <h4>⏱️ Timeout Protection</h4>
                                <p>5-second API timeout prevents hanging requests</p>
                            </div>
                            <div className="reliability-item">
                                <h4>🛑 Circuit Breaker</h4>
                                <p>Stops requests after 5 consecutive failures</p>
                            </div>
                            <div className="reliability-item">
                                <h4>✅ Data Validation</h4>
                                <p>Schema verification before EVM encoding</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* EVM Encoding */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">EVM Encoding Example</h2>
                    <div className="card-content">
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            Ethereum doesn't support floating-point numbers. We scale by 10^18 for precision:
                        </p>
                        <div className="encoding-example">
                            <div className="encoding-row">
                                <span className="encoding-label">Valuation:</span>
                                <span className="encoding-before">$15,000,000.00</span>
                                <span className="encoding-arrow">→</span>
                                <span className="encoding-after">15000000 × 10^18</span>
                            </div>
                            <div className="encoding-row">
                                <span className="encoding-label">Confidence:</span>
                                <span className="encoding-before">0.88</span>
                                <span className="encoding-arrow">→</span>
                                <span className="encoding-after">880000000000000000</span>
                            </div>
                            <div className="encoding-row">
                                <span className="encoding-label">Timestamp:</span>
                                <span className="encoding-before">Feb 10, 2026</span>
                                <span className="encoding-arrow">→</span>
                                <span className="encoding-after">1707619200 (Unix)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Code Sample */}
                <div className="card">
                    <h2 className="card-title">Oracle Script Code (Excerpt)</h2>
                    <div className="code-block">
                        <pre>{`// Fetch with Retry Logic (Exponential Backoff)
async function fetchWithRetry(url, attempt = 1) {
    try {
        const response = await Functions.makeHttpRequest({
            url: url,
            method: "GET",
            headers: {
                "Authorization": \`Bearer \${API_KEY}\`,
                "Content-Type": "application/json"
            },
            timeout: 5000
        });
        
        if (response.status !== 200) {
            throw new Error(\`HTTP \${response.status}\`);
        }
        
        return response.data;
    } catch (error) {
        if (attempt < 3) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, attempt + 1);
        }
        throw error;
    }
}

// EVM Encoding (Float → Uint256)
function floatToSolidityInt(value) {
    const SCALING_FACTOR = BigInt(10 ** 18);
    return BigInt(Math.floor(value * Number(SCALING_FACTOR))).toString();
}`}</pre>
                    </div>
                </div>

                <div className="phase-nav">
                    <a href="/architecture" className="btn btn-primary">
                        Next: Complete Architecture →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default Phase2Oracle;
