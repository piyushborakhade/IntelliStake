import { TrendingUp, PieChart, Activity, DollarSign } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useState, useEffect } from 'react';
import Papa from 'papaparse';

ChartJS.register(ArcElement, Tooltip, Legend);

function Phase2Finance() {
    const [portfolioData, setPortfolioData] = useState(null);
    const [topHoldings, setTopHoldings] = useState([]);

    useEffect(() => {
        // Load the investment_recommendations.csv file
        fetch('/Phase_2_Dev/investment_recommendations.csv')
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    complete: (result) => {
                        const data = result.data.filter((row) => row.allocation_percentage > 0);
                        const top10 = data.slice(0, 10);
                        setTopHoldings(top10);

                        // Prepare chart data
                        const labels = top10.map((row) => row.startup_name || 'Unknown');
                        const values = top10.map((row) => row.allocation_percentage || 0);

                        setPortfolioData({
                            labels,
                            datasets: [
                                {
                                    data: values,
                                    backgroundColor: [
                                        'rgba(99, 102, 241, 0.8)',
                                        'rgba(139, 92, 246, 0.8)',
                                        'rgba(6, 182, 212, 0.8)',
                                        'rgba(16, 185, 129, 0.8)',
                                        'rgba(245, 158, 11, 0.8)',
                                        'rgba(239, 68, 68, 0.8)',
                                        'rgba(236, 72, 153, 0.8)',
                                        'rgba(168, 85, 247, 0.8)',
                                        'rgba(59, 130, 246, 0.8)',
                                        'rgba(34, 197, 94, 0.8)',
                                    ],
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    borderWidth: 2,
                                },
                            ],
                        });
                    },
                });
            })
            .catch((error) => {
                console.error('Error loading CSV:', error);
                // Fallback data if CSV fails to load
                setTopHoldings([
                    { startup_name: 'Jensen-Garcia', allocation_percentage: 13.91, expected_return_pct: 9.96, risk_score: 85.06 },
                    { startup_name: 'Jarvis Ltd', allocation_percentage: 7.15, expected_return_pct: 10.12, risk_score: 92.51 },
                    { startup_name: 'Garcia-Ryan', allocation_percentage: 6.05, expected_return_pct: 10.45, risk_score: 97.04 },
                ]);
            });
    }, []);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: '#cbd5e1',
                    padding: 15,
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(18, 23, 46, 0.95)',
                titleColor: '#f8fafc',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(99, 102, 241, 0.5)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    label: (context) => `${context.label}: ${context.parsed.toFixed(2)}%`,
                },
            },
        },
    };

    return (
        <div className="section">
            <div className="container">
                <div className="section-title fade-in">
                    <h1>
                        <TrendingUp size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '1rem' }} />
                        Phase 2: Finance Domain
                    </h1>
                    <p className="section-subtitle">
                        Black-Litterman portfolio optimization combining AI predictions with market equilibrium
                        to generate risk-adjusted asset allocations.
                    </p>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-3 mb-6 fade-in">
                    <div className="metric-card">
                        <Activity size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                        <div className="metric-value">9.99%</div>
                        <div className="metric-label">Expected Return</div>
                    </div>
                    <div className="metric-card">
                        <PieChart size={32} style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }} />
                        <div className="metric-value">18.02%</div>
                        <div className="metric-label">Portfolio Volatility</div>
                    </div>
                    <div className="metric-card">
                        <DollarSign size={32} style={{ color: 'var(--accent-tertiary)', marginBottom: '1rem' }} />
                        <div className="metric-value">0.388</div>
                        <div className="metric-label">Sharpe Ratio</div>
                    </div>
                </div>

                {/* Black-Litterman Formula */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Black-Litterman Methodology</h2>
                    <div className="card-content">
                        <p style={{ marginBottom: '1.5rem' }}>
                            The Black-Litterman model combines market equilibrium returns (CAPM) with subjective investor views
                            (AI predictions) using Bayesian statistics to produce robust posterior expected returns.
                        </p>

                        <div className="formula-box">
                            <h4>Posterior Returns Formula:</h4>
                            <div className="formula">
                                E[R] = [(τΣ)⁻¹ + P'Ω⁻¹P]⁻¹ × [(τΣ)⁻¹Π + P'Ω⁻¹Q]
                            </div>
                            <div className="formula-legend">
                                <div><strong>Π:</strong> Market equilibrium returns (CAPM prior)</div>
                                <div><strong>Q:</strong> AI-predicted returns (investor views)</div>
                                <div><strong>Ω:</strong> View uncertainty matrix</div>
                                <div><strong>τ:</strong> Uncertainty in prior (0.05)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Allocation Chart */}
                {portfolioData && (
                    <div className="card mb-6 fade-in">
                        <h2 className="card-title">Top 10 Portfolio Allocations</h2>
                        <div className="chart-container">
                            <Pie data={portfolioData} options={chartOptions} />
                        </div>
                    </div>
                )}

                {/* Investment Recommendations Table */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Investment Recommendations</h2>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Startup</th>
                                    <th>Allocation</th>
                                    <th>Expected Return</th>
                                    <th>Risk Score</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topHoldings.map((holding, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                            {holding.startup_name}
                                        </td>
                                        <td>
                                            <span className="text-gradient" style={{ fontWeight: '700' }}>
                                                {holding.allocation_percentage?.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td>{holding.expected_return_pct?.toFixed(2)}%</td>
                                        <td>
                                            <span style={{
                                                color: holding.risk_score > 90 ? 'var(--accent-warning)' : 'var(--accent-success)'
                                            }}>
                                                {holding.risk_score?.toFixed(0)}/100
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-success">INVEST</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Code Sample */}
                <div className="card">
                    <h2 className="card-title">Optimization Code (Excerpt)</h2>
                    <div className="code-block">
                        <pre>{`# Calculate Posterior Returns (Black-Litterman)
tau_sigma_inv = np.linalg.inv(tau * covariance)
omega_inv = np.linalg.inv(Omega)

combined_precision = tau_sigma_inv + P.T @ omega_inv @ P
combined_returns = tau_sigma_inv @ equilibrium + P.T @ omega_inv @ Q

posterior_returns = np.linalg.inv(combined_precision) @ combined_returns

# Mean-Variance Optimization
def objective(w):
    return -(w @ posterior_returns - (delta/2) * w @ covariance @ w)

result = minimize(objective, w0, method='SLSQP',
                  bounds=bounds, constraints=constraints)`}</pre>
                    </div>
                </div>

                <div className="phase-nav">
                    <a href="/phase2-blockchain" className="btn btn-primary">
                        Next: Blockchain Domain →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default Phase2Finance;
