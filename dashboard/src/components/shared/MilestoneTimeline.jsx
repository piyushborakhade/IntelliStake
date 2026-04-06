/**
 * MilestoneTimeline.jsx — 4-tranche escrow visualizer
 * Shows T1→T4 as a horizontal timeline with animated fills.
 * Lens-aware: user mode shows plain English, admin shows contract state.
 *
 * Props:
 *   deal   { name, tranches: [{id, pct, label, condition, status, txHash, amount}] }
 *   mode   'user' | 'admin'
 */
const TRANCHE_DEFAULTS = [
  { id: 'T1', pct: 25, label: 'Initial Release',     condition: 'On deposit',            userLabel: 'Deal opened — 25% released',          icon: '🚀' },
  { id: 'T2', pct: 25, label: 'GitHub Velocity',      condition: 'HIGH commit velocity',  userLabel: 'Active development confirmed',         icon: '💻' },
  { id: 'T3', pct: 25, label: 'Trust Threshold',      condition: 'trust_score ≥ 0.50',    userLabel: 'AI confidence milestone reached',      icon: '🧠' },
  { id: 'T4', pct: 25, label: 'Compliance Audit',     condition: 'MCA audit clean',       userLabel: 'Final compliance check passed',        icon: '✅' },
];

const STATUS_STYLES = {
  RELEASED: { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  label: 'Released' },
  ACTIVE:   { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  label: 'In progress', pulse: true },
  LOCKED:   { color: '#475569', bg: 'rgba(71,85,105,0.08)',   border: 'rgba(71,85,105,0.15)', label: 'Locked' },
  FROZEN:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)', label: '🔴 Frozen' },
};

export default function MilestoneTimeline({ deal = {}, mode = 'user' }) {
  const tranches = deal.tranches || TRANCHE_DEFAULTS.map((t, i) => ({
    ...t,
    status: i === 0 ? 'RELEASED' : i === 1 ? 'ACTIVE' : 'LOCKED',
    amount: deal.total_eth ? (deal.total_eth * t.pct / 100).toFixed(4) + ' ETH' : null,
    txHash: i === 0 ? '0x4f2a…e982' : null,
  }));

  const totalReleased = tranches.filter(t => t.status === 'RELEASED').reduce((s, t) => s + t.pct, 0);
  const frozen = tranches.some(t => t.status === 'FROZEN');

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{deal.name || 'Milestone Escrow'}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {mode === 'user'
              ? `${totalReleased}% of funds released · ${100 - totalReleased}% locked`
              : `${totalReleased}% released · ${frozen ? '⚠️ FROZEN' : 'nominal'} · ${deal.tvl_eth || 0} ETH TVL`}
          </div>
        </div>
        {frozen && (
          <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
            {mode === 'user' ? '⚠️ Deal paused by compliance' : 'ORACLE_FREEZE · trust<0.35'}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', marginBottom: 28, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${totalReleased}%`, borderRadius: 999,
          background: frozen ? '#ef4444' : 'var(--grad-emerald)',
          transition: 'width 1s ease', boxShadow: frozen ? 'none' : '0 0 12px rgba(16,185,129,0.4)',
        }} />
      </div>

      {/* Tranche nodes */}
      <div style={{ position: 'relative' }}>
        {/* Connector line */}
        <div style={{
          position: 'absolute', top: 22, left: 22, right: 22, height: 2,
          background: 'rgba(255,255,255,0.06)', zIndex: 0,
        }}>
          <div style={{
            height: '100%', width: `${(totalReleased / 100) * 100}%`,
            background: frozen ? '#ef4444' : '#10b981',
            transition: 'width 1s ease',
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, position: 'relative', zIndex: 1 }}>
          {tranches.map((tranche, i) => {
            const st  = STATUS_STYLES[tranche.status] || STATUS_STYLES.LOCKED;
            const def = TRANCHE_DEFAULTS[i] || {};
            return (
              <div key={tranche.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {/* Node */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: st.bg, border: `2px solid ${st.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, transition: 'all 0.3s',
                  boxShadow: tranche.status === 'RELEASED' ? `0 0 16px ${st.color}40` : 'none',
                  animation: tranche.status === 'ACTIVE' ? 'pulse-ring 2s ease-out infinite' : 'none',
                  position: 'relative',
                }}>
                  {tranche.status === 'RELEASED' ? '✓' : tranche.status === 'FROZEN' ? '🔴' : tranche.icon || def.icon}
                  {tranche.status === 'RELEASED' && (
                    <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${st.color}30`, animation: 'pulse-ring 2.5s ease-out infinite' }} />
                  )}
                </div>

                {/* Card */}
                <div style={{
                  padding: '12px 10px', borderRadius: 12, width: '100%',
                  background: st.bg, border: `1px solid ${st.border}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: st.color, fontWeight: 700, marginBottom: 4 }}>
                    {tranche.id} · {tranche.pct}%
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f4ff', marginBottom: 4, lineHeight: 1.3 }}>
                    {mode === 'user' ? (def.userLabel || tranche.label) : tranche.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
                    {mode === 'user'
                      ? st.label
                      : tranche.condition || def.condition}
                  </div>
                  {tranche.amount && (
                    <div style={{ marginTop: 6, fontFamily: 'DM Mono, monospace', fontSize: 10, color: st.color }}>
                      {tranche.amount}
                    </div>
                  )}
                  {tranche.txHash && mode === 'admin' && (
                    <div style={{ marginTop: 4, fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#334155' }}>
                      TX: {tranche.txHash}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
