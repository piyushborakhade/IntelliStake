import { useEffect, useState } from 'react';

const API = 'http://localhost:5500';

const DEMO_STARTUPS = [
  { name: 'Zepto',    desc: 'Zepto is a 10-minute instant grocery delivery app operating in Indian metro cities using dark stores.' },
  { name: 'Razorpay', desc: 'Razorpay provides payment gateway, corporate cards, payroll software, and neobanking APIs for Indian businesses.' },
  { name: "Byju's",   desc: "Byju's is an online education platform offering K-12 curriculum, competitive exam preparation, and live tutoring." },
  { name: 'Ola',      desc: 'Ola operates ride-hailing, electric scooters, and EV manufacturing targeting Indian urban mobility.' },
  { name: 'Pharmeasy',desc: 'PharmEasy is an online pharmacy and diagnostic platform delivering medicines and health tests across India.' },
  { name: 'Navi',     desc: 'Navi Technologies provides microloans, health insurance, and mutual fund investments via a mobile app.' },
];

const ACCENT_COLORS = ['#6366f1','#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f43f5e','#a3e635','#fb923c','#22d3ee','#e879f9','#fbbf24','#34d399','#60a5fa'];

function ConfidenceBar({ sector, confidence, rank, color }) {
  const pct = Math.round(confidence * 100);
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.82rem', color: rank === 0 ? color : 'var(--text-secondary)', fontWeight: rank === 0 ? 700 : 400 }}>
          {rank === 0 ? '🏆 ' : `${rank + 1}. `}{sector}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: rank === 0 ? color : 'var(--text-muted)', fontWeight: 700 }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: rank === 0 ? color : 'rgba(255,255,255,0.12)',
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

export default function ClipClassifier() {
  const [desc, setDesc] = useState('');
  const [startupName, setStartupName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sectors, setSectors] = useState(null);
  const [history, setHistory] = useState([]);

  // Load sectors on mount
  useEffect(() => {
    fetch(`${API}/api/clip/sectors`)
      .then(r => r.json())
      .then(d => setSectors(d))
      .catch(() => {});
  }, []);

  const classify = async (description, name) => {
    if (!description.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API}/api/clip/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, startup_name: name || '', top_k: 5 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setHistory(prev => [{ name: name || 'Custom', description, result: data }, ...prev.slice(0, 4)]);
    } catch (e) {
      setError(e.message || 'Classification failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const runDemo = (s) => {
    setDesc(s.desc);
    setStartupName(s.name);
    classify(s.desc, s.name);
  };

  const accentColor = result ? ACCENT_COLORS[0] : '#6366f1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="section-title">CLIP Sector Classifier</div>
          <div className="section-sub">
            Zero-shot startup sector classification using <strong>openai/clip-vit-base-patch32</strong> — a Large Vision Model (CO4, Lecture 19)
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>CO4 — LVM</span>
          <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Zero-Shot</span>
          <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>ViT-B/32</span>
        </div>
      </div>

      {/* Architecture explanation */}
      <div className="card" style={{ padding: '1rem', borderLeft: '3px solid var(--indigo)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { step: '1', title: 'Text Input', body: 'Startup description entered as free text' },
            { step: '2', title: 'CLIP Text Encoder', body: 'ViT-B/32 transformer encodes text into a 512-dim embedding' },
            { step: '3', title: 'Sector Embeddings', body: '15 sector labels pre-encoded once at startup' },
            { step: '4', title: 'Cosine Similarity', body: 'Compare startup embed vs all sector embeds' },
            { step: '5', title: 'Softmax Output', body: 'Confidence scores for each sector (sum = 100%)' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--indigo)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>

        {/* Left: input + result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Input */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="card-label" style={{ marginBottom: '0.75rem' }}>Classify a Startup</div>
            <input
              value={startupName}
              onChange={e => setStartupName(e.target.value)}
              placeholder="Startup name (optional)"
              style={{
                width: '100%', marginBottom: '0.5rem', padding: '0.55rem 0.8rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
              }}
            />
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the startup in 1–3 sentences…&#10;e.g. Zepto is a 10-minute grocery delivery app operating in Indian metro cities using dark stores."
              rows={4}
              style={{
                width: '100%', padding: '0.65rem 0.8rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.84rem',
                resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                onClick={() => classify(desc, startupName)}
                disabled={loading || !desc.trim()}
                style={{
                  flex: 1, padding: '0.65rem', background: 'var(--indigo)', border: 'none',
                  borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                  cursor: loading || !desc.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !desc.trim() ? 0.5 : 1, transition: 'opacity 0.2s',
                }}
              >
                {loading ? 'Classifying…' : '🎯 Classify with CLIP'}
              </button>
              <button onClick={() => { setDesc(''); setStartupName(''); setResult(null); setError(''); }}
                style={{ padding: '0.65rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #ef4444' }}>
              <span style={{ color: '#f87171', fontSize: '0.84rem' }}>⚠ {error}</span>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>Make sure the backend is running: <code>python engine/chatbot_api.py</code></div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div className="card-label">Classification Result</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: accentColor, marginTop: 4 }}>
                    {result.predicted_sector}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {result.startup_name && result.startup_name !== 'unknown' ? result.startup_name + ' · ' : ''}
                    {result.model}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Top confidence</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: accentColor, lineHeight: 1 }}>
                    {Math.round((result.top_sectors?.[0]?.confidence || 0) * 100)}%
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top 5 Sectors</div>
              {(result.top_sectors || []).map((s, i) => (
                <ConfidenceBar key={s.sector} sector={s.sector} confidence={s.confidence} rank={i} color={accentColor} />
              ))}

              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'var(--bg-card)', borderRadius: 6, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>How this works:</strong> CLIP's text encoder converts the startup description and each sector label into 512-dimensional embeddings. Cosine similarity measures how closely they match. Softmax converts similarity scores into confidence percentages.
                {result.from_cache && <span style={{ color: 'var(--indigo)', marginLeft: 6 }}>⚡ cached result</span>}
              </div>
            </div>
          )}
        </div>

        {/* Right: demos + sectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Demo startups */}
          <div className="card" style={{ padding: '0.85rem' }}>
            <div className="card-label" style={{ marginBottom: '0.6rem' }}>Try with Famous Startups</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {DEMO_STARTUPS.map(s => (
                <button key={s.name} onClick={() => runDemo(s)}
                  style={{
                    textAlign: 'left', padding: '0.55rem 0.7rem',
                    background: result?.startup_name === s.name ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                    border: `1px solid ${result?.startup_name === s.name ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = result?.startup_name === s.name ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)'}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{s.desc.slice(0, 60)}…</div>
                </button>
              ))}
            </div>
          </div>

          {/* All 15 sectors */}
          <div className="card" style={{ padding: '0.85rem' }}>
            <div className="card-label" style={{ marginBottom: '0.6rem' }}>15 Supported Sectors</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {(sectors?.sectors || ['FinTech','EdTech','HealthTech','AgriTech','E-Commerce','Logistics','SaaS','AI/ML','CleanTech','BioTech','Gaming','PropTech','FoodTech','CyberSecurity','DeepTech']).map((s, i) => (
                <span key={s} style={{
                  padding: '0.2rem 0.55rem', borderRadius: 4,
                  background: `${ACCENT_COLORS[i % ACCENT_COLORS.length]}18`,
                  color: ACCENT_COLORS[i % ACCENT_COLORS.length],
                  fontSize: '0.71rem', fontWeight: 600, border: `1px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}30`,
                }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Classification history */}
          {history.length > 0 && (
            <div className="card" style={{ padding: '0.85rem' }}>
              <div className="card-label" style={{ marginBottom: '0.6rem' }}>Recent Classifications</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{h.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--indigo)', fontWeight: 700 }}>
                    {h.result?.predicted_sector} · {Math.round((h.result?.top_sectors?.[0]?.confidence || 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* CO4 badge */}
          <div className="card" style={{ padding: '0.85rem', borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GenAI Course — CO4</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Unit 4, Lecture 19:</strong> Large Vision Models (LVMs) — CLIP.<br />
              CLIP (Contrastive Language-Image Pre-training) by OpenAI is a ViT-based LVM trained on 400M image-text pairs. We use its text encoder for zero-shot classification without any fine-tuning.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
