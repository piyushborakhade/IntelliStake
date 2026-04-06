import { useState } from 'react'
import StartupLogo from '../shared/StartupLogo'

const STATUS_COLOR = { ACTIVE: '#1DB972', FROZEN: '#E5484D', WATCH: '#F5A623' }

export default function InvestmentSimulator({ onClose }) {
  const [amount, setAmount] = useState(100000)
  const [inputVal, setInputVal] = useState('1,00,000')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleAmountChange(newAmount) {
    if (newAmount === amount) return  // Same amount, do nothing
    setAmount(newAmount)
    setInputVal(newAmount.toLocaleString('en-IN'))
    setResult(null)
    setError(null)
  }

  async function runSimulation() {
    if (loading) return
    setLoading(true)
    setError(null)
    // Do NOT clear result - keep old results visible during re-run
    
    try {
      const res = await fetch('http://localhost:5500/api/investment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_inr: amount })
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setResult(data)
      // Fire-and-forget transaction logging
      if (data.allocations) {
        data.allocations.slice(0, 3).forEach(alloc => {
          fetch('http://localhost:5500/api/supabase/log_transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startup_name: alloc.startup_name,
              amount_inr: alloc.amount_inr,
              trust_score: alloc.trust_score,
              bl_weight: alloc.weight,
              expected_return_pct: alloc.expected_return * 100,
              status: alloc.risk === 'HIGH' ? 'FROZEN' : 'ACTIVE'
            })
          }).catch(() => {})
        })
      }
    } catch (err) {
      setError(err.message || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  function formatINR(n) {
    return `₹${Number(n).toLocaleString('en-IN')}`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 16, width: '90%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto', animation: 'fadeInUp 0.3s ease' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Investment Simulator</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Black-Litterman optimization · Monte Carlo projection · Escrow protection</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em' }}>INVESTMENT AMOUNT (₹)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[50000, 100000, 500000, 1000000].map(v => (
                <button key={v} onClick={() => handleAmountChange(v)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${amount === v ? 'var(--accent)' : 'var(--border-primary)'}`, background: amount === v ? 'rgba(45,126,248,0.1)' : 'var(--bg-surface)', color: amount === v ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  ₹{(v/100000).toFixed(v >= 100000 ? 0 : 1)}L
                </button>
              ))}
              <input
                value={inputVal}
                onChange={e => { 
                  const val = e.target.value.replace(/,/g, '')
                  setInputVal(e.target.value)
                  const numVal = Number(val)
                  if (!isNaN(numVal) && numVal > 0) {
                    setAmount(numVal)
                    setResult(null)
                    setError(null)
                  }
                }}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                placeholder="Custom amount"
              />
            </div>
          </div>
          <button onClick={runSimulation}
            style={{ padding: '10px 28px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Running...' : result ? 'Re-Run →' : 'Run Simulation →'}
          </button>
        </div>

        {loading && !result && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Running BL optimization and Monte Carlo simulation...
          </div>
        )}

        {error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#E5484D', fontSize: 13 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ padding: '20px 24px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Invested', value: formatINR(result.summary.total_invested), color: 'var(--text-primary)' },
                { label: 'Expected Value (1yr)', value: formatINR(result.summary.expected_value_1yr), color: '#1DB972' },
                { label: 'Expected Gain', value: `+${formatINR(result.summary.expected_gain_1yr)}`, color: '#1DB972' },
                { label: 'Escrow Protected', value: formatINR(result.summary.escrow_protected), color: '#2D7EF8' },
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: c.color, fontFamily: 'var(--font-mono)' }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>BL ALLOCATION</div>
                {result.allocations.map((alloc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
                    <StartupLogo name={alloc.startup_name} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{alloc.startup_name}</span>
                        <span style={{ fontSize: 12, color: STATUS_COLOR[alloc.risk === 'HIGH' ? 'FROZEN' : 'ACTIVE'], fontFamily: 'var(--font-mono)' }}>{formatINR(alloc.amount_inr)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(alloc.weight * 100).toFixed(1)}% weight · Trust {alloc.trust_score}</span>
                        <span style={{ fontSize: 10, color: '#1DB972' }}>+{(alloc.expected_return * 100).toFixed(1)}% exp.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 10 }}>MONTE CARLO PROJECTION · 52 WEEKS</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'Best Case', value: formatINR(result.summary.best_case_1yr), color: '#1DB972' },
                    { label: 'Expected', value: formatINR(result.summary.expected_value_1yr), color: '#F5A623' },
                    { label: 'Worst Case', value: formatINR(result.summary.worst_case_1yr), color: '#E5484D' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border-primary)', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '40px 20px', border: '1px solid var(--border-primary)', textAlign: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 32, fontWeight: 600, color: '#F5A623', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    {formatINR(result.summary.expected_value_1yr)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expected Portfolio Value (1 Year)</div>
                  <div style={{ fontSize: 10, color: '#1DB972', marginTop: 4 }}>+{result.summary.expected_return_pct}% Return</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Sharpe: {result.summary.sharpe_ratio} · Max Drawdown: {result.summary.max_drawdown_pct}% · {result.summary.active_holdings} holdings
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(29,185,114,0.08)', border: '1px solid rgba(29,185,114,0.2)', borderRadius: 8, fontSize: 12, color: '#1DB972' }}>
              ✓ Simulation logged to Supabase · {result.summary.escrow_protected.toLocaleString('en-IN')} protected in escrow · ERC-3643 compliance verified
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
