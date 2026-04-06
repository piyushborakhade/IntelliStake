import { useState, useEffect } from 'react'
import { api } from '../../utils/api'

export default function TradingAlerts() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    generateAlerts()
    const interval = setInterval(generateAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  async function generateAlerts() {
    try {
      const data = await api.portfolio()
      if (!data?.holdings) return

      const newAlerts = data.holdings.map(h => {
        const trust = h.trust_score || 0
        const risk = h.risk_severity || 'MEDIUM'
        
        let action = 'HOLD'
        let reason = 'Monitoring position'
        let color = '#F5A623'

        if (trust >= 0.85 && risk === 'LOW') {
          action = 'BUY'
          reason = `Strong trust score ${trust.toFixed(2)} · Low risk`
          color = '#1DB972'
        } else if (trust < 0.35 || risk === 'HIGH') {
          action = 'SELL'
          reason = `Trust dropped to ${trust.toFixed(2)} · ${risk} risk`
          color = '#E5484D'
        } else if (trust >= 0.65 && trust < 0.85) {
          action = 'BUY'
          reason = `Good trust ${trust.toFixed(2)} · Moderate opportunity`
          color = '#1DB972'
        }

        return {
          id: h.startup_name,
          startup: h.startup_name,
          action,
          reason,
          color,
          trust,
          timestamp: new Date().toISOString()
        }
      })

      setAlerts(newAlerts.filter(a => a.action !== 'HOLD'))
    } catch (e) {
      console.error('Alert generation failed:', e)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 60, right: 20, width: 320, maxHeight: 400, overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Trading Alerts</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Auto-generated · Real-time</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{alerts.length} active</div>
      </div>

      {alerts.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No alerts · All positions stable
        </div>
      ) : (
        <div style={{ padding: 8 }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{ padding: '10px 12px', margin: '6px 0', background: 'var(--bg-surface)', borderLeft: `3px solid ${alert.color}`, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.startup}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: alert.color, padding: '2px 8px', background: `${alert.color}15`, borderRadius: 4 }}>{alert.action}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{alert.reason}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Trust: {alert.trust.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
