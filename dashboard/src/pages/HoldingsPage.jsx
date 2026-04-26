import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/alerts/ToastSystem'
import { SkeletonCard } from '../components/shared/Skeleton'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500'

const SECTORS = ['All', 'FinTech', 'E-commerce', 'D2C', 'Mobility', 'SaaS', 'HealthTech']

const BADGE_COLORS = {
  'STRONG BUY': { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  HOLD: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  WATCH: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function TradeDrawer({ startup, mode, amount, setAmount, onClose, onConfirm, loading }) {
  if (!startup) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: 420, height: '100vh', background: '#0d0d1a', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: mode === 'buy' ? '#10b981' : '#ef4444', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
              {mode === 'buy' ? 'BUY ORDER' : 'SELL ORDER'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff' }}>{startup.startup_name}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{startup.sector} · Trust {(Number(startup.trust_score || 0) * 100).toFixed(0)}/100</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Current Holding', value: formatCurrency(startup.invested_amount) },
            { label: 'Current Value', value: formatCurrency(startup.current_value) },
            { label: 'Allocation', value: `${startup.allocation_pct || 0}%` },
            { label: 'AI View', value: startup.ai_badge || 'HOLD' },
          ].map((item) => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '10px', color: '#475569', marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 8 }}>
            {mode === 'buy' ? 'Amount to invest (₹)' : 'Amount to reduce (₹)'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: 10,
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f0f4ff',
              fontSize: 15,
              outline: 'none',
              fontFamily: 'DM Mono, monospace',
            }}
          />
        </div>

        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#818cf8' }}>
          [DEMO] On-platform simulation. Portfolio state is updated through the local backend for the demo flow.
        </div>

        <button
          onClick={onConfirm}
          disabled={loading || !amount}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            background: loading || !amount ? 'rgba(255,255,255,0.06)' : (mode === 'buy' ? '#10b981' : '#ef4444'),
            color: loading || !amount ? '#475569' : '#fff',
            fontSize: 15,
            fontWeight: 800,
            cursor: loading || !amount ? 'default' : 'pointer',
            marginTop: 'auto',
          }}
        >
          {loading ? 'Processing…' : `Confirm ${mode === 'buy' ? 'Buy' : 'Sell'} →`}
        </button>
      </div>
    </div>
  )
}

export default function HoldingsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [holdings, setHoldings] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterSector, setFilterSector] = useState('All')
  const [sortBy, setSortBy] = useState('pnl')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState('buy')
  const [selectedStartup, setSelectedStartup] = useState(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)

  const mergeWithLocalHoldings = (apiHoldings) => {
    try {
      const local = JSON.parse(localStorage.getItem('is_local_holdings') || '[]');
      if (!local.length) return apiHoldings;
      const merged = [...apiHoldings];
      local.forEach(lh => {
        const exists = merged.find(h => h.startup_name === lh.startup_name);
        if (exists) {
          exists.invested_amount = Math.max(Number(exists.invested_amount || 0), Number(lh.invested_amount));
          exists.current_value   = exists.invested_amount * 1.05;
        } else {
          merged.push(lh);
        }
      });
      return merged;
    } catch {
      return apiHoldings;
    }
  };

  const loadHoldings = async () => {
    setLoading(true)
    fetch(`${API_URL}/api/user/holdings`)
      .then((r) => r.json())
      .then((data) => {
        const merged = mergeWithLocalHoldings(data.holdings || [])
        setHoldings(merged)
        setSummary(data.summary || {})
        setLoading(false)
      })
      .catch(() => {
        // API unreachable — fall back to local holdings only
        const local = JSON.parse(localStorage.getItem('is_local_holdings') || '[]')
        setHoldings(local)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadHoldings()
  }, [])

  const filteredHoldings = useMemo(() => {
    const rows = holdings.filter((holding) => filterSector === 'All' || holding.sector === filterSector)
    return [...rows].sort((a, b) => {
      if (sortBy === 'pnl') return Number(b.pnl || 0) - Number(a.pnl || 0)
      if (sortBy === 'trust') return Number(b.trust_score || 0) - Number(a.trust_score || 0)
      if (sortBy === 'alloc') return Number(b.allocation_pct || 0) - Number(a.allocation_pct || 0)
      return (a.startup_name || '').localeCompare(b.startup_name || '')
    })
  }, [holdings, filterSector, sortBy])

  const openTrade = (startup, mode) => {
    setSelectedStartup(startup)
    setDrawerMode(mode)
    setBuyAmount('')
    setDrawerOpen(true)
  }

  const handleBuyConfirm = async () => {
    if (!selectedStartup || !buyAmount) return
    setTradeLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/user/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy',
          startup_name: selectedStartup.startup_name,
          sector: selectedStartup.sector,
          invested_amount: parseFloat(buyAmount),
          trust_score: selectedStartup.trust_score,
          allocation_pct: 0,
          user_id: localStorage.getItem('is_user_id') || 'demo'
        })
      })
      const data = await res.json()
      if (data.success) {
        toast(`Investment recorded - [DEMO] Simulated tx: ${data.tx_hash?.slice(0,18) || '0x...'}`, 'success')
        setDrawerOpen(false)
        setBuyAmount('')
        loadHoldings()
      } else {
        toast('Could not record investment', 'error')
      }
    } catch {
      toast('Buy order failed', 'error')
    } finally {
      setTradeLoading(false)
    }
  }

  const handleSellConfirm = async () => {
    if (!selectedStartup || !buyAmount) return
    setTradeLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/user/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sell',
          startup_name: selectedStartup.startup_name,
          sector: selectedStartup.sector,
          invested_amount: parseFloat(buyAmount),
          trust_score: selectedStartup.trust_score,
          allocation_pct: 0,
          user_id: localStorage.getItem('is_user_id') || 'demo'
        })
      })
      const data = await res.json()
      if (data.success) {
        toast(`Investment reduced - [DEMO] Simulated tx: ${data.tx_hash?.slice(0,18) || '0x...'}`, 'success')
        setDrawerOpen(false)
        setBuyAmount('')
        loadHoldings()
      } else {
        toast('Could not record sell order', 'error')
      }
    } catch {
      toast('Sell order failed', 'error')
    } finally {
      setTradeLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', display: 'grid', gap: '16px' }}>
        {[1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)}
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No investments yet</h3>
        <p style={{ marginBottom: '20px', fontSize: '14px' }}>Start building your portfolio by exploring startups</p>
        <button onClick={() => navigate('/discover')} style={{
          background: 'var(--indigo)', color: 'white', border: 'none',
          padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
        }}>Browse Startups →</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px', marginBottom: '24px'
      }}>
        {[
          { label: 'Total Invested', value: `₹${((summary.total_invested || 0) / 100000).toFixed(1)}L` },
          { label: 'Current Value',  value: `₹${((summary.total_value || 0) / 100000).toFixed(1)}L` },
          { label: 'Total P&L',      value: `₹${((summary.total_pnl || 0) / 100000).toFixed(1)}L`,
            color: (summary.total_pnl || 0) >= 0 ? '#10b981' : '#ef4444' },
          { label: 'XIRR (Est.)',    value: `${summary.xirr_estimate || 0}%`,
            color: '#3b82f6' }
        ].map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '16px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{m.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: m.color || 'var(--text-primary)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SECTORS.map((sector) => (
            <button
              key={sector}
              onClick={() => setFilterSector(sector)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                background: filterSector === sector ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterSector === sector ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                color: filterSector === sector ? '#818cf8' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {sector}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort:</span>
          {[['pnl', 'P&L'], ['trust', 'Trust'], ['alloc', 'Allocation'], ['name', 'Name']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                background: sortBy === value ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: `1px solid ${sortBy === value ? '#6366f1' : 'rgba(255,255,255,0.07)'}`,
                color: sortBy === value ? '#818cf8' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="holdings-table-view">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 90px 120px 120px 120px 90px 110px 150px',
          padding: '8px 16px',
          marginBottom: 4,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
        }}>
          <div>STARTUP</div>
          <div>SECTOR</div>
          <div>STAGE</div>
          <div>TRUST</div>
          <div>INVESTED</div>
          <div>CURRENT</div>
          <div>P&L</div>
          <div>ALLOC</div>
          <div>AI VIEW</div>
          <div>ACTIONS</div>
        </div>

        {filteredHoldings.map((holding) => {
          const badge = BADGE_COLORS[holding.ai_badge] || BADGE_COLORS.HOLD
          return (
            <div key={`${holding.startup_name}-${holding.id || holding.created_at || holding.sector}`} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 90px 120px 120px 120px 90px 110px 150px',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '8px',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{holding.startup_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{holding.country || 'India'}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{holding.sector}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{holding.stage || 'Series A'}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{(Number(holding.trust_score || 0) * 100).toFixed(0)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(holding.invested_amount)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(holding.current_value)}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: Number(holding.pnl || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {Number(holding.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
                </div>
                <div style={{ fontSize: '10px', color: Number(holding.pnl || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {Number(holding.pnl_pct || 0) >= 0 ? '+' : ''}{Number(holding.pnl_pct || 0).toFixed(2)}%
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{holding.allocation_pct || 0}%</div>
              <div>
                <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: badge.bg, color: badge.color, fontWeight: 700 }}>
                  {holding.ai_badge}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openTrade(holding, 'buy')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', cursor: 'pointer', fontWeight: 700 }}>BUY</button>
                <button onClick={() => openTrade(holding, 'sell')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>SELL</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="holdings-card-view">
        {filteredHoldings.map((holding) => {
          const badge = BADGE_COLORS[holding.ai_badge] || BADGE_COLORS.HOLD
          return (
            <div key={`${holding.startup_name}-card-${holding.id || holding.created_at || holding.sector}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{holding.startup_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{holding.sector} · {holding.stage || 'Series A'}</div>
                </div>
                <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: badge.bg, color: badge.color, fontWeight: 700 }}>
                  {holding.ai_badge}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div><div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Invested</div><div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatCurrency(holding.invested_amount)}</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Current</div><div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatCurrency(holding.current_value)}</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Trust</div><div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{(Number(holding.trust_score || 0) * 100).toFixed(0)}</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Allocation</div><div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{holding.allocation_pct || 0}%</div></div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>P&L</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: Number(holding.pnl || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {Number(holding.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(holding.pnl)} ({Number(holding.pnl_pct || 0).toFixed(2)}%)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openTrade(holding, 'buy')} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>BUY</button>
                <button onClick={() => openTrade(holding, 'sell')} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>SELL</button>
              </div>
            </div>
          )
        })}
      </div>

      {drawerOpen && (
        <TradeDrawer
          startup={selectedStartup}
          mode={drawerMode}
          amount={buyAmount}
          setAmount={setBuyAmount}
          onClose={() => setDrawerOpen(false)}
          onConfirm={drawerMode === 'buy' ? handleBuyConfirm : handleSellConfirm}
          loading={tradeLoading}
        />
      )}
    </div>
  )
}
