import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500'

function ModelPerformanceCard({ metrics }) {
  if (!metrics) {
    return <div style={{ height: '200px', background: 'var(--bg-secondary)', borderRadius: '12px', animation: 'shimmer 1.5s infinite' }} />
  }

  const p = metrics.primary_model

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px' }}>{p.name}</h3>
        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
          PRODUCTION
        </span>
      </div>

      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'R² (Test Set)', value: p.r2_test?.toFixed(3), sub: `Train: ${p.r2_train?.toFixed(3)}`, color: '#f59e0b', note: 'Held-out real startups only' },
          { label: p.mape_label || 'Valuation Error', value: `${p.mape_pct?.toFixed(1)}%`, sub: (p.mape_label === 'Median APE') ? 'Median Abs % Error' : 'Mean Abs % Error', color: '#3b82f6', note: 'Consistent with private market uncertainty' },
          {
            label: 'Trust AUC-ROC',
            value: p.auc_roc_report || p.auc_roc?.toFixed(3),
            sub: p.auc_roc_ci_lo
              ? `95% CI: ${p.auc_roc_ci_lo?.toFixed(3)}-${p.auc_roc_ci_hi?.toFixed(3)}`
              : 'Classification quality',
            color: '#8b5cf6',
            note: `Bootstrap n=${p.auc_roc_n_boot || 1000} · binary invest/watch signal`
          },
          { label: 'Leakers Removed', value: p.leakers_removed, sub: `${p.features_used} features used`, color: '#06b6d4', note: 'Prevents data leakage' }
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '14px', border: `1px solid ${m.color}33` }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: m.color }}>{m.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.sub}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{m.note}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Evaluation: </strong>
        {p.split_type} split - {p.train_records?.toLocaleString()} train / {p.test_records?.toLocaleString()} test records. Synthetic records excluded from evaluation.
      </div>

      <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { name: 'CoxPH Survival', metric: `C-Index: ${metrics.survival_model?.c_index}`, color: '#10b981', note: metrics.survival_model?.note },
          { name: 'FinBERT Sentiment', metric: `F1: ${metrics.sentiment_model?.f1_weighted}`, color: '#f59e0b', note: metrics.sentiment_model?.note },
          { name: 'Black-Litterman', metric: `Sharpe: ${metrics.portfolio_model?.sharpe_ratio}`, color: '#8b5cf6', note: metrics.portfolio_model?.note }
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.name}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: m.color }}>{m.metric}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.3' }}>{m.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ModelHub() {
  const [modelMetrics, setModelMetrics] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/models`)
      .then((r) => r.json())
      .then(setModelMetrics)
      .catch(() => {})
  }, [])

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>Model Performance Hub</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Honest evaluation metrics for the production valuation stack and supporting research models.
        </p>
      </div>
      <ModelPerformanceCard metrics={modelMetrics} />
    </div>
  )
}
