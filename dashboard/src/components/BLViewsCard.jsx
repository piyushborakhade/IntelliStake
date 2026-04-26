import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500'
const DIR_COLOR = { BULLISH: '#10b981', BEARISH: '#ef4444', NEUTRAL: '#f59e0b' }

export default function BLViewsCard() {
  const [data, setData] = useState(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/portfolio/bl-views`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return null

  const { matrix_summary: ms, views = [] } = data

  const chartData = views.map(v => ({
    name: v.startup_name.split(' ')[0],
    'Market prior': parseFloat(v.prior_return_pct.toFixed(1)),
    'AI view (Q)': parseFloat(v.view_q_tilted_pct.toFixed(1)),
    'Posterior': parseFloat(v.posterior_return_pct.toFixed(1)),
  }))

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '20px', marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '14px', fontWeight: '600' }}>
            Black-Litterman AI Views
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '3px 0 0' }}>
            P: identity (absolute views) · tau = {ms?.tau} · Q from trust score + FinBERT sector sentiment
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '22px', fontWeight: '700',
            color: (ms?.avg_ai_view_shift_pp || 0) >= 0 ? '#10b981' : '#ef4444'
          }}>
            {(ms?.avg_ai_view_shift_pp || 0) >= 0 ? '+' : ''}{ms?.avg_ai_view_shift_pp}pp
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>avg posterior shift</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Market prior (avg)', value: `${ms?.prior_avg_return_pct}%`, color: '#6b7280' },
          { label: 'Posterior avg', value: `${ms?.posterior_avg_return_pct}%`, color: '#10b981' },
          { label: 'AI shift', value: `${ms?.avg_ai_view_shift_pp >= 0 ? '+' : ''}${ms?.avg_ai_view_shift_pp}pp`, color: '#3b82f6' },
          { label: 'Sectors w/ FinBERT', value: data.sectors_with_sentiment, color: '#8b5cf6' },
        ].map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px',
            border: `1px solid ${m.color}22`
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: m.color }}>{m.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
        How AI views move the portfolio away from market equilibrium — the core of Black-Litterman
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v, name) => [`${v}%`, name]}
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)', paddingTop: '8px' }} />
          <ReferenceLine y={ms?.prior_avg_return_pct} stroke="#6b7280" strokeDasharray="4 4"
            label={{ value: 'prior avg', fill: '#6b7280', fontSize: 9, position: 'right' }} />
          <Bar dataKey="Market prior" fill="#6b728044" radius={[3, 3, 0, 0]} />
          <Bar dataKey="AI view (Q)" fill="#3b82f688" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Posterior" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <button
        onClick={() => setShowTable(s => !s)}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
          padding: '5px 12px', fontSize: '11px', color: 'var(--text-muted)',
          cursor: 'pointer', margin: '16px 0 0'
        }}
      >
        {showTable ? 'Hide' : 'Show'} P/Q/Omega matrix detail
      </button>

      {showTable && (
        <div style={{ overflowX: 'auto', marginTop: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Startup', 'Sector', 'Trust', 'Prior', 'Q (view)', 'Omega', 'Posterior', 'Signal'].map(h => (
                  <th key={h} style={{ color: 'var(--text-muted)', fontWeight: '500', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {views.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>{v.startup_name}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{v.sector}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{v.trust_score}</td>
                  <td style={{ padding: '7px 8px', color: '#6b7280' }}>{v.prior_return_pct}%</td>
                  <td style={{ padding: '7px 8px', color: '#3b82f6', fontWeight: '600' }}>{v.view_q_tilted_pct}%</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>{v.omega_uncertainty}</td>
                  <td style={{ padding: '7px 8px', color: '#10b981', fontWeight: '700' }}>{v.posterior_return_pct}%</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                      background: `${DIR_COLOR[v.view_direction]}22`,
                      color: DIR_COLOR[v.view_direction]
                    }}>
                      {v.view_direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            marginTop: '10px', padding: '10px 14px',
            background: 'rgba(139,92,246,0.06)', borderRadius: '8px',
            fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.7'
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Matrix notation: </strong>
            P = I (identity, absolute views) · Q = trust score mapped to return view, tilted by FinBERT sector sentiment ·
            Omega = diagonal uncertainty matrix (low trust + sparse headlines = high Omega = prior dominates) ·
            Posterior = (tauSigmaP'(PtauSigmaP'+Omega)^-1)(Q-P*pi) + pi where pi = market equilibrium returns
          </div>
        </div>
      )}

      <div style={{
        marginTop: '14px', padding: '10px 14px',
        background: 'rgba(59,130,246,0.06)', borderRadius: '8px',
        fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6'
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Methodology: </strong>
        {data.defense_statement}
      </div>
    </div>
  )
}
