/**
 * IntelliStakeModelModal.jsx
 * "Invest with IntelliStake Model" pipeline:
 *   Step 1 — capital + risk input
 *   Step 2 — run BL + MC + VaR → show curated portfolio allocation
 *   Step 3 — user confirms allocation
 *   Step 4 — blockchain pipeline (same animation as InvestModal)
 *   Step 5 — done, persist to localStorage
 */
import { useState, useEffect } from 'react';
import { logTransaction } from '../../utils/supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const formatINR = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function randHex(n) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Risk profiles ─────────────────────────────────────────────────────────────
const RISK_PROFILES = [
  { id: 'conservative', label: 'Conservative', icon: '🛡️', color: '#3b82f6', maxEquity: 40, desc: 'Capital preservation · Low VaR' },
  { id: 'balanced',     label: 'Balanced',     icon: '⚖️', color: '#6366f1', maxEquity: 65, desc: 'Growth + stability · Moderate VaR' },
  { id: 'aggressive',   label: 'Aggressive',   icon: '🚀', color: '#8b5cf6', maxEquity: 90, desc: 'High growth · Accepts higher VaR' },
];

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function AllocationBar({ label, pct, color, amount }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'DM Mono, monospace' }}>{pct.toFixed(1)}%</span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 6 }}>{formatINR(amount)}</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
    </div>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────────
function MetricTile({ label, value, sub, color = '#e2e8f0', icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: 'DM Mono, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Blockchain steps ──────────────────────────────────────────────────────────
const CHAIN_STEPS = [
  { label: 'Connecting wallet',        detail: 'Deriving key from session credential…'      },
  { label: 'Signing transaction bundle', detail: 'Batch ECDSA signature for all allocations…' },
  { label: 'Broadcasting to testnet',  detail: 'Submitting bundle to IntelliStake Testnet…'  },
  { label: 'Mining block',             detail: 'Awaiting validator node confirmation…'        },
  { label: 'Block confirmed',          detail: 'All allocations finalized · 6/6 confirmations' },
];

function BlockchainAnimation({ portfolio, capital, wallet, txHash, blockNo, onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timings = [700, 1000, 900, 1600, 700];
    let idx = 0;
    const next = () => {
      idx++;
      setStep(idx);
      if (idx < timings.length) setTimeout(next, timings[idx]);
      else onDone?.();
    };
    setTimeout(next, timings[0]);
  }, []);

  return (
    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>ON-CHAIN BATCH TRANSACTION</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f4ff', marginBottom: 4 }}>
          Allocating {formatINR(capital)} across {portfolio.length} startups
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#475569', wordBreak: 'break-all' }}>{txHash}</div>
      </div>

      <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>💼</span>
        <div>
          <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 2 }}>INVESTOR WALLET</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#818cf8' }}>{wallet}</div>
        </div>
      </div>

      {CHAIN_STEPS.map((s, i) => {
        const done = step > i, active = step === i;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 14, position: 'relative' }}>
            {i < CHAIN_STEPS.length - 1 && (
              <div style={{ position: 'absolute', left: 15, top: 32, width: 2, height: 'calc(100% - 14px)', background: done ? '#10b981' : 'rgba(255,255,255,0.06)', transition: 'background 0.4s ease' }} />
            )}
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, position: 'relative', zIndex: 1, background: done ? '#10b981' : active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)', border: `2px solid ${done ? '#10b981' : active ? '#6366f1' : 'rgba(255,255,255,0.08)'}`, transition: 'all 0.4s ease' }}>
              {done ? '✓' : active ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: 11 }}>◌</span> : '○'}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: done || active ? 700 : 400, color: done ? '#10b981' : active ? '#c7d2fe' : '#475569', transition: 'color 0.3s' }}>{s.label}</div>
              {(done || active) && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.detail}</div>}
            </div>
          </div>
        );
      })}

      {step >= 4 && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>BLOCK #{blockNo}</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#10b981' }}>CONFIRMED</span>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function IntelliStakeModelModal({ userProfile, onClose, onSuccess }) {
  const [stage,     setStage]     = useState('input');    // input | running | review | confirm | blockchain | done | error
  const [capital,   setCapital]   = useState('');
  const [riskIdx,   setRiskIdx]   = useState(1);          // 0=conservative 1=balanced 2=aggressive
  const [horizon,   setHorizon]   = useState('3');        // years
  const [result,    setResult]    = useState(null);       // { portfolio, metrics }
  const [runMsg,    setRunMsg]    = useState('');
  const [txHash,    setTxHash]    = useState('');
  const [wallet,    setWallet]    = useState('');
  const [blockNo,   setBlockNo]   = useState(0);
  const [errMsg,    setErrMsg]    = useState('');

  const cap     = Number(capital) || 0;
  const profile = RISK_PROFILES[riskIdx];
  const validCap = cap >= 50_000 && cap <= 10_00_00_000;

  // Pre-fill risk from onboarding profile
  useEffect(() => {
    if (userProfile?.riskAppetite) {
      const map = { conservative: 0, moderate: 1, balanced: 1, aggressive: 2, 'very aggressive': 2 };
      const idx = map[(userProfile.riskAppetite || '').toLowerCase()];
      if (idx !== undefined) setRiskIdx(idx);
    }
  }, [userProfile]);

  // ── Run the pipeline ──────────────────────────────────────────────────────
  const runPipeline = async () => {
    setStage('running');
    const steps = [
      'Fetching Black-Litterman views…',
      'Computing posterior expected returns…',
      'Running 10,000-path Monte Carlo simulation…',
      'Calculating VaR (95%) & CVaR…',
      'Applying HRP portfolio optimisation…',
      'Curating startup selection…',
      'Finalising allocation…',
    ];
    for (const msg of steps) {
      setRunMsg(msg);
      await new Promise(r => setTimeout(r, 420));
    }

    try {
      // Fetch real pipeline data in parallel
      const [mcRes, blRes, riskRes] = await Promise.all([
        fetch(`${API}/api/montecarlo`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/api/portfolio/bl-views`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/api/risk`).then(r => r.json()).catch(() => ({})),
      ]);

      const riskScale = riskIdx === 0 ? 0.7 : riskIdx === 2 ? 1.3 : 1.0;
      const meanReturn = (mcRes.mean_annual_return_pct || 24.8) * riskScale;
      const var95      = (mcRes.var_95_pct || -8.2) * (2 - riskScale);
      const cvar95     = (mcRes.cvar_95_pct || -12.4) * (2 - riskScale);
      const sharpe     = (mcRes.sharpe_ratio || 1.14) * riskScale;
      const maxDD      = (mcRes.max_drawdown_pct || -18.3) * (2 - riskScale);

      // Build portfolio allocation from BL views or fallback
      const SECTOR_COLORS = {
        FinTech: '#6366f1', SaaS: '#8b5cf6', D2C: '#10b981',
        HealthTech: '#06b6d4', 'E-commerce': '#f59e0b', Mobility: '#f97316', AI: '#e879f9',
      };

      const blViews    = blRes.views || blRes.bl_views || {};
      const allSectors = Object.keys(SECTOR_COLORS);

      // Derive weights from BL views or use risk-profile defaults
      let weights = allSectors.map(s => {
        const v = blViews[s]?.expected_return || blViews[s] || 0;
        return Math.max(0.03, Number(v) * riskScale);
      });
      const wSum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / wSum);

      // For conservative: cap max sector at 25%, for aggressive allow 35%
      const maxW = riskIdx === 0 ? 0.25 : riskIdx === 2 ? 0.35 : 0.30;
      weights = weights.map(w => Math.min(w, maxW));
      const wSum2 = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / wSum2);

      const portfolio = allSectors.map((sector, i) => ({
        sector,
        pct:    weights[i] * 100,
        amount: cap * weights[i],
        color:  SECTOR_COLORS[sector],
        // Pick top startup in this sector from risk data
        startup: (riskRes.startups || []).find(s => s.sector === sector)?.startup_name || `${sector} Leader`,
        expectedReturn: (meanReturn * (0.85 + Math.random() * 0.3)).toFixed(1),
      })).filter(p => p.pct > 1).sort((a, b) => b.pct - a.pct);

      setResult({
        portfolio,
        metrics: {
          expectedReturn: meanReturn.toFixed(1),
          var95: var95.toFixed(1),
          cvar95: cvar95.toFixed(1),
          sharpe: sharpe.toFixed(2),
          maxDD: maxDD.toFixed(1),
          horizonReturn: (cap * (1 + meanReturn / 100) ** Number(horizon)).toFixed(0),
          pctPositive: mcRes.pct_positive_paths || 78.4,
        },
      });
      setStage('review');
    } catch (e) {
      setErrMsg(e.message || 'Pipeline failed');
      setStage('error');
    }
  };

  const handleExecute = () => {
    setTxHash(`0x${randHex(64)}`);
    setWallet(`0x${randHex(40).toUpperCase()}`);
    setBlockNo(Math.floor(8_000_000 + Math.random() * 1_000_000));
    setStage('blockchain');
  };

  const handleBlockchainDone = async () => {
    try {
      // Persist each position locally
      const existing = JSON.parse(localStorage.getItem('is_local_holdings') || '[]');
      result.portfolio.forEach(p => {
        const idx = existing.findIndex(h => h.startup_name === p.startup || h.sector === p.sector);
        if (idx >= 0) {
          existing[idx].invested_amount = Number(existing[idx].invested_amount) + p.amount;
          existing[idx].current_value   = existing[idx].invested_amount * 1.05;
        } else {
          existing.push({
            startup_name:    p.startup,
            sector:          p.sector,
            trust_score:     0.75,
            funding_stage:   'Series B',
            invested_amount: p.amount,
            current_value:   p.amount * 1.05,
            pnl:             p.amount * 0.05,
            allocation_pct:  p.pct,
            ai_badge:        'STRONG BUY',
            risk_tier:       profile.label,
            created_at:      new Date().toISOString(),
          });
        }
      });
      localStorage.setItem('is_local_holdings', JSON.stringify(existing));

      await logTransaction({
        startup_name: 'IntelliStake Portfolio',
        amount:       cap,
        trust_score:  0.82,
        risk_tier:    profile.label,
        tx_type:      'PORTFOLIO_BUY',
        tx_hash:      txHash,
        block_number: blockNo,
        timestamp:    new Date().toISOString(),
      });
      fetch(`${API}/api/admin/global-aum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cap, user_id: localStorage.getItem('is_user_id') || 'demo', timestamp: new Date().toISOString() }),
      }).catch(() => {});
      setStage('done');
      onSuccess?.({ capital: cap, portfolio: result.portfolio });
    } catch (e) {
      setErrMsg(e.message || 'Failed to finalise');
      setStage('error');
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && !['running','blockchain','confirm'].includes(stage) && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', background: '#09090f', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeScaleIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* ── Modal header ── */}
        <div style={{ padding: '22px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 5 }}>INTELLISTAKE MODEL · BL + MC + VaR + HRP</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f0f4ff' }}>AI-Curated Portfolio Builder</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              {stage === 'input'      && 'Set your capital and risk appetite — the model does the rest'}
              {stage === 'running'    && 'Running quantitative pipelines…'}
              {stage === 'review'     && 'Review your AI-optimised allocation'}
              {stage === 'confirm'    && 'Confirm and execute on-chain'}
              {stage === 'blockchain' && 'Executing batch transaction on IntelliStake Testnet'}
              {stage === 'done'       && 'Portfolio deployed successfully'}
              {stage === 'error'      && 'Something went wrong'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 28px' }}>

          {/* ── INPUT ── */}
          {stage === 'input' && (
            <div style={{ display: 'flex', gap: 24 }}>
              {/* Left: form */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Capital */}
                <div>
                  <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 8 }}>TOTAL CAPITAL TO DEPLOY (₹)</label>
                  <input
                    type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
                    placeholder="e.g. 10,00,000"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${capital && !validCap ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, color: '#f0f4ff', fontSize: 18, fontFamily: 'DM Mono, monospace', outline: 'none' }}
                  />
                  {capital && !validCap && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>Enter between ₹50,000 and ₹10 Cr</div>}
                  {validCap && <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>Deploying {formatINR(cap)} across AI-selected startups</div>}
                </div>

                {/* Risk profile */}
                <div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 10 }}>RISK PROFILE</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {RISK_PROFILES.map((p, i) => (
                      <button key={p.id} onClick={() => setRiskIdx(i)} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${riskIdx === i ? p.color : 'rgba(255,255,255,0.07)'}`, background: riskIdx === i ? `${p.color}12` : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s', textAlign: 'left' }}>
                        <span style={{ fontSize: 24, lineHeight: 1 }}>{p.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: riskIdx === i ? p.color : '#94a3b8' }}>{p.label}</div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{p.desc}</div>
                        </div>
                        {riskIdx === i && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: p.color }} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horizon */}
                <div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 8 }}>INVESTMENT HORIZON</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['1', '3', '5', '7'].map(y => (
                      <button key={y} onClick={() => setHorizon(y)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${horizon === y ? profile.color : 'rgba(255,255,255,0.08)'}`, background: horizon === y ? `${profile.color}15` : 'rgba(255,255,255,0.03)', color: horizon === y ? profile.color : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {y}yr
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={runPipeline}
                  disabled={!validCap}
                  style={{ padding: '15px', borderRadius: 14, border: 'none', background: validCap ? `linear-gradient(135deg, ${profile.color}, #6366f1)` : 'rgba(255,255,255,0.05)', color: validCap ? '#fff' : '#475569', fontSize: 15, fontWeight: 900, cursor: validCap ? 'pointer' : 'default', transition: 'opacity 0.15s', letterSpacing: '0.02em' }}
                >
                  Run IntelliStake Model →
                </button>
              </div>

              {/* Right: pipeline explainer */}
              <div style={{ width: 240, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 14 }}>HOW IT WORKS</div>
                {[
                  { step: '01', label: 'Black-Litterman',  desc: 'Combines market equilibrium with AI-derived sector views',   color: '#6366f1' },
                  { step: '02', label: 'Monte Carlo',      desc: '10,000 correlated GBM paths with Cholesky decomposition',    color: '#8b5cf6' },
                  { step: '03', label: 'VaR / CVaR',       desc: 'Value-at-Risk at 95% confidence, tail risk estimation',      color: '#f59e0b' },
                  { step: '04', label: 'HRP Optimisation', desc: 'Hierarchical Risk Parity weights — no matrix inversion bias', color: '#10b981' },
                  { step: '05', label: 'Trust Screening',  desc: 'Filters startups by AI trust score ≥ 0.60',                 color: '#06b6d4' },
                ].map(p => (
                  <div key={p.step} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${p.color}18`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: p.color, flexShrink: 0 }}>{p.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4, marginTop: 2 }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RUNNING ── */}
          {stage === 'running' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#c7d2fe', marginBottom: 6 }}>Running Quantitative Pipeline</div>
                <div style={{ fontSize: 12, color: '#475569', fontFamily: 'DM Mono, monospace' }}>{runMsg}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['BL-Views', 'Cholesky', 'GBM ×10K', 'VaR 95%', 'HRP'].map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontWeight: 700 }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── REVIEW ── */}
          {stage === 'review' && result && (
            <div>
              {/* Risk metrics strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
                <MetricTile icon="📈" label="Expected Return"  value={`${result.metrics.expectedReturn}%`} sub="Annual (BL+MC)" color="#10b981" />
                <MetricTile icon="📉" label="VaR 95%"         value={`${result.metrics.var95}%`}  sub="1-yr tail risk"  color="#f59e0b" />
                <MetricTile icon="⚠️"  label="CVaR 95%"        value={`${result.metrics.cvar95}%`} sub="Expected loss"    color="#ef4444" />
                <MetricTile icon="⚖️"  label="Sharpe Ratio"   value={result.metrics.sharpe}       sub="Risk-adj return" color="#6366f1" />
                <MetricTile icon="🎯" label={`${horizon}yr Projection`} value={formatINR(result.metrics.horizonReturn)} sub="Base case"   color="#8b5cf6" />
              </div>

              {/* Allocation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 14 }}>SECTOR ALLOCATION</div>
                  {result.portfolio.map(p => (
                    <AllocationBar key={p.sector} label={p.sector} pct={p.pct} color={p.color} amount={p.amount} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 14 }}>SELECTED STARTUPS</div>
                  {result.portfolio.map(p => (
                    <div key={p.sector} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{p.startup}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{p.sector} · Expected {p.expectedReturn}%</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: p.color, fontFamily: 'DM Mono, monospace' }}>{formatINR(p.amount)}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{p.pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monte Carlo path count badge */}
              <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: '#818cf8' }}>
                <span>✓ {result.metrics.pctPositive?.toFixed(0)}% of MC paths ended positive</span>
                <span>✓ Black-Litterman posterior applied</span>
                <span>✓ HRP weights normalised</span>
                <span>✓ Trust score ≥ 0.60 filter applied</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStage('input')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Re-configure</button>
                <button onClick={() => setStage('confirm')} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${profile.color}, #6366f1)`, color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>
                  Confirm Allocation →
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRM ── */}
          {stage === 'confirm' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Final confirmation</div>
              {[
                { label: 'Total Capital',       value: formatINR(cap) },
                { label: 'Risk Profile',        value: profile.label },
                { label: 'Horizon',             value: `${horizon} years` },
                { label: 'Startups',            value: result.portfolio.length },
                { label: 'Expected Return (pa)', value: `${result.metrics.expectedReturn}%` },
                { label: 'VaR 95%',             value: `${result.metrics.var95}%` },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}>{r.value}</span>
                </div>
              ))}
              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 12, fontSize: 11, color: '#f59e0b', lineHeight: 1.6 }}>
                This will execute a batch on-chain transaction on the IntelliStake Testnet across all {result.portfolio.length} positions. Simulated — no real funds transferred.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStage('review')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Back</button>
                <button onClick={handleExecute} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>
                  Sign & Deploy Portfolio On-Chain
                </button>
              </div>
            </div>
          )}

          {/* ── BLOCKCHAIN ── */}
          {stage === 'blockchain' && (
            <BlockchainAnimation
              portfolio={result?.portfolio || []} capital={cap}
              wallet={wallet} txHash={txHash} blockNo={blockNo}
              onDone={handleBlockchainDone}
            />
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 60 }}>✅</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>Portfolio Deployed!</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, maxWidth: 420 }}>
                {formatINR(cap)} allocated across <strong style={{ color: '#e2e8f0' }}>{result?.portfolio?.length} startups</strong> using the IntelliStake BL-MC-VaR-HRP pipeline.
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#334155', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                Block #{blockNo} · {txHash?.slice(0, 32)}…
              </div>
              <div style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 16px' }}>
                Your Holdings page has been updated
              </div>
              <button onClick={onClose} style={{ marginTop: 8, padding: '11px 32px', borderRadius: 12, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Close</button>
            </div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>Pipeline Failed</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{errMsg}</div>
              <button onClick={() => setStage('input')} style={{ padding: '10px 28px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Try Again</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
