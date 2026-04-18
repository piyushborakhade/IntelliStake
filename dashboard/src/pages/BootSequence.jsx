/**
 * BootSequence.jsx — Cinematic launch screen
 * Replaces the retro terminal boot with a modern, dark-luxury intro.
 * Auto-navigates to /warroom after ~3.2s.
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const SYSTEMS = [
  { id: 'trust',    label: 'Trust Engine',       detail: '74,577 startups indexed',   icon: '🎯', color: '#6366f1' },
  { id: 'xgb',      label: 'XGBoost Model',      detail: 'R² = 0.9645  ·  online',    icon: '🧠', color: '#818cf8' },
  { id: 'bl',       label: 'B-L Optimizer',       detail: 'Sharpe 0.94  ·  calibrated',icon: '📈', color: '#06b6d4' },
  { id: 'chain',    label: 'Sepolia Chain',        detail: '3 contracts  ·  connected', icon: '⛓️', color: '#10b981' },
  { id: 'oracle',   label: 'Oracle Bridge',        detail: 'KYC + escrow  ·  active',  icon: '🔮', color: '#a78bfa' },
];

// Stagger each row to appear 340ms apart, then mark done 200ms after
const TIMINGS = SYSTEMS.map((_, i) => ({ appear: 400 + i * 340, done: 400 + i * 340 + 200 }));
const LAUNCH_AT = 400 + SYSTEMS.length * 340 + 500; // after all rows + 500ms

export default function BootSequence() {
  const navigate = useNavigate();
  const [phase, setPhase]       = useState('enter');   // enter → run → exit
  const [doneSet, setDoneSet]   = useState(new Set());
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rafRef = useRef(null);

  useEffect(() => {
    // Stagger system rows
    const timers = [];
    TIMINGS.forEach((t, i) => {
      timers.push(setTimeout(() => setActiveIdx(i), t.appear));
      timers.push(setTimeout(() => {
        setDoneSet(prev => new Set([...prev, i]));
        setProgress(Math.round(((i + 1) / SYSTEMS.length) * 100));
      }, t.done));
    });

    // Animate progress ring more smoothly
    const startTs = Date.now();
    const animateProgress = () => {
      const elapsed = Date.now() - startTs;
      const t = Math.min(elapsed / LAUNCH_AT, 1);
      const ease = 1 - Math.pow(1 - t, 2);
      setProgress(Math.round(ease * 100));
      if (t < 1) rafRef.current = requestAnimationFrame(animateProgress);
    };
    rafRef.current = requestAnimationFrame(animateProgress);

    // Launch
    timers.push(setTimeout(() => {
      setPhase('exit');
      api.warroom?.();
      setTimeout(() => {
        navigate('/warroom');
      }, 500);
    }, LAUNCH_AT));

    return () => {
      timers.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [navigate]);

  // Orbiting ring circumference
  const R = 54, C = Math.PI * 2 * R;
  const filled = (progress / 100) * C;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#04040c',
      backgroundImage: [
        'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 60%)',
        'radial-gradient(ellipse 40% 40% at 80% 80%, rgba(6,182,212,0.08) 0%, transparent 50%)',
      ].join(','),
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      overflow: 'hidden',
      opacity: phase === 'exit' ? 0 : 1,
      transition: 'opacity 0.45s ease',
    }}>

      {/* Ambient particles (pure CSS, no deps) */}
      <style>{`
        @keyframes float-up {
          0%   { transform: translateY(0px) translateX(0px); opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.3; }
          100% { transform: translateY(-120px) translateX(20px); opacity: 0; }
        }
        @keyframes spin-ring { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(99,102,241,0.5)); }
          50%       { filter: drop-shadow(0 0 32px rgba(99,102,241,0.9)); }
        }
        @keyframes row-in {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .particle {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: rgba(99,102,241,0.55);
          animation: float-up linear infinite;
        }
      `}</style>

      {/* Background particles */}
      {[...Array(14)].map((_, i) => (
        <div key={i} className="particle" style={{
          width: 3 + (i % 3), height: 3 + (i % 3),
          left: `${8 + i * 6.2}%`,
          bottom: `${5 + (i * 7) % 30}%`,
          animationDuration: `${3.5 + (i % 4) * 0.8}s`,
          animationDelay: `${(i * 0.3) % 2.4}s`,
          opacity: 0,
          background: i % 3 === 0 ? 'rgba(6,182,212,0.5)' : i % 3 === 1 ? 'rgba(99,102,241,0.5)' : 'rgba(167,139,250,0.4)',
        }} />
      ))}

      {/* ── Centre block ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/* Progress ring + logo */}
        <div style={{ position: 'relative', width: 132, height: 132, marginBottom: 36 }}>
          {/* Outer spinning accent ring */}
          <svg style={{ position: 'absolute', top: 0, left: 0, animation: 'spin-ring 8s linear infinite', opacity: 0.3 }}
            width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="62" fill="none" stroke="url(#gradRing)" strokeWidth="1"
              strokeDasharray="12 18" strokeLinecap="round" />
            <defs>
              <linearGradient id="gradRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Progress arc */}
          <svg style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
            width="132" height="132" viewBox="0 0 132 132">
            {/* Track */}
            <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            {/* Fill */}
            <circle cx="66" cy="66" r={R} fill="none"
              stroke="url(#arcGrad)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${filled} ${C}`}
              style={{ transition: 'stroke-dasharray 0.2s linear', filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.8))' }}
            />
            <defs>
              <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo in centre */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            animation: 'pulse-glow 2.5s ease-in-out infinite',
          }}>
            <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 1 }}>⬡</div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: '#c7d2fe', lineHeight: 1 }}>IS</div>
          </div>
        </div>

        {/* Brand name */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 32, fontWeight: 900, letterSpacing: '0.18em',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #818cf8 50%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 6,
          }}>
            INTELLISTAKE
          </div>
          <div style={{ fontSize: 12, color: '#334155', letterSpacing: '0.12em', fontWeight: 600 }}>
            AI INVESTMENT INTELLIGENCE PLATFORM
          </div>
        </div>

        {/* System status rows */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {SYSTEMS.map((sys, i) => {
            const visible = activeIdx >= i;
            const done    = doneSet.has(i);
            return (
              <div key={sys.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: done ? `${sys.color}0a` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${done ? sys.color + '25' : 'rgba(255,255,255,0.04)'}`,
                opacity: visible ? 1 : 0,
                animation: visible ? 'row-in 0.25s ease forwards' : 'none',
                transition: 'background 0.3s, border-color 0.3s',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{sys.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: done ? sys.color : '#475569' }}>{sys.label}</div>
                  <div style={{ fontSize: 10, color: '#1e293b', marginTop: 1 }}>{sys.detail}</div>
                </div>
                <div style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {done ? (
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="7" fill={`${sys.color}20`} stroke={sys.color} strokeWidth="1.5" />
                      <polyline points="4.5,8 7,10.5 11.5,5.5" fill="none" stroke={sys.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : visible ? (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${sys.color}40`, borderTopColor: sys.color, animation: 'spin-ring 0.7s linear infinite' }} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom progress bar + percent */}
        <div style={{ width: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace' }}>
              {progress < 100 ? 'INITIALIZING' : 'ALL SYSTEMS NOMINAL'}
            </span>
            <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 900, fontFamily: 'DM Mono, monospace' }}>{progress}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
              width: `${progress}%`, transition: 'width 0.15s linear',
              boxShadow: '0 0 8px rgba(99,102,241,0.7)',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
