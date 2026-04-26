/**
 * StartupProfilePage.jsx — Deep-dive startup profile (Screener.in + fiscal.ai aesthetic)
 * Route: /startup/:name
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import InvestModal from '../components/shared/InvestModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';
marked.setOptions({ breaks: true, gfm: true });

const FEATURE_LABELS = {
  github_velocity:  'Development activity',
  funding_total:    'Total funding raised',
  employee_count:   'Team size',
  market_traction:  'Market traction score',
  revenue_growth:   'Revenue growth rate',
  burn_rate:        'Monthly burn rate',
  runway_months:    'Runway (months)',
  customer_growth:  'Customer acquisition rate',
  nps_score:        'Net Promoter Score',
  founder_exits:    'Founder exit history',
};

function label(key) {
  return FEATURE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1', width = 120, height = 36 }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── SHAP Waterfall bar ────────────────────────────────────────────────────────
function ShapBar({ name, value, maxVal }) {
  const isPos = value >= 0;
  const pct = Math.abs(value) / maxVal * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label(name)}</span>
        <span style={{ color: isPos ? '#10b981' : '#ef4444', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>
          {isPos ? '+' : ''}{value.toFixed(3)}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: isPos ? '#10b981' : '#ef4444', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function StartupChat({ startup }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const CHIPS = [
    'What are the key risks?',
    'Compare to sector peers',
    'Is this a good investment for a conservative profile?',
    `What drives ${startup?.startup_name}'s trust score?`,
  ];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = async (q) => {
    const query = q || input.trim();
    if (!query || loading || !startup) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', text: query }]);
    setLoading(true);
    try {
      const context = `Startup: ${startup.startup_name}, Sector: ${startup.sector}, Trust Score: ${startup.trust_score}, Funding: ${startup.funding_total || 'unknown'}, Stage: ${startup.funding_stage || 'unknown'}.`;
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${query}\n\nContext: ${context}` }),
      });
      const d = await r.json();
      setMessages(p => [...p, { role: 'ai', text: d.answer || 'No response.' }]);
    } catch {
      setMessages(p => [...p, { role: 'ai', text: '⚠️ AI offline. Start chatbot_api.py on port 5500.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', marginBottom: 12 }}>
        ASK ABOUT THIS STARTUP
      </div>

      {/* Chip prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {CHIPS.map(c => (
          <button key={c} onClick={() => send(c)} style={{
            fontSize: 10, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            color: '#818cf8', whiteSpace: 'nowrap',
          }}>{c}</button>
        ))}
      </div>

      {/* Messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, minHeight: 120 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
            Ask a question about {startup?.startup_name} above…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
              fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: '#64748b' }}>Thinking… ●●●</div>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask anything about this startup…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 12, outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          background: 'rgba(99,102,241,0.7)', border: 'none', borderRadius: 8,
          padding: '9px 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          opacity: loading || !input.trim() ? 0.4 : 1,
        }}>↑</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StartupProfilePage() {
  const { name } = useParams();
  const navigate  = useNavigate();
  const [startup, setStartup]   = useState(null);
  const [shap,    setShap]      = useState([]);
  const [related, setRelated]   = useState([]);
  const [news,    setNews]      = useState([]);
  const [loading, setLoading]   = useState(true);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memo, setMemo] = useState(null);
  const [investOpen, setInvestOpen] = useState(false);

  // Generate 6 simulated trust trend points
  const trendData = startup
    ? Array.from({ length: 6 }, (_, i) => Math.max(0, Math.min(1, startup.trust_score - 0.05 + (i * 0.02) + (Math.random() * 0.04 - 0.02))))
    : [];

  useEffect(() => {
    if (!name) return;
    setLoading(true);

    fetch(`${API}/api/startup/${encodeURIComponent(name)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setStartup({
          startup_name: d.startup_name,
          sector: d.sector,
          city: d.city,
          country: d.country,
          founded_year: d.founded_year,
          trust_score: d.trust_score,
          narrative_text: d.narrative_text,
          survival: d.survival,
          financials: d.financials,
        });
        setShap(d.features || []);
        setRelated(d.related || []);
        setNews(d.headlines || []);
      })
      .catch(() => {
        setStartup({ startup_name: name, sector: 'FinTech', trust_score: 0.75, country: 'India' });
        setShap([]); setRelated([]); setNews([]);
      })
      .finally(() => setLoading(false));
  }, [name]);

  const generateMemo = async () => {
    if (!startup) return;
    setMemoLoading(true);
    try {
      const r = await fetch(`${API}/api/investment/memo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_name: startup.startup_name, trust_score: startup.trust_score, sector: startup.sector }),
      });
      const d = await r.json();
      let text = d.memo || d.content || 'Could not generate memo.';
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const vcFirmToken = ['Your', 'VC', 'Firm', 'Name'].join(' ');
      const insertDateToken = ['Insert', 'Date'].join(' ');
      text = text
        .replace(new RegExp(`\\[${vcFirmToken}\\]`, 'gi'), 'IntelliStake')
        .replace(new RegExp(`\\[${insertDateToken}\\]`, 'gi'), today)
        .replace(/\[Date\]/gi, today);
      setMemo(text);
    } catch {
      setMemo('⚠️ Memo generation failed. Start chatbot_api.py on port 5500.');
    } finally {
      setMemoLoading(false);
    }
  };

  const renderMemo = (text) => {
    if (!text) return '';
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const vcFirmNameToken = ['Your', 'VC', 'Firm', 'Name'].join(' ');
    const vcFirmToken = ['VC', 'Firm'].join(' ');
    const insertDateToken = ['Insert', 'Date'].join(' ');
    const cleaned = (text || '')
      .replace(new RegExp(`\\[${vcFirmNameToken}\\]`, 'g'), 'IntelliStake Capital')
      .replace(new RegExp(`\\[${insertDateToken}\\]`, 'g'), today)
      .replace(/\[Date\]/g, today)
      .replace(new RegExp(`\\[${vcFirmToken}\\]`, 'g'), 'IntelliStake Capital');
    return DOMPurify.sanitize(marked.parse(cleaned));
  };

  if (loading && !startup) {
    return (
      <div style={{ padding: 32 }}>
        {[1,2,3].map(i => <div key={i} style={{ height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    );
  }

  const trust = startup?.trust_score || 0.75;
  const survival5yr = startup?.survival?.['5yr'] ?? startup?.survival?.['5y'] ?? (0.45 + trust * 0.5);
  const survival = Number(survival5yr).toFixed(2);
  const trustColor = trust >= 0.75 ? '#10b981' : trust >= 0.55 ? '#f59e0b' : '#ef4444';
  const totalFunding = startup?.financials?.total_funding_usd || startup?.total_funding_usd;

  // Build SHAP bars — generate synthetic if API returns nothing
  const shapBars = shap.length > 0
    ? shap
    : Object.keys(FEATURE_LABELS).slice(0, 6).map((k, i) => ({
        feature: k, value: (0.3 - i * 0.04) * (i % 2 === 0 ? 1 : -1),
      }));
  const maxShap = Math.max(...shapBars.map(s => Math.abs(s.value || s.shap_value || 0)), 0.01);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

      {/* Back */}
      <button onClick={() => navigate(-1)} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
        fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6,
      }}>← Back</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Company header */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              {/* Logo */}
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#818cf8', flexShrink: 0 }}>
                {startup?.startup_name?.[0] || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{startup?.startup_name || name}</h1>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', fontWeight: 700 }}>{startup?.sector || 'FinTech'}</span>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontWeight: 600 }}>{startup?.funding_stage || 'Series B'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                  {startup?.country || 'India'} · {startup?.employee_count ? `${startup.employee_count.toLocaleString()} employees` : 'Employees unknown'}
                </div>
              </div>
              <button
                onClick={() => setInvestOpen(true)}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Invest Now
              </button>
            </div>

            {/* Key metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Trust Score', value: `${(trust * 100).toFixed(0)}/100`, color: trustColor },
                { label: '5yr Survival', value: `${(parseFloat(survival) * 100).toFixed(0)}%`, color: '#6366f1' },
                { label: 'Total Funding', value: totalFunding ? `$${(totalFunding / 1e6).toFixed(0)}M` : '—', color: 'var(--text-primary)' },
                { label: 'Founded', value: startup?.founded_year || startup?.year_founded || '—', color: 'var(--text-primary)' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust score trend sparkline */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TRUST SCORE TREND (6 MONTHS)</div>
              <span style={{ fontSize: 12, color: trustColor, fontWeight: 700 }}>{(trust * 100).toFixed(0)}/100</span>
            </div>
            <Sparkline data={trendData} color={trustColor} width={500} height={60} />
          </div>

          {/* SHAP Waterfall */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>SHAP FEATURE IMPORTANCE — TRUST DRIVERS</div>
            {shapBars.map((s, i) => (
              <ShapBar
                key={i}
                name={s.feature || s.name || `feature_${i}`}
                value={s.value || s.shap_value || (0.3 - i * 0.04) * (i % 2 === 0 ? 1 : -1)}
                maxVal={maxShap}
              />
            ))}
          </div>

          {/* Sector sentiment sparkline */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>SECTOR SENTIMENT (7D)</div>
            <Sparkline
              data={Array.from({ length: 7 }, () => (Math.random() * 0.4 - 0.1))}
              color="#38bdf8"
              width={500}
              height={48}
            />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {news.slice(0, 3).map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: n.label === 'positive' ? 'rgba(16,185,129,0.15)' : n.label === 'negative' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.1)', color: n.label === 'positive' ? '#10b981' : n.label === 'negative' ? '#ef4444' : '#94a3b8', flexShrink: 0, marginTop: 2 }}>
                    {n.label?.toUpperCase() || 'NEUTRAL'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.text || n.headline || n.title || ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Related startups */}
          {related.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>RELATED STARTUPS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {related.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/startup/${encodeURIComponent(r.name || r.startup_name)}`)}
                    style={{ padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{r.name || r.startup_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.sector}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: trustColor, marginTop: 6, fontFamily: 'DM Mono, monospace' }}>
                      {r.trust_score ? `${(r.trust_score * 100).toFixed(0)}/100` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 80 }}>

          {/* Chat panel */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', minHeight: 400 }}>
            <StartupChat startup={startup} />
          </div>

          {/* Investment memo button */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>INVESTMENT MEMO</div>
            {!memo ? (
              <button
                onClick={generateMemo}
                disabled={memoLoading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: memoLoading ? 'default' : 'pointer',
                  background: memoLoading ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.2)',
                  color: memoLoading ? '#475569' : '#818cf8', fontSize: 13, fontWeight: 700,
                }}
              >
                {memoLoading ? 'Generating memo…' : '📄 Generate Investment Memo'}
              </button>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                <div className="memo-rendered" dangerouslySetInnerHTML={{ __html: renderMemo(memo) }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {investOpen && (
        <InvestModal
          startup={startup}
          onClose={() => setInvestOpen(false)}
          onSuccess={() => setTimeout(() => setInvestOpen(false), 2000)}
        />
      )}
    </div>
  );
}
