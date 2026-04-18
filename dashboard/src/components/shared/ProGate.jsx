/**
 * ProGate.jsx
 * Lock overlay for PRO-only features.
 * Usage: wrap any premium section with <ProGate isPro={isPro} label="Risk Auditor">...</ProGate>
 */
import { useAuth } from '../../context/AuthContext'

export default function ProGate({ children, label = 'Premium Feature', isPro: isProProp }) {
  const { isPro: authIsPro } = useAuth()
  const isPro = isProProp !== undefined ? isProProp : authIsPro

  if (isPro) return children

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'inherit' }}>
      {/* Blurred content beneath */}
      <div style={{ pointerEvents: 'none', userSelect: 'none', filter: 'blur(4px)', opacity: 0.4 }}>
        {children}
      </div>

      {/* Lock overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(2px)',
        borderRadius: 'inherit',
        gap: 10,
        zIndex: 10,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(79,70,229,0.3)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Available on Pro plan</div>
        </div>
        <button
          onClick={() => {
            // Demo override — flip to Pro for the session
            localStorage.setItem('intellistake_pro', '1')
            window.location.reload()
          }}
          style={{
            marginTop: 4,
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 20px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  )
}
