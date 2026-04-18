/**
 * Login.jsx — IntelliStake Auth Modal
 * Slide-up overlay over the landing page canvas.
 * Left: branding/animation. Right: Login + 3-step Registration.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SECTORS = ['FinTech','SaaS','D2C','Deeptech','HealthTech','EdTech','Climate','Mobility'];
const STEPS = ['Account', 'Investor Profile', 'KYC'];

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [tab, setTab]           = useState('login');   // 'login' | 'register'
  const [step, setStep]         = useState(1);         // 1|2|3 for registration
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const [visible, setVisible]   = useState(false);

  // Login fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Register step 1
  const [regName, setRegName]   = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [regConf, setRegConf]   = useState('');

  // Register step 2 (Investor DNA)
  const [capital, setCapital]   = useState('');
  const [lockup, setLockup]     = useState('');
  const [riskVal, setRiskVal]   = useState(1);
  const [sectors, setSectors]   = useState([]);
  const [stage, setStage]       = useState('');

  // Register step 3 (KYC)
  const [accredited, setAccredited] = useState('');
  const [agreed, setAgreed]         = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); triggerShake(); return; }
    setLoading(true);
    try {
      const userData = await login(email, password);
      // ANALYST → warm investor UI; admin/PM → War Room boot
      if (userData?.role === 'ANALYST') {
        navigate('/u/portfolio');
      } else {
        navigate('/boot');
      }
    } catch (err) {
      setError(err.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleRegStep1 = () => {
    if (!regName || !regEmail || !regPass || !regConf) { setError('Please fill in all fields.'); triggerShake(); return; }
    if (regPass !== regConf) { setError('Passwords do not match.'); triggerShake(); return; }
    if (regPass.length < 8) { setError('Password must be at least 8 characters.'); triggerShake(); return; }
    setError(''); setStep(2);
  };

  const handleRegStep2 = () => {
    if (!capital || !lockup || !stage) { setError('Please complete all fields.'); triggerShake(); return; }
    setError(''); setStep(3);
  };

  const handleRegFinal = async () => {
    if (!accredited) { setError('Please select your investor type.'); triggerShake(); return; }
    if (!agreed) { setError('Please accept the Terms of Service.'); triggerShake(); return; }
    setLoading(true);
    setError('');
    try {
      await register(regEmail, regPass, regName, 'ANALYST');
      // New registrations are always ANALYST → investor UI
      navigate('/u/portfolio');
    } catch (err) {
      setError(err.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = (s) => setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const riskLabel = ['Conservative', 'Balanced', 'Aggressive'][riskVal];
  const riskColor = ['#06b6d4', '#6366f1', '#f59e0b'][riskVal];

  // ── Demo accounts helper ──────────────────────────────────────────────────
  const useDemoAdmin    = () => { setEmail('admin@intellistake.ai'); setPassword('Admin@2024!'); };
  const useDemoPM       = () => { setEmail('pm@intellistake.ai');    setPassword('Invest@2024!'); };
  const useDemoAnalyst  = () => { setEmail('analyst@intellistake.ai'); setPassword('Analyse@2024!'); };

  const inputStyle = (err) => ({
    width: '100%', padding: '12px 16px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${err ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
    color: '#f0f4ff', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  });

  const pillBtn = (active, color = '#6366f1') => ({
    padding: '8px 16px', borderRadius: 999, border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${color}18` : 'transparent',
    color: active ? color : '#94a3b8',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(20px)',
      transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
    }}
    onClick={e => { if (e.target === e.currentTarget) navigate('/'); }}>

      <div style={{
        display: 'grid', gridTemplateColumns: '380px 460px',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
        maxHeight: '90vh',
        animation: shake ? 'shake 0.5s ease' : 'none',
      }}>

        {/* ── LEFT: Branding Panel ──────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(160deg, #0a0a14 0%, #050508 100%)',
          borderRight: '1px solid rgba(99,102,241,0.15)',
          padding: '48px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: -80, left: -80, width: 320, height: 320,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>IS</div>
              <span style={{ fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>IntelliStake</span>
            </div>

            <h2 style={{ fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 16 }}>
              {tab === 'login' ? 'Welcome\nback.' : 'Your edge\nin venture.'}
            </h2>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 40 }}>
              {tab === 'login'
                ? 'Your AI-governed investment intelligence platform. Every deal protected by code.'
                : 'Join thousands of accredited investors getting institutional-grade startup intelligence.'}
            </p>

            {/* Mini stats */}
            {[
              { val: '74,577', label: 'Startups tracked' },
              { val: '0.9645', label: 'R² model accuracy' },
              { val: '3 live', label: 'Sepolia contracts' },
            ].map(s => (
              <div key={s.val} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#6366f1', fontWeight: 600, minWidth: 56 }}>{s.val}</span>
                <span style={{ fontSize: 12, color: '#334155' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Demo accounts */}
          {tab === 'login' && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', color: '#334155', marginBottom: 10 }}>DEMO ACCOUNTS</div>
              {[
                { label: '👑 Admin', action: useDemoAdmin },
                { label: '💼 Portfolio Manager', action: useDemoPM },
                { label: '🔍 Analyst', action: useDemoAnalyst },
              ].map(d => (
                <button key={d.label} onClick={d.action} style={{
                  display: 'block', width: '100%', textAlign: 'left', marginBottom: 6,
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  color: '#475569', fontSize: 12, fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.color = '#818cf8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#475569'; }}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Sepolia live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-ring 2s ease-out infinite' }} />
            SEPOLIA TESTNET · LIVE
          </div>
        </div>

        {/* ── RIGHT: Form Panel ─────────────────────────────────────────── */}
        <div style={{
          background: '#0a0a0f', padding: '40px 44px',
          overflowY: 'auto', maxHeight: '90vh',
        }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
            {['login','register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setStep(1); setError(''); }} style={{
                flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: tab === t ? '#818cf8' : '#475569',
                fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.2s',
              }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ── LOGIN FORM ─────────────────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Email address</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" style={inputStyle(false)}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPass ? 'text' : 'password'} placeholder="••••••••" style={{ ...inputStyle(false), paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 14,
                  }}>{showPass ? '🙈' : '👁'}</button>
                </div>
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{
                padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'default' : 'pointer',
                background: loading ? 'rgba(99,102,241,0.3)' : 'var(--grad-indigo)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
                transition: 'all 0.2s',
              }}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>

              <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', margin: '4px 0' }}>── or ──</div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>🦊 MetaMask</button>
                <button type="button" style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>G Google</button>
              </div>

              <div style={{ textAlign: 'center', fontSize: 12, color: '#334155', marginTop: 8 }}>
                No account?{' '}
                <button type="button" onClick={() => { setTab('register'); setStep(1); }} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Create one →</button>
              </div>
            </form>
          )}

          {/* ── REGISTRATION FORM ──────────────────────────────────────── */}
          {tab === 'register' && (
            <div>
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i + 1 < step ? '#10b981' : i + 1 === step ? '#6366f1' : 'rgba(255,255,255,0.06)',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                        transition: 'all 0.3s',
                      }}>
                        {i + 1 < step ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: 11, color: i + 1 === step ? '#818cf8' : '#334155', fontWeight: i + 1 === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < step ? '#10b981' : 'rgba(255,255,255,0.06)', transition: 'background 0.3s' }} />}
                  </React.Fragment>
                ))}
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

              {/* STEP 1 */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Create your account</h3>
                  {[
                    { label: 'Full Name', val: regName, set: setRegName, type: 'text', placeholder: 'Arjun Mehta' },
                    { label: 'Email address', val: regEmail, set: setRegEmail, type: 'email', placeholder: 'you@example.com' },
                    { label: 'Password', val: regPass, set: setRegPass, type: 'password', placeholder: 'Min 8 characters' },
                    { label: 'Confirm Password', val: regConf, set: setRegConf, type: 'password', placeholder: 'Repeat password' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
                      <input value={f.val} onChange={e => f.set(e.target.value)} type={f.type} placeholder={f.placeholder} style={inputStyle(false)}
                        onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                    </div>
                  ))}
                  <button onClick={handleRegStep1} style={{ padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--grad-indigo)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', marginTop: 8 }}>
                    Continue →
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Your investing style</h3>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 10 }}>How much are you looking to invest?</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {['Under ₹1L', '₹1L – ₹10L', '₹10L – ₹50L', '₹50L+'].map(c => (
                        <button key={c} onClick={() => setCapital(c)} style={pillBtn(capital === c)}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                      Risk appetite: <span style={{ color: riskColor }}>{riskLabel}</span>
                    </label>
                    <input type="range" min="0" max="2" step="1" value={riskVal} onChange={e => setRiskVal(+e.target.value)}
                      style={{ width: '100%', accentColor: riskColor, cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
                      <span>Conservative</span><span>Balanced</span><span>Aggressive</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 10 }}>Sectors you're interested in</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SECTORS.map(s => (
                        <button key={s} onClick={() => toggleSector(s)} style={pillBtn(sectors.includes(s))}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 10 }}>Preferred startup stage</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Early (Pre-Seed/Seed)', 'Growth (Series A/B)', 'Both'].map(s => (
                        <button key={s} onClick={() => setStage(s)} style={{ ...pillBtn(stage === s), flex: 1, fontSize: 11 }}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 10 }}>How long can you lock your funds?</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      {['1yr', '1–3yr', '3–5yr', '5yr+'].map(l => (
                        <button key={l} onClick={() => setLockup(l)} style={pillBtn(lockup === l)}>{l}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>← Back</button>
                    <button onClick={handleRegStep2} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--grad-indigo)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif' }}>Continue →</button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Almost there</h3>
                  <p style={{ fontSize: 13, color: '#475569' }}>Your KYC tier determines your investment limits.</p>

                  <div>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 10 }}>I am a…</label>
                    {[
                      { val: 'accredited', label: '✅ Accredited Investor', desc: 'Net worth > ₹5Cr or annual income > ₹50L. Unlocks all deals.' },
                      { val: 'retail', label: '👤 Retail Investor', desc: 'Standard investor. Access to Tier-1 deals.' },
                    ].map(opt => (
                      <div key={opt.val} onClick={() => setAccredited(opt.val)} style={{
                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                        background: accredited === opt.val ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${accredited === opt.val ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{opt.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>📄 Upload Government ID <span style={{ color: '#334155' }}>(optional — unlocks higher limits)</span></div>
                    <div style={{ padding: '20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, textAlign: 'center', color: '#334155', fontSize: 12 }}>
                      PAN Card · Aadhaar · Passport<br />Drag & drop or <span style={{ color: '#6366f1', cursor: 'pointer' }}>browse</span>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: '#6366f1' }} />
                    <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      I agree to the <span style={{ color: '#818cf8', cursor: 'pointer' }}>Terms of Service</span> and <span style={{ color: '#818cf8', cursor: 'pointer' }}>Privacy Policy</span>. I understand this is a capstone demonstration platform.
                    </span>
                  </label>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>← Back</button>
                    <button onClick={handleRegFinal} disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', cursor: loading ? 'default' : 'pointer', background: loading ? 'rgba(99,102,241,0.3)' : 'var(--grad-indigo)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif' }}>
                      {loading ? 'Creating…' : 'Create My Account →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// React import for Fragment
import React from 'react';
