import { Link } from 'react-router-dom';
import { Brain, TrendingUp, Shield, ChevronRight, Sparkles } from 'lucide-react';
import './Hero.css';

function Hero() {
    return (
        <div className="hero-section">
            <div className="hero-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="container hero-container">
                <div className="hero-content fade-in">
                    <div className="hero-badge">
                        <Sparkles size={16} />
                        <span>Phase 1 & 2 Complete • Ready for Review</span>
                    </div>

                    <h1 className="hero-title">
                        IntelliStake
                        <span className="hero-subtitle">AI-Driven Decentralized Venture Capital</span>
                    </h1>

                    <p className="hero-description">
                        A comprehensive three-domain platform integrating <strong>Artificial Intelligence</strong>,
                        <strong> Quantitative Finance</strong>, and <strong>Blockchain Technology</strong> to
                        democratize startup investing with institutional-grade tools.
                    </p>

                    <div className="hero-stats">
                        <div className="stat-item">
                            <div className="stat-value">0.88</div>
                            <div className="stat-label">R² Score</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">9.99%</div>
                            <div className="stat-label">Expected Return</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">ERC-3643</div>
                            <div className="stat-label">Compliance</div>
                        </div>
                    </div>

                    <Link to="/phase1" className="btn btn-primary btn-hero">
                        Begin Walkthrough
                        <ChevronRight size={20} />
                    </Link>
                </div>

                <div className="domain-cards slide-in-left">
                    <h2 className="cards-title">Three-Domain Architecture</h2>

                    <div className="domain-grid">
                        <Link to="/phase1" className="domain-card">
                            <div className="domain-icon ai">
                                <Brain size={32} />
                            </div>
                            <h3>AI Domain</h3>
                            <p>Machine learning models (XGBoost + LightGBM) predict startup valuations with 87-89% accuracy on 50,000 records.</p>
                            <div className="domain-badge badge-primary">Phase 1 Complete</div>
                        </Link>

                        <Link to="/phase2-finance" className="domain-card">
                            <div className="domain-icon finance">
                                <TrendingUp size={32} />
                            </div>
                            <h3>Finance Domain</h3>
                            <p>Black-Litterman portfolio optimization combining AI predictions with market equilibrium for optimal allocations.</p>
                            <div className="domain-badge badge-success">Phase 2 Complete</div>
                        </Link>

                        <Link to="/phase2-blockchain" className="domain-card">
                            <div className="domain-icon blockchain">
                                <Shield size={32} />
                            </div>
                            <h3>Blockchain Domain</h3>
                            <p>ERC-3643 compliant security tokens with KYC verification, accredited investor checks, and milestone-based escrow.</p>
                            <div className="domain-badge badge-success">Phase 2 Complete</div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Hero;
