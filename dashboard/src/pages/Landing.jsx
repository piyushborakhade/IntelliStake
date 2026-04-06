/**
 * Landing.jsx — IntelliStake Observatory Landing Page
 * Full redesign: The Observatory star map + 6 sections
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ObservatoryCanvas from '../components/landing/ObservatoryCanvas';

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

// ── Ticker data ───────────────────────────────────────────────────────────────
const TICKER_DATA = [
  { name: 'ZEPTO',     trust: 0.82, color: '#10b981', status: 'ACTIVE',  delta: '+0.04' },
  { name: 'RAZORPAY',  trust: 0.91, color: '#10b981', status: 'ACTIVE',  delta: '+0.02' },
  { name: "BYJU'S",    trust: 0.38, color: '#ef4444', status: 'FROZEN',  delta: '-0.06' },
  { name: 'MEESHO',    trust: 0.64, color: '#f59e0b', status: 'MONITOR', delta: '+0.01' },
  { name: 'PHONEPE',   trust: 0.85, color: '#10b981', status: 'ACTIVE',  delta: '+0.03' },
  { name: 'CRED',      trust: 0.72, color: '#10b981', status: 'ACTIVE',  delta: '0.00'  },
  { name: 'OLA',       trust: 0.51, color: '#f59e0b', status: 'MONITOR', delta: '-0.01' },
];

// ── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: "IntelliStake showed me deal flow I'd never find manually. The AI shortlisted Zepto before it hit ₹5,000Cr valuation.", name: 'Arjun Mehta', type: 'Accredited HNI · Mumbai' },
  { quote: "The escrow mechanism is what sold me. My capital sits in a smart contract — it's protected by code, not promises.", name: 'Priya Nair', type: 'Institutional Investor · Bengaluru' },
  { quote: "I set my risk profile once. The platform surfaces opportunities that actually match — nothing generic.", name: 'Vikram Sethi', type: 'Series-A LP · Delhi' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [pillarsVisible, setPillarsVisible] = useState(false);
  const [riskAppetite, setRiskAppetite] = useState('balanced');
  const [lensDemo, setLensDemo] = useState(0); /* 0 = user, 1 = admin */
  const statsRef = useRef(null);
  const pillarsRef = useRef(null);

  const statCount1 = useCountUp(74577,  2200, statsVisible);
  const statCount2 = useCountUp(240,    1800, statsVisible);   // ₹2.4Cr  
  const statCount3 = useCountUp(91,     1600, statsVisible);   // 0.91 top trust
  const statCount4 = useCountUp(3,      1200, statsVisible);   // live deals

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setStatsVisible(true); });
    }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setPillarsVisible(true); });
    }, { threshold: 0.2 });
    if (pillarsRef.current) obs.observe(pillarsRef.current);
    return () => obs.disconnect();
  }, []);

  // Cycle lens demo
  useEffect(() => {
    const t = setInterval(() => setLensDemo(v => (v + 1) % 2), 3000);
    return () => clearInterval(t);
  }, []);

  const LENS_EXAMPLES = [
    { user: '🟢 Strong Performer', admin: '0.73 · σ=0.12 · Δ7d: +0.04' },
    { user: '70% chance of doubling in 3 years', admin: 'μ=0.224 · σ=0.18 · p70=2.1x' },
    { user: 'Established — already proven at scale', admin: 'Series B · runway: 34mo' },
  ];
  const [lensEx, setLensEx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLensEx(v => (v + 1) % LENS_EXAMPLES.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', overflowX: 'hidden' }}>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--grad-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>IS</div>
          <span style={{ fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
            IntelliStake
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="https://sepolia.etherscan.io/address/0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'DM Mono, monospace' }}>
            0x1a95…f4c7 ↗
          </a>
          <button onClick={() => navigate('/login')} style={{
            background: 'var(--grad-indigo)', color: '#fff', border: 'none',
            padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
            Launch App →
          </button>
        </div>
      </nav>

      {/* ── HERO — OBSERVATORY ────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <ObservatoryCanvas riskAppetite={riskAppetite} />

        {/* Radial fade overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, transparent 30%, rgba(5,5,8,0.85) 80%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 2, textAlign: 'center', padding: '100px 24px 60px',
          opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'none' : 'translateY(24px)',
          transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 999, padding: '6px 14px', fontSize: 11, color: '#818cf8',
            marginBottom: 32, letterSpacing: '0.06em', fontWeight: 600,
            fontFamily: 'DM Mono, monospace',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-ring 2s ease-out infinite' }} />
            LIVE ON SEPOLIA TESTNET · R.A.I.S.E. FRAMEWORK v2
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(52px, 8vw, 96px)', fontWeight: 800,
            letterSpacing: '-0.03em', lineHeight: 1.0,
            marginBottom: 20,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #10b981 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
          }}>
            INTELLISTAKE
          </h1>

          <p style={{ fontSize: 22, color: '#94a3b8', fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>
            AI-Governed Venture Intelligence
          </p>
          <p style={{ fontSize: 18, color: '#475569', marginBottom: 48 }}>
            for the Next Generation of Investors
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 56, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{
              background: 'var(--grad-primary)', color: '#fff', border: 'none',
              padding: '14px 36px', borderRadius: 999, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.25s',
              boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
              fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(99,102,241,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.35)'; }}>
              Start Investing
            </button>
            <a href="#how" style={{
              background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
              border: '1px solid rgba(255,255,255,0.10)',
              padding: '14px 36px', borderRadius: 999, fontSize: 16, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              textDecoration: 'none', display: 'inline-block',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f0f4ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
              See How It Works
            </a>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', fontSize: 12, color: '#475569', flexWrap: 'wrap', fontFamily: 'DM Mono, monospace' }}>
            <span>74,577 startups analyzed</span>
            <span style={{ color: '#1e293b' }}>·</span>
            <span>₹2.4Cr deployed</span>
            <span style={{ color: '#1e293b' }}>·</span>
            <span>Live on Sepolia Testnet</span>
            <span style={{ color: '#1e293b' }}>·</span>
            <span>R² = 0.9645</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: '#334155', fontSize: 11, animation: 'float 3s ease-in-out infinite',
        }}>
          <div style={{ width: 1, height: 48, background: 'linear-gradient(to bottom, transparent, #334155)' }} />
          <span>SCROLL</span>
        </div>
      </section>

      {/* ── LIVE TICKER ───────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,15,0.9)', overflow: 'hidden', padding: '10px 0',
        position: 'relative',
      }}>
        {/* Fade edges */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to right, var(--bg-surface), transparent)', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to left, var(--bg-surface), transparent)', zIndex: 2 }} />

        <div style={{ display: 'flex', animation: 'ticker-scroll 30s linear infinite', width: 'max-content' }}>
          {[...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 32px', borderRight: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>{item.name}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: item.color }}>{item.trust.toFixed(2)}</span>
              <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: item.status === 'FROZEN' ? '#ef4444' : '#475569',
                background: item.status === 'FROZEN' ? 'rgba(239,68,68,0.1)' : 'transparent',
                padding: item.status === 'FROZEN' ? '1px 5px' : '0', borderRadius: 4,
              }}>
                {item.status === 'FROZEN' ? '🔴 FROZEN' : item.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── THREE PILLARS ─────────────────────────────────────────────────── */}
      <section id="how" ref={pillarsRef} style={{ padding: '120px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#475569', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>
            THE R.A.I.S.E. FRAMEWORK
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Every number tells a story.
          </h2>
          <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 560, margin: '0 auto' }}>
            Not a black box — every score comes with a reason, in language you actually understand.
          </p>
        </div>

        {/* THE LENS SYSTEM DEMO */}
        <div style={{
          marginBottom: 64, padding: '32px 40px', borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
          border: '1px solid rgba(99,102,241,0.15)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#818cf8', fontFamily: 'DM Mono, monospace', marginBottom: 20 }}>
            THE LENS SYSTEM — SAME DATA, TWO VIEWS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>🙋 YOU SEE (INVESTOR MODE)</div>
              <div style={{
                padding: '16px 20px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                fontSize: 18, fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.01em',
                minHeight: 56, display: 'flex', alignItems: 'center',
                transition: 'opacity 0.3s',
              }}>
                {LENS_EXAMPLES[lensEx].user}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>⚙️ ADMIN SEES (RAW DATA)</div>
              <div style={{
                padding: '16px 20px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                fontSize: 14, fontFamily: 'DM Mono, monospace', color: '#818cf8',
                minHeight: 56, display: 'flex', alignItems: 'center',
                transition: 'opacity 0.3s',
              }}>
                {LENS_EXAMPLES[lensEx].admin}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Pillar cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr 3fr', gap: 24, alignItems: 'start' }}>

          {/* Card 1: AI */}
          <div style={{
            padding: '36px 32px', borderRadius: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            transition: 'all 0.25s', cursor: 'default',
            opacity: pillarsVisible ? 1 : 0, transform: pillarsVisible ? 'none' : 'translateY(32px)',
            transitionDelay: '0ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.boxShadow = 'var(--glow-indigo)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🧠</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6366f1', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>AI THAT EXPLAINS ITSELF</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.2 }}>XGBoost + LightGBM. Not a black box.</h3>
            <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>
              Our ensemble analyzes 47 signals per startup — GitHub velocity, MCA filings, RSS sentiment, VC pedigree. Every score comes with a reason.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['R² 0.9645', '74K startups', '5-fold CV'].map(t => (
                <span key={t} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Card 2: Finance */}
          <div style={{
            padding: '28px 24px', borderRadius: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            transition: 'all 0.25s', cursor: 'default',
            opacity: pillarsVisible ? 1 : 0, transform: pillarsVisible ? 'none' : 'translateY(32px)',
            transitionDelay: '150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.boxShadow = 'var(--glow-emerald)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>📊</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#10b981', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>PORTFOLIO, BUILT FOR YOU</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.2 }}>Black-Litterman. Tuned to your risk DNA.</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>
              Not generic allocations. A portfolio that knows your tolerance for risk.
            </p>
            <div style={{ marginTop: 16, fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#10b981' }}>
              Sharpe: 0.9351 · Sortino: 1.24
            </div>
          </div>

          {/* Card 3: Blockchain */}
          <div style={{
            padding: '28px 24px', borderRadius: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            transition: 'all 0.25s', cursor: 'default',
            opacity: pillarsVisible ? 1 : 0, transform: pillarsVisible ? 'none' : 'translateY(32px)',
            transitionDelay: '300ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(139,92,246,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>⛓️</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#8b5cf6', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>ON-CHAIN, ALWAYS</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.2 }}>Your capital protected by code.</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>
              Milestone-gated escrow means funds only release when AI confirms targets are met.
            </p>
            <a href="https://sepolia.etherscan.io/address/0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 16, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#8b5cf6', textDecoration: 'none', wordBreak: 'break-all' }}>
              0x1a955…f4c7 ↗ Sepolia
            </a>
          </div>
        </div>
      </section>

      {/* ── ONBOARDING TEASER — Interactive Risk Slider ────────────────────── */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: riskAppetite === 'conservative'
            ? 'radial-gradient(ellipse at 50% 100%, rgba(6,182,212,0.06) 0%, transparent 70%)'
            : riskAppetite === 'aggressive'
            ? 'radial-gradient(ellipse at 50% 100%, rgba(245,158,11,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.07) 0%, transparent 70%)',
          transition: 'background 1.2s ease',
        }} />

        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#475569', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>PERSONALIZATION PREVIEW</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            What kind of investor are you?
          </h2>
          <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 40 }}>
            Slide to see how IntelliStake tunes your experience before you even sign up.
          </p>

          <div style={{ padding: '32px', borderRadius: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: '#475569' }}>
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Aggressive</span>
            </div>
            <input type="range" min="0" max="2" step="1" defaultValue="1"
              onChange={e => setRiskAppetite(['conservative','balanced','aggressive'][+e.target.value])}
              style={{ width: '100%', accentColor: 'var(--indigo)', cursor: 'pointer', marginBottom: 24 }}
            />

            <div style={{
              padding: '20px 24px', borderRadius: 12,
              background: riskAppetite === 'conservative' ? 'rgba(6,182,212,0.06)' : riskAppetite === 'aggressive' ? 'rgba(245,158,11,0.06)' : 'rgba(99,102,241,0.06)',
              border: `1px solid ${riskAppetite === 'conservative' ? 'rgba(6,182,212,0.2)' : riskAppetite === 'aggressive' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
              textAlign: 'left', transition: 'all 0.6s ease',
            }}>
              {riskAppetite === 'conservative' && <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>🔵 Conservative Profile</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Showing Series B+ startups · Max drawdown cap 5% · Short lockup preferred · Focus: FinTech, SaaS</div>
              </>}
              {riskAppetite === 'balanced' && <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>⚡ Balanced Profile</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Showing Series A–C startups · BL Sharpe 0.93 · 1–3 year lockup · Mix of sectors</div>
              </>}
              {riskAppetite === 'aggressive' && <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>🔥 Aggressive Profile</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Showing Pre-Seed to Series A · High upside potential · Deeptech / Climate · 5yr+ lockup horizon</div>
              </>}
            </div>

            <button onClick={() => navigate('/login')} style={{
              marginTop: 20, width: '100%', padding: '14px', borderRadius: 12,
              background: 'var(--grad-primary)', color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
            }}>
              Build My Portfolio →
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS + SOCIAL PROOF ──────────────────────────────────────────── */}
      <section ref={statsRef} style={{ padding: '100px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* 4 big stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginBottom: 80, border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
            {[
              { value: statCount1.toLocaleString(), suffix: '', label: 'Startups Analyzed', color: '#6366f1' },
              { value: '₹' + statCount2, suffix: 'Cr+', label: 'Capital Deployed', color: '#10b981' },
              { value: '0.' + statCount3, suffix: '', label: 'Highest Trust Score (Razorpay)', color: '#8b5cf6' },
              { value: statCount4, suffix: '', label: 'Live Deals on Sepolia', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '40px 32px', background: 'rgba(255,255,255,0.015)', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', color: s.color,
                  fontFamily: 'Cabinet Grotesk, DM Sans, sans-serif',
                  animation: statsVisible ? 'num-appear 0.6s ease forwards' : 'none',
                  animationDelay: `${i * 120}ms`,
                  opacity: 0,
                }}>
                  {s.value}{s.suffix}
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ padding: '32px 28px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ fontSize: 56, color: 'var(--indigo)', opacity: 0.15, lineHeight: 1, marginBottom: 16, fontFamily: 'Cabinet Grotesk, serif', fontWeight: 900 }}>"</div>
                <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20, marginTop: -20 }}>{t.quote}</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{t.type}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '60px 48px 40px', background: '#050508' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 48 }}>
            {[
              { title: 'Product', links: ['Dashboard', 'Risk Auditor', 'Portfolio Optimizer', 'Oracle Bridge', 'Escrow Simulator'] },
              { title: 'Technology', links: ['XGBoost Engine', 'Black-Litterman', 'Monte Carlo', 'FinBERT Sentiment', 'ERC-3643 Token'] },
              { title: 'Blockchain', links: ['IdentityRegistry.sol', 'IntelliStakeToken.sol', 'MilestoneEscrow.sol', 'Sepolia Testnet', 'Etherscan ↗'] },
              { title: 'Legal', links: ['Terms of Service', 'Privacy Policy', 'Risk Disclosure', 'SEBI Compliance Note', 'GitHub ↗'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#475569', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>{col.title.toUpperCase()}</div>
                {col.links.map(l => (
                  <div key={l} style={{ fontSize: 13, color: '#334155', marginBottom: 8, cursor: 'pointer', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.color = '#334155'}>
                    {l}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#334155' }}>
              Powered by XGBoost · Black-Litterman · Solidity · Supabase
            </div>
            <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#1e293b' }}>
              NMIMS School of Technology Management · MCA Capstone 2025–26
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
