import { useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import StartupLogo from '../shared/StartupLogo'

const DEMO_TOASTS = [
  { startup: 'Zepto', message: 'Trust score confirmed · 0.91 · Tranche eligible', type: 'success', delay: 45000 },
  { startup: 'Meesho', message: 'GitHub velocity dropped 12% · Watch flag raised', type: 'warning', delay: 75000 },
  { startup: 'Byju\'s', message: 'Trust score 0.28 · Escrow frozen', type: 'danger', delay: 110000 },
  { startup: 'Razorpay', message: 'Oracle ping confirmed · All signals nominal', type: 'success', delay: 150000 },
]

const TYPE_COLOR = { success: '#1DB972', warning: '#F5A623', danger: '#E5484D', info: '#2D7EF8' }

export default function ToastSystem() {
  const { toasts, addToast, removeToast } = useApp()

  useEffect(() => {
    const timers = DEMO_TOASTS.map(t =>
      setTimeout(() => addToast({ startup: t.startup, message: t.message, type: t.type }), t.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: 'var(--bg-elevated)', border: `1px solid ${TYPE_COLOR[toast.type]}40`,
          borderLeft: `3px solid ${TYPE_COLOR[toast.type]}`,
          borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start',
          animation: 'toastIn 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <StartupLogo name={toast.startup || '?'} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{toast.startup}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.message}</div>
          </div>
          <button onClick={() => removeToast(toast.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      ))}
    </div>
  )
}
