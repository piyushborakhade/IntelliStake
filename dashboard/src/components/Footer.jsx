import './Architecture.css';

function Footer() {
    return (
        <footer style={{
            background: 'var(--bg-secondary)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '3rem 0',
            marginTop: '4rem'
        }}>
            <div className="container">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '2rem',
                    marginBottom: '2rem'
                }}>
                    <div>
                        <h3 style={{
                            fontSize: '1.5rem',
                            marginBottom: '1rem',
                            background: 'var(--gradient-hero)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            IntelliStake
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                            AI-Driven Decentralized Venture Capital Platform
                        </p>
                    </div>

                    <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Quick Links</h4>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <a href="/phase1" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>AI Valuation</a>
                            </li>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <a href="/phase2-finance" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Portfolio Optimization</a>
                            </li>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <a href="/phase2-blockchain" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Blockchain</a>
                            </li>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <a href="/architecture" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Architecture</a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Project Info</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <strong>Course:</strong> MBA (Tech) Capstone
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <strong>Institution:</strong> NMIMS University
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            <strong>Completion:</strong> February 2026
                        </p>
                    </div>
                </div>

                <div style={{
                    paddingTop: '2rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem'
                }}>
                    <p>© 2026 IntelliStake. Built for academic demonstration purposes.</p>
                    <p style={{ marginTop: '0.5rem' }}>
                        <span className="text-gradient" style={{ fontWeight: '600' }}>
                            Phase 1 & Phase 2 Complete
                        </span> • Ready for Final Review
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
