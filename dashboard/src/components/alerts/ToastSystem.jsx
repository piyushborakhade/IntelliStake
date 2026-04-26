import { useState, useCallback, createContext, useContext } from 'react'

const ToastCtx = createContext(() => {})

export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b',
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            style={{
              background: colors[toastItem.type] || colors.info,
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              maxWidth: '380px',
              fontSize: '13px',
              fontWeight: '500',
              animation: 'slideIn 0.25s ease',
              pointerEvents: 'all',
            }}
          >
            {toastItem.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export default ToastProvider
