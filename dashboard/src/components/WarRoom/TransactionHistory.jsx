import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import StartupLogo from '../shared/StartupLogo'
import LoadingSkeleton from '../shared/LoadingSkeleton'

const STATUS_STYLE = {
  ACTIVE: { bg: 'rgba(29,185,114,0.12)', color: '#1DB972', border: 'rgba(29,185,114,0.2)' },
  FROZEN: { bg: 'rgba(229,72,77,0.12)', color: '#E5484D', border: 'rgba(229,72,77,0.2)' },
  WATCH: { bg: 'rgba(245,166,35,0.12)', color: '#F5A623', border: 'rgba(245,166,35,0.2)' },
}

export default function TransactionHistory({ onClose }) {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.supabaseTxs().then(d => {
      if (d?.transactions) setTxs(d.transactions)
      setLoading(false)
    })
  }, [])

  function formatINR(n) {
    return `₹${Number(n).toLocaleString('en-IN')}` 
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const totalInvested = txs.reduce((sum, t) => sum + (t.amount_inr || 0), 0)
  const activeCount = txs.filter(t => t.status === 'ACTIVE').length
  const frozenCount = txs.filter(t => t.status === 'FROZEN').length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 16, width: '85%', maxWidth: 800, maxHeight: '85vh', overflow: 'auto', animation: 'fadeInUp 0.3s ease' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Transaction History</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Live from Supabase · Real-time investment log</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--border-primary)' }}>
          {[
            { label: 'Total Invested', value: formatINR(totalInvested), color: 'var(--text-primary)' },
            { label: 'Active Positions', value: activeCount, color: '#1DB972' },
            { label: 'Frozen (Protected)', value: frozenCount, color: '#E5484D' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-primary)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px' }}>
          {loading ? Array(4).fill(0).map((_, i) => <LoadingSkeleton key={i} width="100%" height={60} radius={8} style={{ marginBottom: 8 }} />) :
            txs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                No transactions yet. Run a simulation to create your first transaction.
              </div>
            ) :
            txs.map((tx, i) => {
              const status = tx.status || 'ACTIVE'
              const style = STATUS_STYLE[status] || STATUS_STYLE.ACTIVE
              const gain = tx.amount_inr * (tx.expected_return_pct / 100)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-surface)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border-primary)' }}>
                  <StartupLogo name={tx.startup_name || '?'} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{tx.startup_name}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatINR(tx.amount_inr)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Trust: {tx.trust_score_at_investment?.toFixed(2)}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>BL: {(tx.bl_weight * 100)?.toFixed(1)}%</span>
                        <span style={{ fontSize: 10, color: '#1DB972' }}>Exp: +{formatINR(Math.round(gain))}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontWeight: 600 }}>{status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-primary)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Data stored in Supabase PostgreSQL · Project: zshwjfntqyretbzanxjb · Real-time sync enabled
        </div>
      </div>
    </div>
  )
}
