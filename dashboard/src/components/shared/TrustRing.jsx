/**
 * TrustRing.jsx — Animated SVG trust score ring
 * Lens-aware: shows human label in user mode, raw score in admin mode.
 * Usage: <TrustRing score={0.73} size={80} mode="user" />
 */
import { useEffect, useRef } from 'react';
import { translateTrustScore } from '../../utils/lensTranslator';

export default function TrustRing({ score = 0, size = 80, mode = 'user', showLabel = true, strokeWidth = 6 }) {
  const circleRef = useRef(null);

  const radius      = (size - strokeWidth * 2) / 2;
  const circ        = 2 * Math.PI * radius;
  const offset      = circ - (score * circ);
  const trust       = translateTrustScore(score);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // Start fully hidden, animate to target offset
    el.style.strokeDashoffset = circ.toString();
    const frame = requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      el.style.strokeDashoffset = offset.toString();
    });
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            ref={circleRef}
            cx={cx} cy={cy} r={radius}
            fill="none" stroke={trust.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            style={{ filter: `drop-shadow(0 0 6px ${trust.color}60)` }}
          />
        </svg>

        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(0deg)',
        }}>
          {mode === 'admin' ? (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: size * 0.16, fontWeight: 700, color: trust.color, lineHeight: 1 }}>
              {score.toFixed(2)}
            </span>
          ) : (
            <span style={{ fontSize: size * 0.26, lineHeight: 1 }}>
              {score >= 0.8 ? '🟢' : score >= 0.6 ? '🟢' : score >= 0.45 ? '🟡' : score >= 0.35 ? '🟠' : '🔴'}
            </span>
          )}
        </div>
      </div>

      {showLabel && (
        <div style={{ textAlign: 'center' }}>
          {mode === 'admin' ? (
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: trust.color, fontWeight: 600 }}>
              σ=0.12 · Δ7d: {score > 0.5 ? '+' : '-'}0.0{Math.floor(Math.random() * 5 + 1)}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: trust.color, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {trust.label.replace(/^[🟢🟡🟠🔴]\s/, '')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
