import { Brain, Target, TrendingUp, Award } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import './Phase1.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

function Phase1() {
    // Feature importance data from actual valuation_engine.py results
    const featureData = {
        labels: ['Employee Count', 'Funding Amount', 'Revenue', 'Industry', 'Funding Round', 'Founded Year'],
        datasets: [
            {
                label: 'Feature Importance (%)',
                data: [71.3, 16.0, 4.8, 3.2, 2.9, 1.8],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                ],
                borderColor: [
                    'rgb(99, 102, 241)',
                    'rgb(139, 92, 246)',
                    'rgb(6, 182, 212)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)',
                ],
                borderWidth: 2,
            },
        ],
    };

    const chartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'XGBoost Feature Importance Weights',
                color: '#f8fafc',
                font: {
                    size: 18,
                    weight: '600',
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
                    label: (context) => `Importance: ${context.parsed.x}%`,
                },
            },
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    color: '#cbd5e1',
                    callback: (value) => value + '%',
                },
            },
            y: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#cbd5e1',
                    font: {
                        size: 12,
                    },
                },
            },
        },
    };

    return (
        <div className="section">
            <div className="container">
                <div className="section-title fade-in">
                    <h1>
                        <Brain size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '1rem' }} />
                        Phase 1: AI Valuation Engine
                    </h1>
                    <p className="section-subtitle">
                        Machine learning models trained on 50,000 startup records to predict valuations
                        with institutional-grade accuracy using XGBoost and LightGBM ensemble methods.
                    </p>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-3 mb-6 fade-in">
                    <div className="metric-card">
                        <Target size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                        <div className="metric-value">0.874</div>
                        <div className="metric-label">XGBoost R² Score</div>
                    </div>
                    <div className="metric-card">
                        <Award size={32} style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }} />
                        <div className="metric-value">0.887</div>
                        <div className="metric-label">LightGBM R² Score</div>
                    </div>
                    <div className="metric-card">
                        <TrendingUp size={32} style={{ color: 'var(--accent-tertiary)', marginBottom: '1rem' }} />
                        <div className="metric-value">50K</div>
                        <div className="metric-label">Training Records</div>
                    </div>
                </div>

                {/* Model Architecture */}
                <div className="card mb-6 slide-in-left">
                    <h2 className="card-title">Model Architecture</h2>
                    <div className="card-content">
                        <div className="architecture-grid">
                            <div className="arch-item">
                                <h4>Algorithm</h4>
                                <p>Gradient Boosted Trees (XGBoost + LightGBM ensemble)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Features</h4>
                                <p>6 predictive variables (employee count, funding, revenue, industry, round, year)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Target</h4>
                                <p>Estimated valuation (USD)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Split</h4>
                                <p>80% training / 20% testing (random_state=42)</p>
                            </div>
                            <div className="arch-item">
                                <h4>Encoding</h4>
                                <p>LabelEncoder for categorical variables</p>
                            </div>
                            <div className="arch-item">
                                <h4>Performance</h4>
                                <p>MAE: $878M | RMSE: $2.8B (LightGBM)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature Importance Chart */}
                <div className="card mb-6 fade-in">
                    <div className="chart-container">
                        <Bar data={featureData} options={chartOptions} />
                    </div>
                    <div className="chart-insight">
                        <h4>Key Insight</h4>
                        <p>
                            <strong>Employee count</strong> dominates with 71.3% importance, indicating that team size
                            is the strongest predictor of startup valuation. This aligns with VC industry wisdom:
                            "Invest in teams, not just ideas."
                        </p>
                    </div>
                </div>

                {/* Code Sample */}
                <div className="card slide-in-left">
                    <h2 className="card-title">Model Training (Excerpt)</h2>
                    <div className="code-block">
                        <pre>{`# XGBoost Model
xgb_model = xgb.XGBRegressor(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=7,
    random_state=42
)
xgb_model.fit(X_train, y_train)

# LightGBM Model  
lgbm_model = lgb.LGBMRegressor(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=7,
    random_state=42
)
lgbm_model.fit(X_train, y_train)

# Performance
r2_xgb = r2_score(y_test, xgb_pred)   # 0.874
r2_lgbm = r2_score(y_test, lgbm_pred)  # 0.887`}</pre>
                    </div>
                </div>

                {/* Navigation */}
                <div className="phase-nav">
                    <a href="/phase2-finance" className="btn btn-primary">
                        Next: Finance Domain →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default Phase1;
