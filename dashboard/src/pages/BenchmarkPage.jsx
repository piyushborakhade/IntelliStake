import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500'

function CustomBar(props) {
  const { fill, x, y, width, height } = props
  return <rect x={x} y={y} width={width} height={Math.max(height, 0)} fill={fill} rx={4} />
}

function MetricCard({ label, value, color, note }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: `1px solid ${color}33`,
      borderRadius: '10px', padding: '16px'
    }}>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '4px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{note}</div>
    </div>
  )
}

function BenchmarkChart({ title, subtitle, data, xKey, xFormatter, refLineVal, refLineLabel, height = 280 }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '24px', marginBottom: '24px'
    }}>
      <h3 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '15px' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 20px' }}>{subtitle}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 70 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={xFormatter}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            type="category" dataKey="name" width={200}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <Tooltip
            formatter={(v) => [xFormatter(v), xKey === 'auc' ? 'AUC-ROC' : 'Median APE']}
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px' }}
            labelStyle={{ color: 'var(--text-primary)' }}
          />
          {refLineVal != null && (
            <ReferenceLine
              x={refLineVal}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: refLineLabel, fill: '#6b7280', fontSize: 10 }}
            />
          )}
          <Bar
            dataKey={xKey}
            shape={<CustomBar />}
            label={{ position: 'right', fill: 'var(--text-secondary)', fontSize: 11, formatter: xFormatter }}
          >
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function BenchmarkPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/benchmarks`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Loading benchmark data...
      </div>
    )
  }

  const s = data?.summary || {}

  const trustData = (data?.trust_score_comparisons || []).map(d => ({
    name: d.name,
    auc: parseFloat((d.auc * 100).toFixed(1)),
    fill: d.color,
  }))

  const valData = (data?.valuation_benchmarks || []).map(d => ({
    name: d.name,
    median_ape: d.median_ape,
    fill: d.color,
  }))

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700', margin: 0 }}>
          Model Benchmark Comparison
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          IntelliStake ensemble vs naive baselines, rule-based systems, and published academic benchmarks
        </p>
      </div>

      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <MetricCard label="Our AUC-ROC"       value={s.our_auc?.toFixed(3)}                         color="#10b981" note="Trust score classifier" />
          <MetricCard label="Best Baseline AUC" value={s.best_baseline_auc?.toFixed(3)}               color="#f59e0b" note="Logistic regression" />
          <MetricCard label="Lift Over Baseline" value={`+${data.lift_over_best_baseline_pp?.toFixed(1)}pp`} color="#10b981" note="Percentage points" />
          <MetricCard label="Our Median APE"    value={`${s.our_median_ape}%`}                        color="#3b82f6" note="vs VC analysts ~65%" />
        </div>
      )}

      <BenchmarkChart
        title="Trust Score Classification — AUC-ROC Comparison"
        subtitle="Higher is better. Random baseline = 0.500. Evaluated on held-out real startup records (is_real=True) only."
        data={trustData}
        xKey="auc"
        xFormatter={v => `${v}%`}
        refLineVal={50}
        refLineLabel="Random"
        height={280}
      />

      <BenchmarkChart
        title="Valuation Accuracy — Median APE Comparison"
        subtitle="Lower is better. VC analyst benchmark from Gornall & Strebulaev (2020), Journal of Financial Economics."
        data={valData}
        xKey="median_ape"
        xFormatter={v => `${v}%`}
        height={240}
      />

      <div style={{
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: '8px', padding: '16px', marginBottom: '20px',
        fontSize: '12px', color: 'var(--text-secondary)'
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Academic benchmark: </strong>
        {data?.academic_reference} — Professional VC analysts achieve Median APE of ~65% on private startup
        valuations due to information asymmetry, complex cap structures, and market illiquidity.
        IntelliStake performs within this range using only publicly available signals.
      </div>

      {data?.defense_statement && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '8px', padding: '16px', fontSize: '12px', color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: '#10b981' }}>Defense statement: </strong>
          {data.defense_statement}
        </div>
      )}
    </div>
  )
}
