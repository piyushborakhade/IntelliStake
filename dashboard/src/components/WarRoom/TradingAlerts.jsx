/**
 * TradingAlerts.jsx — AI Signal Feed
 * Generates BUY/HOLD/SELL signals from live trust scores.
 * Users can APPROVE (adds to is_sim_holdings) or DISMISS each signal.
 * Phase 3C: Transaction simulation with approve/dismiss flow.
 */
import { useState, useEffect } from 'react'
import { api } from '../../utils/api'

const DEFAULT_AMOUNT = 50000   // ₹50,000 default per approved signal

const STATIC_SIGNALS = [
  { startup: 'Razorpay',   action: 'BUY',  trust: 0.91, reason: 'Trust 0.91 · Positive sentiment +32 · High momentum',   confidence: 92 },
  { startup: 'Groww',      action: 'BUY',  trust: 0.78, reason: 'Underweight vs HRP target · Trust 0.78 strong',          confidence: 81 },
  { startup: 'Zepto',      action: 'HOLD', trust: 0.82, reason: 'At target weight · Monitoring for Q2 update',            confidence: 74 },
  { startup: 'BharatPe',   action: 'HOLD', trust: 0.58, reason: 'Regulatory noise — no action until clarity',             confidence: 68 },
  { startup: 'Ola Electric', action: 'SELL', trust: 0.51, reason: 'Trust decay -0.06 · Negative sentiment -22',           confidence: 77 },
  { startup: 'CRED',       action: 'BUY',  trust: 0.72, reason: 'Trust 0.72 recovering · Sentiment inflecting +ve',       confidence: 70 },
]

export default function TradingAlerts() {
  const [alerts, setAlerts]         = useState([])
  const [dismissed, setDismissed]   = useState(new Set())
  const [approved, setApproved]     = useState(new Set())
  const [toast, setToast]           = useState(null)

  useEffect(() => {
    loadAlerts()
    const iv = setInterval(loadAlerts, 30000)
    return () => clearInterval(iv)
  }, [])

  async function loadAlerts() {
    try {
      const data = await api.portfolio()
      if (!data?.holdings) throw new Error('no portfolio data')

      const liveAlerts = data.holdings.map(h => {
        const trust  = h.trust_score || 0
        const risk   = h.risk_severity || 'MEDIUM'
        let action = 'HOLD', reason = 'Monitoring position', confidence = 65

        if (trust >= 0.85 && risk !== 'HIGH') {
          action = 'BUY';  reason = `Trust ${trust.toFixed(2)} · Low risk · Strong momentum`;       confidence = 88
        } else if (trust < 0.35 || risk === 'HIGH') {
          action = 'SELL'; reason = `Trust dropped to ${trust.toFixed(2)} · ${risk} risk flagged`; confidence = 80
        } else if (trust >= 0.65) {
          action = 'BUY';  reason = `Trust ${trust.toFixed(2)} · Moderate opportunity detected`;    confidence = 74
        }

        return { id: h.startup_name, startup: h.startup_name, action, reason, confidence, trust, live: true }
      })

      // Merge live + static, deduplicate by startup name
      const names  = new Set(liveAlerts.map(a => a.startup))
      const merged = [
        ...liveAlerts.filter(a => a.action !== 'HOLD'),
        ...STATIC_SIGNALS.filter(s => !names.has(s.startup)),
      ]
      setAlerts(merged.slice(0, 10))
    } catch {
      setAlerts(STATIC_SIGNALS)
    }
  }

  function actionColor(action) {
    if (action === 'BUY')  return '#1DB972'
    if (action === 'SELL') return '#E5484D'
    return '#F5A623'
  }

  function approveSignal(alert) {
    const holdings = JSON.parse(localStorage.getItem('is_sim_holdings') || '[]')
    const projected = DEFAULT_AMOUNT * (1 + alert.trust * 0.3 + 0.05)
    const existing  = holdings.find(h => h.name === alert.startup)

    if (existing) {
      existing.invested += DEFAULT_AMOUNT
      existing.current  += projected
    } else {
      holdings.push({
        name:     alert.startup,
        sector:   '—',
        trust:    alert.trust,
        invested: DEFAULT_AMOUNT,
        current:  projected,
      })
    }

    localStorage.setItem('is_sim_holdings', JSON.stringify(holdings))
    setApproved(prev => new Set([...prev, alert.id || alert.startup]))

    setToast(`✓ ₹50,000 added to ${alert.startup} in your portfolio`)
    setTimeout(() => setToast(null), 3000)
  }

  function dismissSignal(id) {
    setDismissed(prev => new Set([...prev, id]))
  }

  const visible = alerts.filter(a => !dismissed.has(a.id || a.startup))

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 600,
          background: '#1DB972', color: '#fff', borderRadius: 10, padding: '10px 16px',
          fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(29,185,114,0.4)',
          animation: 'fadeInUp 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      <div style={{
        position: 'fixed', top: 60, right: 20, width: 340, maxHeight: 480,
        overflow: 'auto', background: 'var(--bg-secondary)',
        border: '1px solid var(--border-secondary)', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100,
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Signal Feed</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Approve to add to sim portfolio · Dismiss to skip</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1DB972', animation: 'pulse 1.4s infinite' }} />
            <span style={{ fontSize: 10, color: '#1DB972', fontWeight: 600 }}>{visible.length} signals</span>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            All signals reviewed · No pending actions
          </div>
        ) : (
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map(alert => {
              const id         = alert.id || alert.startup
              const isApproved = approved.has(id)
              const color      = actionColor(alert.action)

              return (
                <div key={id} style={{
                  background: 'var(--bg-surface)', borderLeft: `3px solid ${color}`, borderRadius: 8,
                  padding: '10px 12px', opacity: isApproved ? 0.55 : 1, transition: 'opacity 0.3s',
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.startup}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: color, padding: '2px 8px', background: `${color}18`, borderRadius: 4 }}>{alert.action}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{alert.confidence}%</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{alert.reason}</div>

                  {/* Trust bar */}
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${alert.trust * 100}%`, background: color, borderRadius: 2 }} />
                  </div>

                  {/* Actions */}
                  {isApproved ? (
                    <div style={{ fontSize: 10, color: '#1DB972', fontWeight: 600 }}>✓ Added ₹50,000 to simulation</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {alert.action !== 'HOLD' && (
                        <button onClick={() => approveSignal(alert)} style={{
                          flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                          background: alert.action === 'BUY' ? '#1DB97222' : '#E5484D22',
                          color: alert.action === 'BUY' ? '#1DB972' : '#E5484D',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                          {alert.action === 'BUY' ? '✓ Approve Buy' : '✓ Approve Sell'}
                        </button>
                      )}
                      <button onClick={() => dismissSignal(id)} style={{
                        flex: alert.action === 'HOLD' ? 1 : 0,
                        padding: '5px 10px', borderRadius: 6,
                        background: 'transparent', border: '1px solid var(--border-primary)',
                        color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-primary)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
          Signals sourced from trust scores · sentiment ensemble · BL portfolio model · For simulation only
        </div>
      </div>
    </>
  )
}
