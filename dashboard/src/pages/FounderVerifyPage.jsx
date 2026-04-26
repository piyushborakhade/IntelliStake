import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500'

const DEMO_STARTUPS = ["Byju's", 'Zepto', 'Meesho', 'Ola', 'CRED', 'Groww', 'Razorpay', 'PhonePe', 'Swiggy', 'Nykaa']

const STATUS_COLOR = { CONSISTENT: '#10b981', FLAG: '#ef4444', WATCH: '#f59e0b' }
const STATUS_ICON  = { CONSISTENT: '✓', FLAG: '⚠', WATCH: '◉' }

function CheckCard({ check }) {
  const color = STATUS_COLOR[check.status] || '#6b7280'
  const icon  = STATUS_ICON[check.status]  || '?'
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: `1px solid ${color}33`,
      borderRadius: '10px', padding: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{check.check}</span>
        <span style={{
          fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
          background: `${color}22`, color
        }}>
          {icon} {check.status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '600' }}>REPORTED</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{check.claim}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '600' }}>DATASET VERIFIED</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{check.verified}</div>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
        {check.explanation}
      </p>
      {check.estimated_burn_monthly_usd && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#3b82f6' }}>
          Est. monthly burn: ${(check.estimated_burn_monthly_usd / 1000).toFixed(0)}K · Est. runway: {check.runway_display || `${check.estimated_runway_months} months`}
        </div>
      )}
    </div>
  )
}

export default function FounderVerifyPage() {
  const [query, setQuery]   = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const navigate = useNavigate()

  const verify = async (name) => {
    const target = (name || query).trim()
    if (!target) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res  = await fetch(`${API}/api/founder-verify/${encodeURIComponent(target)}`)
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch {
      setError('Could not connect to backend')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700', margin: 0 }}>
          Founder Claims Verifier
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Cross-reference startup claims against 74,577-startup dataset, sector TAM, and industry benchmarks.
          AI-assisted due diligence — not a substitute for professional verification.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verify()}
          placeholder="Enter startup name (e.g. Zepto, Byju's, Meesho)..."
          style={{
            flex: 1, padding: '12px 16px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
          }}
        />
        <button
          onClick={() => verify()}
          disabled={loading || !query.trim()}
          style={{
            padding: '12px 24px',
            background: loading || !query.trim() ? 'var(--bg-elevated)' : 'var(--accent)',
            color: loading || !query.trim() ? 'var(--text-muted)' : 'white',
            border: 'none', borderRadius: '8px',
            cursor: loading ? 'wait' : 'pointer', fontWeight: '600', fontSize: '14px'
          }}
        >
          {loading ? 'Verifying…' : 'Verify Claims'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {DEMO_STARTUPS.map(s => (
          <button
            key={s}
            onClick={() => { setQuery(s); verify(s) }}
            style={{
              padding: '6px 14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: '20px',
              color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', padding: '16px', color: '#ef4444', marginBottom: '16px'
        }}>
          Startup not found: "{error === 'Startup not found' ? query : error}". Try one of the demo buttons above.
        </div>
      )}

      {result && (
        <div>
          <div style={{
            background: 'var(--bg-secondary)', border: `2px solid ${result.credibility_color}44`,
            borderRadius: '12px', padding: '24px', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', margin: 0 }}>
                  {result.startup_name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
                  {result.sector} · {result.stage} · Rank #{result.sector_rank} of {result.sector_total} in sector
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '40px', fontWeight: '800', color: result.credibility_color, lineHeight: 1 }}>
                  {(result.credibility_score * 100).toFixed(0)}
                </div>
                <div style={{ fontSize: '11px', color: result.credibility_color, fontWeight: '700', marginTop: '4px' }}>
                  {result.credibility_label}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {result.flags_raised} flag{result.flags_raised !== 1 ? 's' : ''} · {result.checks_run} checks run
                </div>
              </div>
            </div>

            {result.ai_summary && (
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: '8px',
                padding: '14px', marginTop: '16px',
                borderLeft: `3px solid ${result.credibility_color}`
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '700', letterSpacing: '0.05em' }}>
                  AI DUE DILIGENCE ASSESSMENT
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                  {result.ai_summary}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {result.checks.map((check, i) => <CheckCard key={i} check={check} />)}
          </div>

          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '14px', marginBottom: '16px'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', letterSpacing: '0.05em' }}>
              DATA SOURCES USED
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {result.data_sources.map((s, i) => (
                <span key={i} style={{
                  fontSize: '11px', padding: '4px 10px', background: 'var(--bg-elevated)',
                  borderRadius: '12px', color: 'var(--text-muted)', border: '1px solid var(--border)'
                }}>
                  {s}
                </span>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '10px 0 0', fontStyle: 'italic' }}>
              {result.disclaimer}
            </p>
          </div>

          <button
            onClick={() => navigate(`/startup/${encodeURIComponent(result.startup_name)}`)}
            style={{
              padding: '12px 24px', background: 'var(--accent)',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600', fontSize: '14px'
            }}
          >
            View Full Startup Profile →
          </button>
        </div>
      )}
    </div>
  )
}
