import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../utils/api'
import NotificationPanel from './NotificationPanel'
import { useTheme, THEMES } from '../../hooks/useTheme'

export default function TopBar() {
  const { role } = useApp()
  const [summary, setSummary] = useState(null)
  const [time, setTime] = useState(new Date())
  const [notifCount, setNotifCount] = useState(0)
  const { theme, setTheme } = useTheme()
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    api.warroom().then(d => { if (d) setSummary(d) })
    api.notifications().then(d => { if (d?.notifications) setNotifCount(d.notifications.length) })
    const tick = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  const kpis = summary ? [
    { label: 'R²', value: summary.r2_score?.toFixed(3) || '0.780', color: '#1DB972' },
    { label: 'Sharpe', value: summary.sharpe_ratio?.toFixed(2) || '1.34', color: '#F0F0F5' },
    { label: 'Return', value: `${summary.expected_return?.toFixed(1) || '25.4'}%`, color: '#1DB972' },
    { label: 'Vol', value: `${summary.volatility?.toFixed(1) || '20.2'}%`, color: '#F5A623' },
    { label: 'Drawdown', value: `${summary.max_drawdown?.toFixed(2) || '-5.03'}%`, color: '#E5484D' },
  ] : []

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
          <span style={{ color: '#F0F0F5' }}>INTELLI</span>
          <span style={{ color: '#2D7EF8' }}>STAKE</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Investment Intelligence Platform</span>
        <div style={{ width: 1, height: 16, background: 'var(--border-primary)', margin: '0 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#1DB972' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1DB972', animation: 'pulse 1.4s infinite' }} />
          LIVE
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.value || '0.00'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 3 }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.desc}
              style={{
                background: theme === t.id ? 'var(--bg-primary)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                color: theme === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: theme === t.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: theme === t.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {notifCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#E5484D', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{notifCount}</div>}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {time.toLocaleTimeString('en-IN', { hour12: false })}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-primary)' }}>
          {role || 'DEMO'}
        </span>
      </div>
      
      {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
    </div>
  )
}
