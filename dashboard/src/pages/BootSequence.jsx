import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'

const BOOT_LINES = [
  { text: 'INITIALIZING INTELLISTAKE WAR ROOM...', delay: 0 },
  { text: 'LOADING TRUST ENGINE........................', delay: 320, suffix: '✓' },
  { text: 'READING 74,577 STARTUP RECORDS.............', delay: 640, suffix: '✓' },
  { text: 'XGBOOST MODEL ONLINE  (R²=0.9645)..........', delay: 960, suffix: '✓' },
  { text: 'BLACK-LITTERMAN OPTIMIZER..................', delay: 1280, suffix: '✓' },
  { text: 'CONNECTING SEPOLIA TESTNET.................', delay: 1600, suffix: '✓' },
  { text: 'KYC REGISTRY LOADED  (50 WALLETS)..........', delay: 1920, suffix: '✓' },
  { text: 'ORACLE BRIDGE ACTIVE.......................', delay: 2240, suffix: '✓' },
  { text: 'MILESTONE ESCROW MONITORING................', delay: 2560, suffix: '✓' },
  { text: 'ALL SYSTEMS NOMINAL. LAUNCHING.............', delay: 2880, suffix: '' },
]

export default function BootSequence() {
  const navigate = useNavigate()
  const [visibleLines, setVisibleLines] = useState([])
  const [cursorLine, setCursorLine] = useState(0)

  useEffect(() => {
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(prev => [...prev, { ...line, index: i, showSuffix: false }])
        setCursorLine(i)
        
        if (line.suffix) {
          setTimeout(() => {
            setVisibleLines(prev => prev.map((l, idx) => 
              idx === i ? { ...l, showSuffix: true } : l
            ))
          }, 150)
        }
      }, line.delay)
    })

    setTimeout(() => {
      api.warroom()
      setTimeout(() => {
        document.body.style.opacity = '0'
        document.body.style.transition = 'opacity 0.4s ease'
        setTimeout(() => {
          navigate('/warroom')
          document.body.style.opacity = '1'
        }, 400)
      }, 450)
    }, 3500)
  }, [navigate])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0A0A0F',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', color: '#1DB972'
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
        letterSpacing: '0.1em', marginBottom: 48, animation: 'breathe 3s infinite',
        color: '#F0F0F5'
      }}>
        INTELLISTAKE
      </div>

      <div style={{
        maxWidth: 520, width: '100%', fontFamily: 'var(--font-mono)',
        fontSize: 13, lineHeight: 1.8, textAlign: 'left'
      }}>
        {visibleLines.map((line, i) => (
          <div key={i} style={{ animation: 'fadeIn 0.2s ease', color: line.text.includes('NOMINAL') ? '#F0F0F5' : '#1DB972' }}>
            {line.text}
            {line.showSuffix && <span style={{ color: '#1DB972', marginLeft: 8 }}>{line.suffix}</span>}
            {i === cursorLine && !line.showSuffix && (
              <span style={{ animation: 'terminalBlink 1s infinite', marginLeft: 4 }}>█</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
