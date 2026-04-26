/**
 * RiskAssessmentPage.jsx — Investor risk profiling & portfolio risk audit
 * Route: /risk-assessment
 *
 * Sections:
 *  1. Questionnaire → compute investor risk DNA (5 dimensions)
 *  2. Portfolio risk radar (fetched from /api/holdings)
 *  3. Concentration & drawdown alerts
 *  4. AI recommendation panel
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveInvestorDNA, fetchInvestorDNA } from '../utils/supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

// ── Radar SVG ─────────────────────────────────────────────────────────────────
function RadarChart({ scores, labels, size = 240 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = labels.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, val) => {
    const a = angle(i);
    return { x: cx + Math.cos(a) * r * val, y: cy + Math.sin(a) * r * val };
  };
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {gridLevels.map((lv) => {
        const pts = labels.map((_, i) => pt(i, lv));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        return <path key={lv} d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      {/* Spokes */}
      {labels.map((_, i) => {
        const outer = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      {/* Data polygon */}
      {(() => {
        const pts = labels.map((_, i) => pt(i, scores[i] || 0));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        return (
          <>
            <path d={d} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="2" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366f1" />
            ))}
          </>
        );
      })()}
      {/* Labels */}
      {labels.map((lbl, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 22);
        const ly = cy + Math.sin(a) * (r + 22);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600, fontFamily: 'inherit' }}>
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

// ── Questions ─────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'horizon',
    dim: 'Time Horizon',
    q: 'What is your investment horizon?',
    opts: [
      { label: '< 1 year',   score: 0.1 },
      { label: '1–3 years',  score: 0.4 },
      { label: '3–5 years',  score: 0.7 },
      { label: '5+ years',   score: 1.0 },
    ],
  },
  {
    id: 'drawdown',
    dim: 'Loss Tolerance',
    q: 'If your portfolio dropped 30% in a month, you would:',
    opts: [
      { label: 'Sell everything immediately',         score: 0.1 },
      { label: 'Sell part of the portfolio',          score: 0.35 },
      { label: 'Hold and wait for recovery',          score: 0.65 },
      { label: 'Buy more — it is a buying opportunity', score: 1.0 },
    ],
  },
  {
    id: 'concentration',
    dim: 'Concentration',
    q: 'How many startups would you ideally hold?',
    opts: [
      { label: '1–3 (high conviction)',       score: 0.25 },
      { label: '4–8 (focused portfolio)',      score: 0.5 },
      { label: '8–15 (diversified)',           score: 0.75 },
      { label: '15+ (broad diversification)', score: 1.0 },
    ],
  },
  {
    id: 'sector',
    dim: 'Sector Bias',
    q: 'Your preferred sectors are:',
    opts: [
      { label: 'Only proven sectors (FinTech, SaaS)', score: 0.25 },
      { label: 'Mix of growth & established',         score: 0.5 },
      { label: 'High-growth emerging sectors',        score: 0.75 },
      { label: 'Any sector with strong AI/tech angle', score: 1.0 },
    ],
  },
  {
    id: 'liquidity',
    dim: 'Liquidity Need',
    q: 'How quickly might you need to liquidate investments?',
    opts: [
      { label: 'Within 3 months',   score: 0.1 },
      { label: 'Within 1 year',     score: 0.4 },
      { label: 'In 2–4 years',      score: 0.75 },
      { label: 'No urgency (5y+)',  score: 1.0 },
    ],
  },
];

const DIMS = QUESTIONS.map((q) => q.dim);

function profileLabel(avg) {
  if (avg >= 0.75) return { label: 'Aggressive Growth', color: '#ef4444', icon: '🚀' };
  if (avg >= 0.5)  return { label: 'Balanced',           color: '#f59e0b', icon: '⚖️' };
  if (avg >= 0.25) return { label: 'Conservative',       color: '#3b82f6', icon: '🛡️' };
  return               { label: 'Defensive',             color: '#10b981', icon: '🔒' };
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function Gauge({ value, color }) {
  const pct    = Math.max(0, Math.min(1, value));
  const r      = 44, cx = 56, cy = 56;
  const circum = Math.PI * r;
  const offset = circum * (1 - pct);
  return (
    <svg width={112} height={70} viewBox="0 0 112 70">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circum} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 18, fontWeight: 900, fill: color, fontFamily: 'DM Mono, monospace' }}>
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RiskAssessmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [answers, setAnswers]       = useState({});   // id → score
  const [submitted, setSubmitted]   = useState(false);
  const [savedDNA, setSavedDNA]     = useState(null);
  const [holdings, setHoldings]     = useState([]);
  const [loadingH, setLoadingH]     = useState(true);
  const [aiRec, setAiRec]           = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [saving, setSaving]         = useState(false);

  const email = user?.email || 'demo@intellistake.ai';

  // Load persisted DNA + holdings on mount
  useEffect(() => {
    fetchInvestorDNA(email).then((dna) => {
      if (dna) { setSavedDNA(dna); setAnswers(dna.answers || {}); setSubmitted(true); }
    });
    fetch(`${API}/api/holdings`)
      .then((r) => r.json())
      .then((d) => setHoldings(d.holdings || d || []))
      .catch(() => setHoldings([]))
      .finally(() => setLoadingH(false));
  }, [email]);

  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined);

  const scores = useMemo(
    () => QUESTIONS.map((q) => answers[q.id] ?? 0),
    [answers]
  );

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const profile  = profileLabel(avgScore);

  // Portfolio risk metrics
  const portfolioRisk = useMemo(() => {
    if (!holdings.length) return null;
    const avgTrust     = holdings.reduce((s, h) => s + Number(h.trust_score || 0.5), 0) / holdings.length;
    const maxAlloc     = Math.max(...holdings.map((h) => Number(h.allocation_pct || 0)));
    const sectors      = [...new Set(holdings.map((h) => h.sector))];
    const concentration = 1 / sectors.length;
    return { avgTrust, maxAlloc, sectorCount: sectors.length, concentration };
  }, [holdings]);

  const handleAnswer = (qId, score) => {
    setAnswers((prev) => ({ ...prev, [qId]: score }));
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSaving(true);
    const dna = { answers, scores, avgScore, profile: profile.label, updatedAt: new Date().toISOString() };
    await saveInvestorDNA(email, dna);
    setSavedDNA(dna);
    setSubmitted(true);
    setSaving(false);
    fetchAIRec();
  };

  const fetchAIRec = async () => {
    setAiLoading(true);
    try {
      const r = await fetch(`${API}/api/risk/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profile.label, avgScore, scores, portfolioRisk }),
      });
      const d = await r.json();
      setAiRec(d.recommendation || d.content || generateFallbackRec());
    } catch {
      setAiRec(generateFallbackRec());
    } finally {
      setAiLoading(false);
    }
  };

  const generateFallbackRec = () => {
    const p = profileLabel(avgScore);
    if (avgScore >= 0.75) return 'Your aggressive profile suits high-growth early-stage startups. Consider 60–70% in Seed/Series A, focus on AI-native and D2C plays. Keep 10–15% in reserve for follow-on rounds. Manage concentration risk by capping single-startup exposure at 15%.';
    if (avgScore >= 0.5)  return 'A balanced approach works well for you. Split 40% into growth sectors (FinTech, SaaS) and 40% into stable revenue-generating startups. Maintain 20% liquidity buffer. Rebalance quarterly against trust scores.';
    return 'Your conservative profile favors Series B+ companies with proven revenue. Prioritise startups with trust score ≥ 70/100, runway > 18 months, and positive gross margin. Limit exposure to pre-revenue companies to under 20%.';
  };

  // Alerts
  const alerts = useMemo(() => {
    const list = [];
    if (portfolioRisk) {
      if (portfolioRisk.maxAlloc > 30) list.push({ sev: 'high', msg: `Single startup holds ${portfolioRisk.maxAlloc.toFixed(0)}% of portfolio — concentration risk.` });
      if (portfolioRisk.sectorCount < 3) list.push({ sev: 'medium', msg: `Only ${portfolioRisk.sectorCount} sector(s) in portfolio — low diversification.` });
      if (portfolioRisk.avgTrust < 0.55) list.push({ sev: 'high', msg: 'Portfolio avg trust score below 55 — elevated default risk.' });
    }
    if (submitted && avgScore > 0.7 && portfolioRisk?.avgTrust < 0.6)
      list.push({ sev: 'medium', msg: 'Aggressive profile but low-trust holdings — misalignment detected.' });
    return list;
  }, [portfolioRisk, submitted, avgScore]);

  const sevColor = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛡️</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Risk Assessment</h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Profile your risk appetite · Audit your portfolio · Get AI recommendations</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Questionnaire ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {QUESTIONS.map((q, qi) => (
            <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>{q.dim}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.4 }}>
                Q{qi + 1}. {q.q}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.opts.map((opt) => {
                  const chosen = answers[q.id] === opt.score;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleAnswer(q.id, opt.score)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        border: `1px solid ${chosen ? '#6366f1' : 'rgba(255,255,255,0.06)'}`,
                        background: chosen ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                        color: chosen ? '#818cf8' : '#94a3b8', fontSize: 13, fontWeight: chosen ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {chosen ? '● ' : '○ '}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || saving}
            style={{
              padding: '14px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800, cursor: allAnswered ? 'pointer' : 'default',
              background: allAnswered ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.05)',
              color: allAnswered ? '#fff' : '#475569', transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving…' : submitted ? '✓ Profile Saved — Recalculate' : 'Calculate My Risk Profile'}
          </button>

          {/* AI Recommendation */}
          {submitted && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>AI RECOMMENDATION</div>
              {aiLoading ? (
                <div style={{ height: 60, background: 'rgba(255,255,255,0.04)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ) : (
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{aiRec || generateFallbackRec()}</p>
              )}
              {!aiLoading && !aiRec && (
                <button onClick={fetchAIRec} style={{ marginTop: 10, fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Refresh recommendation →
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>

          {/* Profile card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>YOUR RISK PROFILE</div>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <Gauge value={avgScore} color={profile.color} />
              <div style={{ fontSize: 18, fontWeight: 900, color: profile.color, marginTop: 4 }}>{profile.icon} {profile.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Score: {(avgScore * 100).toFixed(0)}/100</div>
            </div>
            <RadarChart scores={scores} labels={DIMS} size={220} />
          </div>

          {/* Portfolio risk */}
          {!loadingH && portfolioRisk && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>PORTFOLIO RISK METRICS</div>
              {[
                { label: 'Avg Trust Score',    value: `${(portfolioRisk.avgTrust * 100).toFixed(0)}/100`, color: portfolioRisk.avgTrust >= 0.65 ? '#10b981' : '#f59e0b' },
                { label: 'Peak Concentration', value: `${portfolioRisk.maxAlloc.toFixed(0)}%`,           color: portfolioRisk.maxAlloc > 30 ? '#ef4444' : '#10b981' },
                { label: 'Sectors Held',       value: portfolioRisk.sectorCount,                         color: 'var(--text-primary)' },
                { label: 'Holdings',           value: holdings.length,                                   color: 'var(--text-primary)' },
              ].map((m) => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: m.color, fontFamily: 'DM Mono, monospace' }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px' }}>
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>RISK ALERTS</div>
              {alerts.map((a, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 8, background: `${sevColor[a.sev]}10`, border: `1px solid ${sevColor[a.sev]}30`, display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{a.sev === 'high' ? '🔴' : '🟡'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{a.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Discover CTA */}
          {submitted && (
            <button
              onClick={() => navigate('/u/discover')}
              style={{ padding: '13px', borderRadius: 12, border: 'none', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Discover startups matching my profile →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
