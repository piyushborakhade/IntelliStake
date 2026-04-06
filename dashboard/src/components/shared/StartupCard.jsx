/**
 * StartupCard.jsx — Main unit of the startup discovery feed
 * Props:
 *   startup  — raw startup object from API
 *   mode     — 'user' | 'admin'
 *   variant  — 'compact' (feed) | 'expanded' (portfolio)
 *   onView   — handler
 *   onSave   — handler
 *   onInvest — handler
 */
import { useState } from 'react';
import TrustRing from './TrustRing';
import { translateStartup } from '../../utils/lensTranslator';

const SECTOR_COLORS = {
  FinTech: '#6366f1', SaaS: '#8b5cf6', D2C: '#06b6d4',
  Deeptech: '#10b981', EdTech: '#f59e0b', HealthTech: '#f43f5e',
  Climate: '#34d399', Mobility: '#f97316', 'E-commerce': '#06b6d4',
};

export default function StartupCard({ startup = {}, mode = 'user', variant = 'compact', onView, onSave, onInvest, matchScore }) {
  const [saved, setSaved] = useState(false);
  const [hovered, setHovered] = useState(false);

  const data   = translateStartup(startup, mode);
  const trust  = data.trust_display || { label: 'Unrated', color: '#475569', bg: 'transparent' };
  const sector = startup.sector || startup.industry || 'Startup';
  const sColor = SECTOR_COLORS[sector] || '#6366f1';

  const name    = startup.startup_name || startup.name || 'Unnamed Startup';
  const stage   = mode === 'user' ? (data.stage_display || startup.funding_stage || '—') : (startup.funding_stage || '—');
  const revenue = mode === 'user' ? data.revenue_display : `$${((startup.estimated_revenue_usd || 0) / 1e6).toFixed(1)}M`;
  const employees = startup.employee_count ? `${startup.employee_count.toLocaleString()} employees` : null;
  const country = startup.country || 'India';

  if (variant === 'compact') return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 20px', borderRadius: 16,
        background: hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.18)' : 'var(--border)'}`,
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? 'var(--glow-indigo)' : 'none',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={onView}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Logo placeholder */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${sColor}22, ${sColor}44)`,
          border: `1px solid ${sColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: sColor,
          fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
        }}>
          {name.charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{name}</span>
            <span style={{ fontSize: 10, background: `${sColor}18`, color: sColor, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{sector}</span>
            {startup.trust_score >= 0.80 && <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>⭐ Top Pick</span>}
          </div>

          <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{stage}</span>
            {employees && <><span style={{ color: '#1e293b' }}>·</span><span>{employees}</span></>}
            <span style={{ color: '#1e293b' }}>·</span><span>{country}</span>
            {revenue && <><span style={{ color: '#1e293b' }}>·</span><span style={{ color: '#94a3b8' }}>{revenue}</span></>}
          </div>

          {/* Trust bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(startup.trust_score || 0) * 100}%`,
                background: trust.color, borderRadius: 999,
                transition: 'width 0.8s ease', boxShadow: `0 0 8px ${trust.color}60`,
              }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: trust.color, fontWeight: 700, flexShrink: 0 }}>
              {mode === 'admin' ? (startup.trust_score || 0).toFixed(2) : trust.label.split(' ').slice(1).join(' ')}
            </span>
          </div>
        </div>

        {/* Trust ring (small) */}
        <div style={{ flexShrink: 0 }}>
          <TrustRing score={startup.trust_score || 0} size={48} mode={mode} showLabel={false} strokeWidth={4} />
        </div>
      </div>

      {/* Actions row — visible on hover */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 14,
        opacity: hovered ? 1 : 0, transform: hovered ? 'none' : 'translateY(4px)',
        transition: 'all 0.2s',
      }}>
        <button onClick={e => { e.stopPropagation(); setSaved(v => !v); onSave?.(startup); }} style={{
          padding: '6px 14px', borderRadius: 999, border: `1px solid ${saved ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
          background: saved ? 'rgba(16,185,129,0.1)' : 'transparent',
          color: saved ? '#10b981' : '#475569', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {saved ? '✓ Saved' : '+ Save'}
        </button>
        <button onClick={e => { e.stopPropagation(); onView?.(startup); }} style={{
          padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.25)',
          background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, cursor: 'pointer',
        }}>
          Analyze →
        </button>
        {(startup.trust_score || 0) >= 0.40 && (
          <button onClick={e => { e.stopPropagation(); onInvest?.(startup); }} style={{
            padding: '6px 14px', borderRadius: 999, border: 'none',
            background: 'var(--grad-indigo)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>
            Invest →
          </button>
        )}
        {matchScore && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#334155', alignSelf: 'center' }}>Match: {Math.round(matchScore * 100)}%</span>}
      </div>
    </div>
  );

  // Expanded (portfolio) variant
  return (
    <div style={{
      padding: '28px 28px', borderRadius: 20,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      transition: 'all 0.25s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, flexShrink: 0,
          background: `linear-gradient(135deg, ${sColor}22, ${sColor}44)`,
          border: `1px solid ${sColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: sColor,
          fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
        }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 6 }}>{name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: `${sColor}18`, color: sColor, padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>{sector}</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', color: '#94a3b8', padding: '3px 10px', borderRadius: 999 }}>{startup.funding_stage || '—'}</span>
            <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center' }}>{country}</span>
          </div>
        </div>
        <TrustRing score={startup.trust_score || 0} size={72} mode={mode} strokeWidth={6} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: mode === 'user' ? 'Annual Revenue' : 'Revenue (USD)', val: revenue },
          { label: mode === 'user' ? 'Team Size' : 'employee_count', val: employees || '—' },
          { label: mode === 'user' ? 'Trust Level' : 'trust_score', val: mode === 'user' ? trust.label.split(' ').slice(1).join(' ') : (startup.trust_score || 0).toFixed(4) },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, color: '#334155', marginBottom: 6, fontFamily: mode === 'admin' ? 'DM Mono, monospace' : 'inherit', letterSpacing: mode === 'admin' ? '0.04em' : 'normal' }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => onView?.(startup)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Full Analysis →
        </button>
        {(startup.trust_score || 0) >= 0.40 && (
          <button onClick={() => onInvest?.(startup)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--grad-indigo)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
            Invest Now →
          </button>
        )}
      </div>
    </div>
  );
}
