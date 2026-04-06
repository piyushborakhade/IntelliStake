import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import InvestmentSimulator from './InvestmentSimulator'
import BlockchainExplorer from './BlockchainExplorer'
import TransactionHistory from './TransactionHistory'
import WalletConnect from './WalletConnect'
import TradingAlerts from './TradingAlerts'

export default function BottomNav() {
  const { setActiveOverlay } = useApp()
  const [showSimulator, setShowSimulator] = useState(false)
  const [showBlockchain, setShowBlockchain] = useState(false)
  const [showTxHistory, setShowTxHistory] = useState(false)
  const [showWallet, setShowWallet] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)', display: 'flex', height: '100%' }}>

        <div style={{ display: 'flex', gap: 6, padding: '0 12px', alignItems: 'center', borderRight: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <button onClick={() => setShowSimulator(true)} style={{
            padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Simulate Investment
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
            Transactions
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
          { id: 'risk', label: 'Risk Auditor', sub: '74,577 startups' },
          { id: 'valuation', label: 'Valuation Engine', sub: 'R² = 0.9645' },
          { id: 'escrow', label: 'Escrow Vault', sub: '3 deals · Sepolia' },
          { id: 'shap', label: 'SHAP Explainer', sub: '37,699 narratives' },
          { id: 'sentiment', label: 'Sentiment Terminal', sub: 'FinBERT · VADER' },
          { id: 'chatbot', label: 'AI Analyst', sub: 'Ask anything' },
        ].map(m => (
          <div key={m.id} onClick={() => setActiveOverlay(m.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', cursor: 'pointer', borderRight: '1px solid var(--border-primary)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{m.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {showSimulator && <InvestmentSimulator onClose={() => setShowSimulator(false)} />}
      {showBlockchain && <BlockchainExplorer onClose={() => setShowBlockchain(false)} />}
      {showTxHistory && <TransactionHistory onClose={() => setShowTxHistory(false)} />}
      {showWallet && <WalletConnect onClose={() => setShowWallet(false)} />}
      {showAlerts && <TradingAlerts />}
    </>
  )
}
