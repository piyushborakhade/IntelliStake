import { useState, useEffect } from 'react'
import { api } from '../../utils/api'

export default function NotificationPanel({ onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    try {
      const data = await api.notifications()
      if (data?.notifications) {
        setNotifications(data.notifications)
      }
    } catch (e) {
      console.error('Failed to load notifications:', e)
    }
    setLoading(false)
  }

  function getNotificationColor(type) {
    switch (type) {
      case 'alert': return '#E5484D'
      case 'success': return '#1DB972'
      case 'warning': return '#F5A623'
      default: return '#2D7EF8'
    }
  }

  return (
    <div style={{ position: 'fixed', top: 60, right: 20, width: 380, maxHeight: 500, background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{notifications.length} total</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
      </div>

      <div style={{ maxHeight: 440, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No notifications
          </div>
        ) : (
          notifications.map((notif, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', borderLeft: `3px solid ${getNotificationColor(notif.type)}`, background: i % 2 === 0 ? 'var(--bg-surface)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{notif.title}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{notif.time}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{notif.message}</div>
              {notif.action && (
                <button style={{ marginTop: 8, padding: '4px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>
                  {notif.action}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
