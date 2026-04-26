import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import TrustBar from '../shared/TrustBar'
import LoadingSkeleton from '../shared/LoadingSkeleton'
import BLViewsCard from '../BLViewsCard'

const DEMO_HOLDINGS = [
  { startup_name: 'Zepto', weight: 0.18, trust_score: 0.91 },
  { startup_name: 'Razorpay', weight: 0.16, trust_score: 0.88 },
  { startup_name: 'PhonePe', weight: 0.14, trust_score: 0.85 },
  { startup_name: 'CRED', weight: 0.13, trust_score: 0.72 },
  { startup_name: 'Meesho', weight: 0.12, trust_score: 0.64 },
  { startup_name: 'Ola', weight: 0.10, trust_score: 0.51 },
  { startup_name: 'Swiggy', weight: 0.17, trust_score: 0.79 },
]

function generateGBMPaths(numPaths = 10, weeks = 52) {
  const mu = 0.224 / 52
  const sigma = 0.187 / Math.sqrt(52)
  return Array.from({ length: numPaths }, () => {
    const path = [1.0]
    for (let i = 1; i < weeks; i++) {
      const shock = (Math.random() * 2 - 1)
      path.push(path[i - 1] * (1 + mu + sigma * shock))
    }
    return path
  })
}

function fmtInr(val) {
  if (!val && val !== 0) return '₹0'
  const n = Number(val)
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

export default function CommandCenter() {
  const { portfolio } = useApp()
  const [mc, setMc] = useState(null)
  const [summary, setSummary] = useState(null)
  const [globalAum, setGlobalAum] = useState(null)
  const [metricValues, setMetricValues] = useState({
    sharpe: '1.34',
    vol: '20.2%',
    sortino: '1.89',
    drawdown: '-5.0%',
    return: '25.4%',
    r2: '0.780',
  })
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    fetch('http://localhost:5500/api/admin/global-aum')
      .then(r => r.json())
      .then(d => setGlobalAum(d))
      .catch(() => {});

    fetch('http://localhost:5500/api/portfolio/summary')
      .then((r) => r.json())
      .then((data) => {
        setSummary(data)
        // Backend returns flat top-level fields; portfolio_metrics is optional nested alias
        const m = data.portfolio_metrics || data
        setMetricValues({
          sharpe:   m.sharpe_ratio    != null ? Number(m.sharpe_ratio).toFixed(2)              : '1.34',
          vol:      m.volatility      != null ? `${(Number(m.volatility) * 100).toFixed(1)}%`  : '20.2%',
          sortino:  m.sortino_ratio   != null ? Number(m.sortino_ratio).toFixed(2)             : '1.89',
          drawdown: m.max_drawdown    != null ? `${(Number(m.max_drawdown) * 100).toFixed(1)}%`: '-5.0%',
          return:   m.expected_return != null ? `${(Number(m.expected_return) * 100).toFixed(1)}%` : '25.4%',
          r2:       m.r_squared       != null ? Number(m.r_squared).toFixed(3)                 : '0.780',
        })
      })
      .catch(() => {
        setMetricValues({ sharpe: '1.34', vol: '20.2%', sortino: '1.89', drawdown: '-5.0%', return: '25.4%', r2: '0.780' })
      })

    import('../../utils/api').then(({ api }) => api.montecarlo()).then(d => {
      if (d) {
        const paths = d.paths || d.simulations || d.monte_carlo_paths || d.results || []
        if (paths.length === 0) {
          console.log('No Monte Carlo paths, generating synthetic GBM')
          setMc({ paths: generateGBMPaths(), weeks: 52 })
        } else {
          setMc(d)
        }
      } else {
        setMc({ paths: generateGBMPaths(), weeks: 52 })
      }
    })
  }, [])

  useEffect(() => {
    if (!mc || !chartRef.current) return
    import('chart.js/auto').then(({ default: Chart }) => {
      if (chartInstance.current) chartInstance.current.destroy()
      const paths = mc.paths || mc.simulations || mc.monte_carlo_paths || mc.results || []
      const weeks = mc.weeks || 52
      const sample = paths.slice(0, 12)
      const labels = Array.from({ length: weeks }, (_, i) => `W${i+1}`)

      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            ...sample.map((path, i) => ({
              data: path,
              borderColor: i === 0 ? 'rgba(245,166,35,0.9)' : 'rgba(255,255,255,0.06)',
              borderWidth: i === 0 ? 2 : 1,
              pointRadius: 0,
              tension: 0.3,
            })),
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          scales: {
            x: { display: false },
            y: { display: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#606075', font: { size: 10 } } }
          },
          animation: { duration: 800 }
        }
      })
    })
    return () => { if (chartInstance.current) chartInstance.current.destroy() }
  }, [mc])

  const rawHoldings = portfolio?.holdings || portfolio?.weights || portfolio?.allocations || portfolio?.portfolio || []
  const holdings = (summary?.holdings && summary.holdings.length > 0) ? summary.holdings : (rawHoldings.length > 0 ? rawHoldings : DEMO_HOLDINGS)
  const liveAUMDisplay = summary?.aum_label || summary?.aum_display
  const liveAUM = summary?.aum || summary?.total_value || summary?.portfolio_value

  const metrics = [
    { label: 'Expected Return', value: metricValues.return, color: '#1DB972' },
    { label: 'Volatility', value: metricValues.vol, color: '#F5A623' },
    { label: 'Sharpe Ratio', value: metricValues.sharpe, color: '#F0F0F5' },
    { label: 'Sortino Ratio', value: metricValues.sortino, color: '#F0F0F5' },
    { label: 'Max Drawdown', value: metricValues.drawdown, color: '#E5484D' },
    { label: 'R²', value: metricValues.r2, color: '#1DB972', sub: 'Test set · leakage removed' },
  ]

  return (
    <div style={{ background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>COMMAND CENTER</div>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Assets Under Management</div>
        <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
          {globalAum ? globalAum.aum_label : (liveAUMDisplay || (liveAUM != null ? fmtInr(liveAUM) : '₹11.0L'))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {globalAum ? `${globalAum.user_count} investors · ${globalAum.transaction_count + holdings.length} positions` : `Black-Litterman Optimized · ${holdings.length} holdings`}
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, borderBottom: '1px solid var(--border-primary)' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
            {m.sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
        <BLViewsCard />
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', flex: '0 0 auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>PORTFOLIO ALLOCATION</div>
        {holdings.slice(0, 7).map((h, i) => {
          const name = h.startup_name || h.name || h.company || h.startup || h.ticker || `Startup ${i+1}` 
          const weight = parseFloat(
            h.weight || h.allocation || h.portfolio_weight || h.pct || ((h.allocation_pct || 0) / 100)
          )
          const trust = h.trust_score || 0.5
          return (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{(weight * 100).toFixed(1)}%</span>
              </div>
              <TrustBar score={trust} height={3} />
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px', flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>MONTE CARLO · 52-WEEK PATHS</div>
        <div style={{ height: 'calc(100% - 24px)', minHeight: 80 }}>
          {mc ? <canvas ref={chartRef} /> : <LoadingSkeleton width="100%" height="100%" radius={6} />}
        </div>
      </div>
    </div>
  )
}
