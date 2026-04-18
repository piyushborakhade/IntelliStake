import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import InvestmentSimulator from './InvestmentSimulator'
import BlockchainExplorer from './BlockchainExplorer'
import TransactionHistory from './TransactionHistory'
import WalletConnect from './WalletConnect'
import TradingAlerts from './TradingAlerts'

// Modules requiring Pro (ADMIN / PORTFOLIO_MANAGER)
const PRO_MODULES = new Set(['risk', 'escrow', 'shap', 'sentiment', 'chatbot'])

export default function BottomNav() {
  const { setActiveOverlay } = useApp()
  const { isPro } = useAuth()
  const [showSimulator, setShowSimulator] = useState(false)
  const [showBlockchain, setShowBlockchain] = useState(false)
  const [showTxHistory, setShowTxHistory] = useState(false)
  const [showWallet, setShowWallet] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [lockedFlash, setLockedFlash] = useState(null)

  function handleModuleClick(id) {
    if (PRO_MODULES.has(id) && !isPro) {
      setLockedFlash(id)
      setTimeout(() => setLockedFlash(null), 1400)
      return
    }
    setActiveOverlay(id)
  }

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)', display: 'flex', height: '100%' }}>

        <div style={{ display: 'flex', gap: 6, padding: '0 12px', alignItems: 'center', borderRight: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <button onClick={() => setShowSimulator(true)} style={{
            padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Simulate
          </button>
          <button onClick={() => setShowBlockchain(true)} style={{
            padding: '6px 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Blockchain
          </button>
          <button onClick={() => setShowTxHistory(true)} style={{
            padding: '6px 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Txns
          </button>
          <button onClick={() => setShowWallet(true)} style={{
            padding: '6px 14px', background: 'none', color: '#1DB972', border: '1px solid #1DB972',
            borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600
          }}>
            🦊 Wallet
          </button>
          <button onClick={() => setShowAlerts(!showAlerts)} style={{
            padding: '6px 14px', background: showAlerts ? 'var(--accent)' : 'none', color: showAlerts ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Alerts
          </button>
        </div>

        {[
          { id: 'risk',      label: 'Risk Auditor',     sub: '74,577 startups'      },
          { id: 'valuation', label: 'Valuation Engine', sub: 'R² = 0.9738'          },
          { id: 'escrow',    label: 'Escrow Vault',     sub: '3 deals · Sepolia'    },
          { id: 'shap',      label: 'SHAP Explainer',   sub: '37,699 narratives'    },
          { id: 'sentiment', label: 'Sentiment Feed',   sub: '5-model ensemble'     },
          { id: 'chatbot',   label: 'AI Analyst',       sub: 'Ask anything'         },
        ].map(m => {
          const locked = PRO_MODULES.has(m.id) && !isPro
          const flashing = lockedFlash === m.id
          return (
            <div key={m.id} onClick={() => handleModuleClick(m.id)}
              title={locked ? `${m.label} — Pro only (ANALYST role restricted)` : m.label}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '0 14px', cursor: locked ? 'not-allowed' : 'pointer',
                borderRight: '1px solid var(--border-primary)',
                background: flashing ? 'rgba(239,68,68,0.1)' : 'transparent',
                transition: 'background 0.15s', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'var(--bg-surface)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: locked ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
                {locked && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </div>
              <div style={{ fontSize: 10, color: locked ? 'rgba(239,68,68,0.6)' : 'var(--text-muted)', marginTop: 1 }}>
                {locked ? 'Pro only' : m.sub}
              </div>
              {flashing && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#ef4444', borderRadius: 1 }} />
              )}
            </div>
          )
        })}
      </div>

      {showSimulator && <InvestmentSimulator onClose={() => setShowSimulator(false)} />}
      {showBlockchain && <BlockchainExplorer onClose={() => setShowBlockchain(false)} />}
      {showTxHistory && <TransactionHistory onClose={() => setShowTxHistory(false)} />}
      {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
      {showAlerts && <TradingAlerts />}
    </>
  )
}
