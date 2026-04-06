import { useApp } from '../../context/AppContext'
import { lazy, Suspense } from 'react'
import ChatbotOverlay from './ChatbotOverlay'

const MODULES = {
  risk: lazy(() => import('../../pages/RiskAuditor')),
  valuation: lazy(() => import('../../pages/ValuationEngine')),
  escrow: lazy(() => import('../../pages/Escrow')),
  shap: lazy(() => import('../../pages/ShapExplainer')),
  sentiment: lazy(() => import('../../pages/Sentiment')),
  portfolio: lazy(() => import('../../pages/Portfolio')),
  montecarlo: lazy(() => import('../../pages/MonteCarlo')),
  backtest: lazy(() => import('../../pages/Backtest')),
  kyc: lazy(() => import('../../pages/KYC')),
  oracle: lazy(() => import('../../pages/OracleBridge')),
  hype: lazy(() => import('../../pages/HypeDetector')),
  network: lazy(() => import('../../pages/InvestorNetwork')),
  datalake: lazy(() => import('../../pages/DataLake')),
  models: lazy(() => import('../../pages/ModelHub')),
  memo: lazy(() => import('../../pages/MemoGenerator')),
}

export default function ModuleOverlay() {
  const { activeOverlay, setActiveOverlay } = useApp()
  
  if (activeOverlay === 'chatbot') {
    return <ChatbotOverlay onClose={() => setActiveOverlay(null)} />
  }
  
  const PageComponent = MODULES[activeOverlay]

  return (
    <>
      <div
        onClick={() => setActiveOverlay(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, animation: 'fadeIn 0.2s ease' }}
      />
      <div style={{
        position: 'fixed', inset: '40px', background: 'var(--bg-secondary)',
        borderRadius: 12, border: '1px solid var(--border-secondary)',
        zIndex: 201, overflow: 'hidden', animation: 'slideUpOverlay 0.3s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{activeOverlay}</span>
          <button onClick={() => setActiveOverlay(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', colorScheme: 'dark', filter: 'none' }} className="module-overlay-content">
          <Suspense fallback={<div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading module...</div>}>
            {PageComponent && <PageComponent />}
          </Suspense>
        </div>
      </div>
    </>
  )
}
