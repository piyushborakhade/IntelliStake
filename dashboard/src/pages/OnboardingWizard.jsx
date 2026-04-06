/**
 * OnboardingWizard.jsx — 4-step new investor onboarding
 * Runs once after first login for new accounts.
 * Saves investorDNA to sessionStorage for personalization.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SECTORS = ['FinTech','SaaS','D2C','Deeptech','HealthTech','EdTech','Climate','Mobility','AgriTech','SpaceTech'];
const STAGES  = [
  { val: 'early',  label: 'Early Stage (Pre-Seed / Seed)', desc: 'High risk, highest upside. Idea to first product.', icon: '🌱' },
  { val: 'growth', label: 'Growth Stage (Series A / B)', desc: 'Product-market fit found. Scaling revenue.', icon: '📈' },
  { val: 'late',   label: 'Late Stage (Series C+)', desc: 'Market leader. Lower risk, near-IPO.', icon: '🏆' },
  { val: 'all',    label: 'All Stages', desc: 'Diversified across the lifecycle.', icon: '⚖️' },
];
const CAPITALS = [
  { val: 'micro', label: 'Under ₹1L', desc: 'Micro ticket · Learning the ropes' },
  { val: 'small', label: '₹1L – ₹10L', desc: 'Small ticket · Retail investor' },
  { val: 'mid',   label: '₹10L – ₹50L', desc: 'Mid ticket · Accredited investor' },
  { val: 'large', label: '₹50L – ₹5Cr', desc: 'Large ticket · HNWI' },
  { val: 'inst',  label: '₹5Cr+', desc: 'Institutional size' },
];

const STEPS = [
  { id: 'welcome',  label: 'Welcome', icon: '👋' },
  { id: 'profile',  label: 'Your Profile', icon: '🎯' },
  { id: 'sectors',  label: 'Sectors', icon: '🗂️' },
  { id: 'finalize', label: 'Done!', icon: '🚀' },
];

export default function OnboardingWizard() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [step, setStep] = useState(0);

  const [riskVal,  setRiskVal]  = useState(1);
  const [capital,  setCapital]  = useState('');
  const [lockup,   setLockup]   = useState('');
  const [stage,    setStage]    = useState('');
  const [sectors,  setSectors]  = useState([]);

  const riskLabels = ['Conservative 🔵', 'Balanced ⚡', 'Aggressive 🔥'];
  const riskColors = ['#06b6d4', '#6366f1', '#f59e0b'];
  const riskColor  = riskColors[riskVal];
  const riskLabel  = riskLabels[riskVal];

  const toggleSector = (s) => setSectors(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const finish = () => {
    const dna = { riskAppetite: ['conservative','balanced','aggressive'][riskVal], capital, lockup, stage, sectors, createdAt: Date.now() };
    sessionStorage.setItem('is_investor_dna', JSON.stringify(dna));
    sessionStorage.setItem('is_onboarded', '1');
    navigate('/dashboard');
  };

  const card = (content) => (
    <div style={{
      background: '#0a0a0f', borderRadius: 24,
      border: '1px solid rgba(99,102,241,0.2)',
      padding: 48, maxWidth: 560, width: '100%',
      boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
      animation: 'slide-in-right 0.25s ease',
    }}>
      {content}
    </div>
  );

  const pill = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 999,
      border: `1px solid ${active ? riskColor : 'rgba(255,255,255,0.08)'}`,
      background: active ? `${riskColor}18` : 'rgba(255,255,255,0.02)',
      color: active ? riskColor : '#475569',
      fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  );

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const navBtn = (label, action, disabled = false, primary = true) => (
    <button onClick={action} disabled={disabled} style={{
      padding: '13px 28px', borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: primary ? 'var(--grad-indigo)' : 'rgba(255,255,255,0.04)',
      color: primary ? '#fff' : '#475569', fontSize: 15, fontWeight: 700, opacity: disabled ? 0.4 : 1,
      fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', transition: 'all 0.2s',
    }}>{label}</button>
  );

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      backgroundImage: 'radial-gradient(ellipse at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 60%)',
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 999, padding: 4 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: i === step ? 'rgba(99,102,241,0.15)' : 'transparent',
            transition: 'all 0.3s',
          }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <span style={{ fontSize: 12, fontWeight: i === step ? 700 : 400, color: i === step ? '#818cf8' : '#334155' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 0 — Welcome */}
      {step === 0 && card(<>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔭</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
          Welcome to IntelliStake, {user?.name?.split(' ')[0] || 'Investor'}.
        </h1>
        <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 32 }}>
          In the next 60 seconds, we'll personalize your entire experience — the startups you see, your portfolio weights, and how your risk is calculated.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {[
            { icon: '🧠', t: 'AI that speaks your language', d: 'Every score explained in plain English' },
            { icon: '💼', t: 'Portfolio built for you', d: 'Black-Litterman weights tuned to your risk DNA' },
            { icon: '⛓️', t: 'Capital protected on-chain', d: 'Milestone escrow — funds release when targets hit' },
          ].map(f => (
            <div key={f.t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.t}</div><div style={{ fontSize: 12, color: '#475569' }}>{f.d}</div></div>
            </div>
          ))}
        </div>
        {navBtn('Get Started →', next)}
      </>)}

      {/* STEP 1 — Profile */}
      {step === 1 && card(<>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Your investing style</h2>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 28 }}>This shapes your portfolio weights and startup feed.</p>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 12, letterSpacing: '0.06em' }}>RISK APPETITE</label>
          <div style={{ padding: '20px 24px', borderRadius: 12, background: `${riskColor}08`, border: `1px solid ${riskColor}25`, marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: riskColor, marginBottom: 4 }}>{riskLabel}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              {riskVal === 0 ? 'Stable, predictable growth. Series B+. Max drawdown 5%.' :
               riskVal === 1 ? 'Balanced growth. Series A–C. Sharpe 0.93. 1–3yr lockup.' :
               'Maximum upside. Pre-Seed to early. 5yr+ horizon.'}
            </div>
          </div>
          <input type="range" min="0" max="2" step="1" value={riskVal} onChange={e => setRiskVal(+e.target.value)} style={{ width: '100%', accentColor: riskColor, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
            <span>Conservative</span><span>Balanced</span><span>Aggressive</span>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 12, letterSpacing: '0.06em' }}>TICKET SIZE</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CAPITALS.map(c => (
              <div key={c.val} onClick={() => setCapital(c.val)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: capital === c.val ? `${riskColor}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${capital === c.val ? riskColor + '40' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 12, letterSpacing: '0.06em' }}>PREFERRED STAGE</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STAGES.map(s => (
              <div key={s.val} onClick={() => setStage(s.val)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: stage === s.val ? `${riskColor}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${stage === s.val ? riskColor + '40' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {navBtn('← Back', back, false, false)}
          {navBtn('Continue →', next, !capital || !stage)}
        </div>
      </>)}

      {/* STEP 2 — Sectors */}
      {step === 2 && card(<>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Which sectors excite you?</h2>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 28 }}>Pick any. Your feed will prioritize these. You can always change later.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
          {SECTORS.map(s => (
            <button key={s} onClick={() => toggleSector(s)} style={{
              padding: '10px 18px', borderRadius: 999,
              border: `1px solid ${sectors.includes(s) ? riskColor : 'rgba(255,255,255,0.08)'}`,
              background: sectors.includes(s) ? `${riskColor}18` : 'rgba(255,255,255,0.02)',
              color: sectors.includes(s) ? riskColor : '#94a3b8',
              fontSize: 13, fontWeight: sectors.includes(s) ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {sectors.includes(s) ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 12, letterSpacing: '0.06em' }}>LOCKUP HORIZON</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['< 1yr', '1–3yr', '3–5yr', '5yr+'].map(l => (
              <button key={l} onClick={() => setLockup(l)} style={{ flex: 1, padding: '10px', borderRadius: 999,
                border: `1px solid ${lockup === l ? riskColor : 'rgba(255,255,255,0.08)'}`,
                background: lockup === l ? `${riskColor}18` : 'transparent',
                color: lockup === l ? riskColor : '#475569',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {navBtn('← Back', back, false, false)}
          {navBtn('Continue →', next, !lockup)}
        </div>
      </>)}

      {/* STEP 3 — Finalize */}
      {step === 3 && card(<>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>You're all set!</h2>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 32 }}>
            Your IntelliStake is now personalized. Your portfolio engine is initializing with your risk profile.
          </p>
          <div style={{ padding: '20px 24px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12, fontFamily: 'DM Mono, monospace' }}>YOUR INVESTOR DNA</div>
            {[
              ['Risk', riskLabel],
              ['Ticket', CAPITALS.find(c => c.val === capital)?.label || capital],
              ['Stage', STAGES.find(s => s.val === stage)?.label || stage],
              ['Sectors', sectors.length ? sectors.join(', ') : 'All'],
              ['Lockup', lockup],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#334155', fontFamily: 'DM Mono, monospace' }}>{k}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={finish} style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: 'var(--grad-primary)', color: '#fff', fontSize: 16, fontWeight: 800,
            fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', cursor: 'pointer',
            boxShadow: '0 12px 40px rgba(99,102,241,0.4)', transition: 'all 0.2s',
          }}>
            Enter IntelliStake →
          </button>
        </div>
      </>)}
    </div>
  );
}
