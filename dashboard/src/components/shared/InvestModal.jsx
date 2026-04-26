/**
 * InvestModal.jsx — Slide-in investment panel with blockchain transaction animation
 * Stages: form → confirm → blockchain → done | error
 */
import { useState, useEffect } from 'react';
import { logTransaction } from '../../utils/supabase';

const RISK_TIERS = [
  { label: 'Conservative', pct: 5,  color: '#3b82f6', desc: '~5% of portfolio' },
  { label: 'Balanced',     pct: 10, color: '#6366f1', desc: '~10% of portfolio' },
  { label: 'Aggressive',   pct: 20, color: '#8b5cf6', desc: '~20% of portfolio' },
];

const formatINR = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function randHex(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Blockchain animation ──────────────────────────────────────────────────────
const CHAIN_STEPS = [
  { label: 'Connecting wallet',        icon: '🔐', detail: 'Deriving key from session credential…'     },
  { label: 'Signing transaction',      icon: '✍️',  detail: 'ECDSA secp256k1 signature applied…'        },
  { label: 'Broadcasting to network',  icon: '📡', detail: 'Submitting tx to IntelliStake Testnet…'    },
  { label: 'Mining block',             icon: '⛏️',  detail: 'Waiting for validator node confirmation…' },
  { label: 'Block confirmed',          icon: '✅', detail: 'Transaction finalized · 6/6 confirmations' },
];

function BlockchainAnimation({ startup, amount, tier, wallet, txHash, blockNo, onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timings = [800, 1000, 900, 1400, 800]; // ms per step
    let idx = 0;
    const next = () => {
      idx++;
      setStep(idx);
      if (idx < timings.length) setTimeout(next, timings[idx]);
      else onDone?.();
    };
    setTimeout(next, timings[0]);
  }, []);

  const steps = CHAIN_STEPS;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>BLOCKCHAIN TRANSACTION</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#f0f4ff', marginBottom: 4 }}>
          {formatINR(amount)} → {startup?.startup_name}
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#475569', wordBreak: 'break-all' }}>
          {txHash}
        </div>
      </div>

      {/* Wallet address */}
      <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>💼</span>
        <div>
          <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 2 }}>INVESTOR WALLET</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#818cf8' }}>{wallet}</div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => {
          const done    = step > i;
          const active  = step === i;
          const pending = step < i;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16, position: 'relative' }}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', left: 15, top: 32, width: 2, height: 'calc(100% - 16px)', background: done ? '#10b981' : 'rgba(255,255,255,0.06)', transition: 'background 0.4s ease' }} />
              )}
              {/* Circle */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                background: done ? '#10b981' : active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
                border: `2px solid ${done ? '#10b981' : active ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.4s ease',
                position: 'relative', zIndex: 1,
              }}>
                {done ? '✓' : active ? (
                  <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite', fontSize: 12 }}>◌</span>
                ) : '○'}
              </div>
              {/* Text */}
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: done ? 700 : active ? 700 : 400, color: done ? '#10b981' : active ? '#c7d2fe' : '#475569', transition: 'color 0.3s' }}>
                  {s.label}
                </div>
                {(done || active) && (
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Block number */}
      {step >= 4 && (
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>BLOCK #{blockNo}</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#10b981' }}>CONFIRMED</span>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function persistHoldingLocally(startup, amount, tier) {
  try {
    const key = 'is_local_holdings';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    // Find if startup already exists
    const idx = existing.findIndex(h => h.startup_name === startup.startup_name);
    if (idx >= 0) {
      existing[idx].invested_amount = (Number(existing[idx].invested_amount) + amount);
      existing[idx].current_value   = existing[idx].invested_amount * 1.05;
    } else {
      existing.push({
        startup_name:    startup.startup_name,
        sector:          startup.sector || 'FinTech',
        trust_score:     startup.trust_score || 0.75,
        funding_stage:   startup.funding_stage || 'Series B',
        invested_amount: amount,
        current_value:   amount * 1.05,
        pnl:             amount * 0.05,
        allocation_pct:  10,
        ai_badge:        'HOLD',
        risk_tier:       tier,
        created_at:      new Date().toISOString(),
      });
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn('Could not persist holding locally', e);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvestModal({ startup, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [tier,   setTier]     = useState(1);
  const [stage,  setStage]    = useState('form'); // form | confirm | blockchain | done | error
  const [errMsg, setErrMsg]   = useState('');

  // Blockchain tx details (generated once on confirm)
  const [txHash,  setTxHash]  = useState('');
  const [wallet,  setWallet]  = useState('');
  const [blockNo, setBlockNo] = useState(0);

  if (!startup) return null;

  const trust      = Number(startup.trust_score || 0.75);
  const trustPct   = (trust * 100).toFixed(0);
  const trustColor = trust >= 0.75 ? '#10b981' : trust >= 0.55 ? '#f59e0b' : '#ef4444';

  const minInvest = 10_000;
  const maxInvest = 50_00_000;
  const amt       = Number(amount) || 0;
  const valid     = amt >= minInvest && amt <= maxInvest;

  const projectedReturn = amt * (1 + trust * 0.4) * 3;

  const handleConfirm = () => setStage('confirm');

  const handleExecute = () => {
    const tx    = `0x${randHex(64)}`;
    const wal   = `0x${randHex(40).toUpperCase()}`;
    const block = Math.floor(8_000_000 + Math.random() * 1_000_000);
    setTxHash(tx);
    setWallet(wal);
    setBlockNo(block);
    setStage('blockchain');
  };

  const handleBlockchainDone = async () => {
    try {
      await logTransaction({
        startup_name: startup.startup_name,
        sector:       startup.sector,
        amount:       amt,
        trust_score:  trust,
        risk_tier:    RISK_TIERS[tier].label,
        tx_type:      'BUY',
        tx_hash:      txHash,
        block_number: blockNo,
        timestamp:    new Date().toISOString(),
      });
      persistHoldingLocally(startup, amt, RISK_TIERS[tier].label);
      // Also try to POST to backend
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5500'}/api/user/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:          'buy',
          startup_name:    startup.startup_name,
          sector:          startup.sector,
          invested_amount: amt,
          trust_score:     trust,
          allocation_pct:  0,
          user_id:         localStorage.getItem('is_user_id') || 'demo',
        }),
      }).catch(() => {});
      // Notify global AUM ledger
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5500'}/api/admin/global-aum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, user_id: localStorage.getItem('is_user_id') || 'demo', timestamp: new Date().toISOString() }),
      }).catch(() => {});
      setStage('done');
      onSuccess?.({ startup, amount: amt, tier: RISK_TIERS[tier].label });
    } catch (e) {
      setErrMsg(e.message || 'Failed to finalise transaction');
      setStage('error');
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
      onClick={(e) => e.target === e.currentTarget && !['confirm','blockchain'].includes(stage) && onClose()}
    >
      <div style={{ width: 460, height: '100vh', background: '#09090f', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto', animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 4 }}>INVEST NOW</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f0f4ff' }}>{startup.startup_name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{startup.sector} · Trust {trustPct}/100</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Trust bar */}
        <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${trustPct}%`, background: trustColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#475569' }}>AI Trust Score</span>
            <span style={{ fontSize: 10, color: trustColor, fontWeight: 700 }}>{trustPct}/100</span>
          </div>
        </div>

        {/* Metric tiles (always visible) */}
        {stage === 'form' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '14px 24px 0', flexShrink: 0 }}>
            {[
              { label: 'Stage',      value: startup.funding_stage || 'Series B' },
              { label: 'Sector',     value: startup.sector || 'FinTech' },
              { label: 'Country',    value: startup.country || 'India' },
              { label: 'Employees',  value: startup.employee_count ? startup.employee_count.toLocaleString() : '—' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── FORM ── */}
        {stage === 'form' && (
          <>
            <div style={{ padding: '18px 24px 0' }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 10 }}>RISK TIER</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {RISK_TIERS.map((t, i) => (
                  <button key={t.label} onClick={() => setTier(i)} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: `1px solid ${tier === i ? t.color : 'rgba(255,255,255,0.08)'}`, background: tier === i ? `${t.color}18` : 'rgba(255,255,255,0.03)', color: tier === i ? t.color : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                    <div>{t.label}</div>
                    <div style={{ fontWeight: 400, fontSize: 10, marginTop: 2, opacity: 0.8 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '18px 24px 0' }}>
              <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 8 }}>INVESTMENT AMOUNT (₹)</label>
              <input
                type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500000" min={minInvest} max={maxInvest}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 10, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${amount && !valid ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, color: '#f0f4ff', fontSize: 16, fontFamily: 'DM Mono, monospace', outline: 'none' }}
              />
              <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Min: {formatINR(minInvest)} · Max: {formatINR(maxInvest)}</div>
              {amount && !valid && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Amount must be between {formatINR(minInvest)} and {formatINR(maxInvest)}</div>}
            </div>

            {valid && (
              <div style={{ margin: '16px 24px 0', padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, marginBottom: 10 }}>3-YEAR PROJECTION (ILLUSTRATIVE)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><div style={{ fontSize: 10, color: '#475569' }}>Invested</div><div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}>{formatINR(amt)}</div></div>
                  <div><div style={{ fontSize: 10, color: '#475569' }}>Projected Value</div><div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', fontFamily: 'DM Mono, monospace' }}>{formatINR(projectedReturn)}</div></div>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 8 }}>Based on trust score · Not financial advice</div>
              </div>
            )}

            <div style={{ padding: '20px 24px', marginTop: 'auto' }}>
              <button onClick={handleConfirm} disabled={!valid} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: valid ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)', color: valid ? '#fff' : '#475569', fontSize: 15, fontWeight: 800, cursor: valid ? 'pointer' : 'default', transition: 'opacity 0.15s' }}>
                Review Order →
              </button>
            </div>
          </>
        )}

        {/* ── CONFIRM ── */}
        {stage === 'confirm' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Review your order</div>
            {[
              { label: 'Startup',    value: startup.startup_name },
              { label: 'Amount',     value: formatINR(amt) },
              { label: 'Risk Tier',  value: RISK_TIERS[tier].label },
              { label: 'Trust Score', value: `${trustPct}/100` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 12, fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>
              Confirming will initiate an on-chain transaction on the IntelliStake testnet. No real funds are transferred.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <button onClick={() => setStage('form')} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Back</button>
              <button onClick={handleExecute} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}>
                Sign & Execute On-Chain
              </button>
            </div>
          </div>
        )}

        {/* ── BLOCKCHAIN ── */}
        {stage === 'blockchain' && (
          <BlockchainAnimation
            startup={startup} amount={amt} tier={RISK_TIERS[tier].label}
            wallet={wallet} txHash={txHash} blockNo={blockNo}
            onDone={handleBlockchainDone}
          />
        )}

        {/* ── DONE ── */}
        {stage === 'done' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>Investment Complete!</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
              {formatINR(amt)} invested in <strong style={{ color: '#e2e8f0' }}>{startup.startup_name}</strong>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#334155', wordBreak: 'break-all', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              Block #{blockNo}<br />{txHash?.slice(0, 34)}…
            </div>
            <div style={{ fontSize: 11, color: '#475569', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 14px' }}>
              Your Holdings page has been updated
            </div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '11px 28px', borderRadius: 10, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Close</button>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>Transaction Failed</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{errMsg}</div>
            <button onClick={() => setStage('form')} style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Try Again</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
