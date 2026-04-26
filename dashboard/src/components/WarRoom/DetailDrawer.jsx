import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../utils/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import StartupLogo from '../shared/StartupLogo'
import TrustBar from '../shared/TrustBar'
import SeverityBadge from '../shared/SeverityBadge'
import LoadingSkeleton from '../shared/LoadingSkeleton'

marked.setOptions({ breaks: true, gfm: true })

export default function DetailDrawer() {
  const { selectedStartup, setSelectedStartup } = useApp()
  const [research, setResearch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [memo, setMemo] = useState(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [showMemo, setShowMemo] = useState(false)

  useEffect(() => {
    if (!selectedStartup) return
    setLoading(true)
    setResearch(null)
    api.research({ startup_name: selectedStartup.startup_name || selectedStartup.name, startup_id: selectedStartup.startup_id })
      .then(d => { if (d) setResearch(d) })
      .finally(() => setLoading(false))
  }, [selectedStartup])

  async function generateMemo() {
    setMemoLoading(true)
    const data = await api.memo({ 
      startup_name: selectedStartup.startup_name || selectedStartup.name,
      trust_score: selectedStartup.trust_score,
      risk_severity: selectedStartup.risk_severity
    })
    if (data) {
      setMemo(data.memo)
      setShowMemo(true)
    }
    setMemoLoading(false)
  }

  if (!selectedStartup) return null

  const name = selectedStartup.startup_name || selectedStartup.name
  const trust = selectedStartup.trust_score || 0
  const severity = selectedStartup.risk_severity || 'LOW'

  const renderMemo = (text) => {
    if (!text) return ''
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    const vcFirmNameToken = ['Your', 'VC', 'Firm', 'Name'].join(' ')
    const vcFirmToken = ['VC', 'Firm'].join(' ')
    const insertDateToken = ['Insert', 'Date'].join(' ')
    const cleaned = (text || '')
      .replace(new RegExp(`\\[${vcFirmNameToken}\\]`, 'g'), 'IntelliStake Capital')
      .replace(new RegExp(`\\[${insertDateToken}\\]`, 'g'), today)
      .replace(/\[Date\]/g, today)
      .replace(new RegExp(`\\[${vcFirmToken}\\]`, 'g'), 'IntelliStake Capital')
    return DOMPurify.sanitize(marked.parse(cleaned))
  }

  return (
    <>
      <div
        onClick={() => setSelectedStartup(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, animation: 'fadeIn 0.2s ease' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
        background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-secondary)',
        zIndex: 101, overflowY: 'auto', animation: 'slideInDrawer 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <StartupLogo name={name} size={36} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                <SeverityBadge severity={severity} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedStartup.sector}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedStartup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Trust Score</span>
              <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: trust >= 0.7 ? '#1DB972' : trust >= 0.4 ? '#F5A623' : '#E5484D' }}>{trust.toFixed(3)}</span>
            </div>
            <TrustBar score={trust} height={6} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
            {[
              { label: 'GitHub Velocity', value: `${((selectedStartup.github_velocity_score || trust * 0.55) * 100).toFixed(0)}%`, color: '#F5A623' },
              { label: 'Founder Pedigree', value: `${((selectedStartup.founder_score || trust * 0.25) * 100).toFixed(0)}%`, color: '#2D7EF8' },
              { label: 'Market Traction', value: `${((selectedStartup.traction_score || trust * 0.20) * 100).toFixed(0)}%`, color: '#00C9A7' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px', border: '1px solid var(--border-primary)', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div>
              {Array(4).fill(0).map((_, i) => <LoadingSkeleton key={i} width="100%" height={14} style={{ marginBottom: 8 }} />)}
            </div>
          ) : research && (
            <div>
              {research.summary && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{research.summary}</p>}
              {research.valuation && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>AI VALUATION</div>
                  <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#1DB972' }}>
                    ${(research.valuation / 1e9).toFixed(2)}B
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={generateMemo}
            disabled={memoLoading}
            style={{
              width: '100%', padding: '10px', marginTop: 16,
              background: memoLoading ? 'var(--bg-surface)' : 'var(--accent)',
              color: memoLoading ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
              cursor: memoLoading ? 'wait' : 'pointer'
            }}
          >
            {memoLoading ? 'Generating Memo...' : 'Generate Investment Memo'}
          </button>
        </div>
      </div>

      {showMemo && memo && (
        <>
          <div onClick={() => setShowMemo(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 600, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-secondary)', zIndex: 501, maxHeight: '80vh', overflow: 'auto', animation: 'fadeInUp 0.3s ease' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Investment Memo: {name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>AI-generated analysis powered by Mistral</div>
              </div>
              <button onClick={() => setShowMemo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div
              className="memo-rendered"
              style={{ padding: '20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: renderMemo(memo) }}
            />
          </div>
        </>
      )}
    </>
  )
}
