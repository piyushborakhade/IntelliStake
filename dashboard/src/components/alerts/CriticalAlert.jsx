import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../utils/api'

export default function CriticalAlert() {
  const [visible, setVisible] = useState(false)
  const [escrowData, setEscrowData] = useState(null)
  const { setCriticalAlert } = useApp()

  useEffect(() => {
    const timer = setTimeout(async () => {
      const escrow = await api.escrow()
      setEscrowData(escrow)
      // Disabled per user request to stop recurring popup
      // setVisible(true)
      // setCriticalAlert({ triggered: true })
    }, 60000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid #E5484D',
        borderRadius: 12, padding: '32px', maxWidth: 480, width: '90%',
        animation: 'criticalPulse 2s infinite, fadeInUp 0.4s ease',
        boxShadow: '0 0 40px rgba(229,72,77,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E5484D', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#E5484D', letterSpacing: '0.1em' }}>CRITICAL ORACLE SIGNAL</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 4 }}>
            Byju's Technologies
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Trust Score: <span style={{ color: '#E5484D', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>0.28</span> — Threshold breach detected (&lt; 0.35)
          </div>

          <div style={{ background: '#E5484D18', border: '1px solid #E5484D30', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#E5484D', marginBottom: 4 }}>
              freezeMilestoneFunding()
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Executed on Sepolia · Contract: 0x1a955D...f4c7
            </div>
          </div>

          <div style={{ background: '#1DB97218', border: '1px solid #1DB97230', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, color: '#1DB972', fontWeight: 500 }}>
              ₹28,00,000 in remaining tranches PROTECTED
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
              Investor capital secured · Escrow locked indefinitely
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="https://sepolia.etherscan.io/address/0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7"
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}
          >
            View on Etherscan
          </a>
          <button
            onClick={() => setVisible(false)}
            style={{ flex: 1, padding: '10px', background: '#E5484D', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  )
}
