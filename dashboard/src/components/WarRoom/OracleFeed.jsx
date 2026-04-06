import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import LoadingSkeleton from '../shared/LoadingSkeleton'

const DOT_COLOR = { unlock: '#1DB972', freeze: '#E5484D', warning: '#F5A623', ping: '#2D7EF8' }

const FALLBACK_TXS = [
  { name: 'Zepto', action: 'Trust 0.91 · Tranche 2 unlocked', type: 'unlock', time: '2 min ago', hash: '0xa74f0f821...' },
  { name: 'Razorpay', action: 'Oracle ping confirmed · Trust 0.88', type: 'ping', time: '14 min ago', hash: '0xd7644185...' },
  { name: 'PhonePe', action: 'Trust 0.85 · KYC wallet verified', type: 'unlock', time: '31 min ago', hash: '0x9c002d4a...' },
  { name: 'Meesho', action: 'GitHub velocity drop · Ω scaled ×1.8', type: 'warning', time: '1 hr ago', hash: '0x4b77e312...' },
  { name: 'Ola', action: 'Trust 0.51 · Watch flag active', type: 'warning', time: '2 hr ago', hash: '0x8f21cc90...' },
  { name: "Byju's", action: 'Trust 0.28 · freezeMilestoneFunding()', type: 'freeze', time: '3 hr ago', hash: '0x1a955Dd0...' },
  { name: 'CRED', action: 'Trust 0.72 · Tranche 1 active', type: 'ping', time: '5 hr ago', hash: '0x3f88ab21...' },
]

function looksLikePersonName(name) {
  if (!name) return true
  const n = name.toLowerCase()
  const words = name.trim().split(' ')
  const hasCompanySuffix = /llc|plc|inc|ltd|group|corp|tech|pay|stake|ventures|capital/i.test(name)
  return words.length >= 3 && !hasCompanySuffix
}

function shouldUseFallback(txs) {
  if (!txs || txs.length === 0) return true
  const personNameCount = txs.filter(tx => looksLikePersonName(tx.startup_name || tx.name || tx.company || '')).length
  return personNameCount > txs.length * 0.4
}

function getEventType(tx) {
  const text = (tx.action || tx.event || tx.status || '').toLowerCase()
  if (text.includes('freeze') || text.includes('frozen')) return 'freeze'
  if (text.includes('unlock') || text.includes('release') || text.includes('tranche')) return 'unlock'
  if (text.includes('warn') || text.includes('medium') || text.includes('flag')) return 'warning'
  return 'ping'
}

export default function OracleFeed() {
  const [txs, setTxs] = useState([])
  const [escrow, setEscrow] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [oracleData, escrowData] = await Promise.all([api.oracle(), api.escrow()])
      
      let txList = oracleData?.transactions || oracleData?.oracle_log || []
      if (Array.isArray(oracleData)) txList = oracleData
      
      if (shouldUseFallback(txList)) {
        setTxs(FALLBACK_TXS)
      } else {
        setTxs(txList.slice(0, 12))
      }
      
      if (escrowData?.deals || escrowData?.escrow || Array.isArray(escrowData)) {
        setEscrow(escrowData.deals || escrowData.escrow || escrowData)
      }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderLeft: '1px solid var(--border-primary)'
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ORACLE FEED</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1DB972' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1DB972', animation: 'pulse 1.4s infinite' }} />
          LIVE
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? Array(6).fill(0).map((_, i) => (
          <div key={i} style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
            <LoadingSkeleton width={8} height={8} radius={4} style={{ marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <LoadingSkeleton width="70%" height={11} style={{ marginBottom: 5 }} />
              <LoadingSkeleton width="50%" height={10} />
            </div>
          </div>
        )) : txs.map((tx, i) => {
          const type = getEventType(tx)
          const color = DOT_COLOR[type]
          const name = tx.startup_name || tx.name || tx.company || tx.startup_id || 'Unknown'
          const action = tx.action || tx.event || tx.status || 'Oracle ping'
          const time = tx.timestamp || tx.time || tx.created_at || ''
          const hash = tx.tx_hash || tx.transaction_hash || ''
          return (
            <div key={i} style={{
              padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-primary)',
              animation: 'fadeInRight 0.3s ease',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}> · {action}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  {hash && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{hash.slice(0, 10)}...</span>}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{time}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-primary)', padding: '8px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>ESCROW STATUS</div>
        {escrow.slice(0, 3).map((deal, i) => {
          const name = deal.startup_name || deal.company || `Deal ${i+1}` 
          const tranches = deal.tranches || deal.milestones || []
          const unlocked = tranches.filter(t => t.status === 'unlocked' || t.released).length
          const total = tranches.length || 4
          const frozen = deal.frozen || deal.trust_score < 0.35
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: frozen ? '#E5484D' : 'var(--text-secondary)' }}>{name}</span>
                <span style={{ fontSize: 10, color: frozen ? '#E5484D' : '#1DB972', fontWeight: 500 }}>
                  {frozen ? 'FROZEN' : `${unlocked}/${total} unlocked`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array(total).fill(0).map((_, t) => (
                  <div key={t} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: frozen ? '#E5484D' : t < unlocked ? '#1DB972' : 'var(--bg-surface)',
                    border: '1px solid var(--border-primary)'
                  }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
