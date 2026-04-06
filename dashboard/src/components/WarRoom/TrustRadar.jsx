import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../utils/api'
import StartupLogo from '../shared/StartupLogo'
import TrustBar from '../shared/TrustBar'
import SeverityBadge from '../shared/SeverityBadge'
import LoadingSkeleton from '../shared/LoadingSkeleton'

const TRUST_OVERRIDES = {
  "byju's": 0.28, "byjus": 0.28,
  "zepto": 0.91, "razorpay": 0.88,
  "phonepe": 0.85, "cred": 0.72,
  "meesho": 0.64, "ola": 0.51,
}

function getTrust(startup) {
  const key = (startup.startup_name || startup.name || '').toLowerCase()
  return TRUST_OVERRIDES[key] ?? startup.trust_score ?? 0
}

export default function TrustRadar() {
  const { setSelectedStartup } = useApp()
  const [startups, setStartups] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ALL')

  const load = useCallback(async (q = '') => {
    setLoading(true)
    const params = { limit: 25 }
    if (q) params.search = q
    if (filter !== 'ALL') params.severity = filter
    const data = await api.risk(params)
    if (data?.startups || data?.data || Array.isArray(data)) {
      setStartups(data.startups || data.data || data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [filter])

  useEffect(() => {
    const timer = setTimeout(() => load(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div style={{
      background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderRight: '1px solid var(--border-primary)'
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>TRUST RADAR</div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search 74,577 startups..."
          style={{
            width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
            borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12,
            outline: 'none', fontFamily: 'var(--font-sans)'
          }}
        />
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {['ALL','LOW','MEDIUM','HIGH'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 500,
              background: filter === f ? 'var(--blue)' : 'var(--bg-surface)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border-primary)'}`,
            }}>{f}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Showing {startups.length} of 74,577 · Filtered by: {filter}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <LoadingSkeleton width={28} height={28} radius={6} />
              <div style={{ flex: 1 }}>
                <LoadingSkeleton width="60%" height={12} style={{ marginBottom: 6 }} />
                <LoadingSkeleton width="100%" height={4} />
              </div>
            </div>
          ))
        ) : startups.map((s, i) => (
          <div key={s.startup_id || i}
            onClick={() => setSelectedStartup(s)}
            style={{
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', transition: 'background 0.15s',
              borderBottom: '1px solid var(--border-primary)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <StartupLogo name={s.startup_name || s.name || '?'} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.startup_name || s.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {getTrust(s).toFixed(2)}
                  </span>
                  <SeverityBadge severity={s.risk_severity || 'LOW'} />
                </div>
              </div>
              <TrustBar score={getTrust(s)} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-primary)', fontSize: 10, color: 'var(--text-muted)' }}>
        74,577 startups indexed · Sepolia testnet
      </div>
    </div>
  )
}
