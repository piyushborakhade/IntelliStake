import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../utils/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [role, setRole] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [toasts, setToasts] = useState([])
  const [criticalAlert, setCriticalAlert] = useState(null)
  const [activeOverlay, setActiveOverlay] = useState(null)
  const [selectedStartup, setSelectedStartup] = useState(null)

  useEffect(() => {
    if (role) {
      api.portfolio().then(d => { if (d) setPortfolio(d) })
    }
  }, [role])

  function addToast(toast) {
    const id = Date.now()
    setToasts(prev => [...prev.slice(-2), { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <AppContext.Provider value={{
      role, setRole,
      portfolio, setPortfolio,
      toasts, addToast, removeToast,
      criticalAlert, setCriticalAlert,
      activeOverlay, setActiveOverlay,
      selectedStartup, setSelectedStartup
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
