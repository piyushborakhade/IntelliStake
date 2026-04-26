import { useCallback, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:5500';

// ── Colour tokens per metric ──────────────────────────────────────────────────
const METRIC_INFO = {
  bleu:      { label:'BLEU',     desc:'Bilingual Evaluation Understudy — n-gram precision between generated and reference text', color:'#6366f1', bg:'rgba(99,102,241,0.12)',  range:'0 → 1  (higher = better)', co:'CO5' },
  rouge1:    { label:'ROUGE-1',  desc:'Recall-Oriented Understudy for Gisting Evaluation — unigram overlap F1',                 color:'#10b981', bg:'rgba(16,185,129,0.12)',  range:'0 → 1  (higher = better)', co:'CO5' },
  rouge2:    { label:'ROUGE-2',  desc:'Bigram overlap F1 between hypothesis and reference',                                      color:'#3b82f6', bg:'rgba(59,130,246,0.12)',  range:'0 → 1  (higher = better)', co:'CO5' },
  rougeL:    { label:'ROUGE-L',  desc:'Longest Common Subsequence (LCS) based F1',                                              color:'#f59e0b', bg:'rgba(245,158,11,0.12)',  range:'0 → 1  (higher = better)', co:'CO5' },
  perplexity:{ label:'Perplexity',desc:'GPT-2 token log-probability measure of language fluency (lower = better)',              color:'#e879f9', bg:'rgba(232,121,249,0.12)', range:'1 → ∞  (lower = better)',  co:'CO5' },
};

// ── 3-part GenAI breakdown ────────────────────────────────────────────────────
const GENAI_PARTS = [
  {
    id:'G1', label:'Part 1 — NLP & Sentiment Intelligence', color:'#6366f1',
    icon:'🧠',
    modules:[
      { name:'FinBERT Sentiment',        detail:'Financial domain BERT — weighted 30 % in ensemble',            status:'Live' },
      { name:'FinBERT-Tone',             detail:'Tone-aware variant — 25 % weight',                             status:'Live' },
      { name:'Twitter-RoBERTa',          detail:'Social-media tuned — 20 % weight',                             status:'Live' },
      { name:'DeBERTa Finance',          detail:'Fine-tuned finance classifier — 15 % weight',                  status:'Live' },
      { name:'VADER (Rule-based)',        detail:'Lexicon scoring — 10 % weight, zero-cost fallback',            status:'Live' },
    ],
    apiEndpoint:'/api/sentiment/ensemble',
    desc:'Five-model weighted sentiment ensemble (FinBERT × 2 + RoBERTa + DeBERTa + VADER). Aggregates news headlines into a compound score [-1, +1] used to adjust trust scores and portfolio weights.',
  },
  {
    id:'G2', label:'Part 2 — RAG Chatbot & Knowledge Retrieval', color:'#10b981',
    icon:'🤖',
    modules:[
      { name:'Vector Store (ChromaDB)',   detail:'Embeds 74 k startup docs for semantic search',                 status:'Live' },
      { name:'all-MiniLM-L6-v2',         detail:'Sentence-transformer for query + doc embeddings',              status:'Live' },
      { name:'Ollama / Mistral-Small',   detail:'LLM for grounded answer generation via Mistral API',           status:'Live' },
      { name:'Intent Classifier',        detail:'30-class intent router before LLM call',                       status:'Live' },
      { name:'Context Injector',         detail:'Top-5 cosine-similar chunks injected as context',              status:'Live' },
    ],
    apiEndpoint:'/api/chat',
    desc:'Retrieval-Augmented Generation pipeline. User queries are embedded and matched against a ChromaDB index of 74 k startup records. The top-5 chunks are injected as context into Mistral-Small to produce a grounded, citation-backed answer.',
  },
  {
    id:'G3', label:'Part 3 — GenAI Evaluation (CO5)', color:'#e879f9',
    icon:'📊',
    modules:[
      { name:'BLEU (Papineni 2002)',      detail:'N-gram precision — from-scratch Python implementation',        status:'Live' },
      { name:'ROUGE-1/2/L (Lin 2004)',    detail:'Recall-based F1 — custom LCS + n-gram algorithm',             status:'Live' },
      { name:'GPT-2 Perplexity',         detail:'Token log-probability fluency via HuggingFace transformers',   status:'Live' },
      { name:'Proxy Perplexity',         detail:'Lexical-diversity fallback when GPU not available',            status:'Live' },
      { name:'10 Q&A Reference Cases',   detail:'Curated IntelliStake-specific test suite mapped to COs',       status:'Live' },
    ],
    apiEndpoint:'/api/eval/metrics',
    desc:'CO5 evaluation framework. Runs 10 curated Q&A pairs through the live RAG chatbot, computes BLEU, ROUGE-1/2/L, and GPT-2 Perplexity from scratch (no evaluation libraries), and compares against gold-standard reference answers.',
  },
];

// ── 3-part project overview ───────────────────────────────────────────────────
const PROJECT_PARTS = [
  {
    id:'P1', label:'Part 1 — AI & Analytics Engine', color:'#6366f1', icon:'⚙️',
    components:[
      'Valuation Ensemble (XGB + LGBM + CatBoost + TabNet → BayesianRidge)',
      'Trust Score ML (Calibrated XGBoost, R.A.I.S.E. features)',
      'Sentiment Ensemble (5-model weighted NLP)',
      'Anomaly Detection (Isolation Forest + LOF + DBSCAN + Autoencoder)',
      'CLIP Zero-Shot Sector Classifier (CO4)',
      'Monte Carlo Simulation (Black-Litterman + HRP portfolio optimisation)',
      'SHAP Explainability for valuation features',
    ],
  },
  {
    id:'P2', label:'Part 2 — Blockchain & Finance Layer', color:'#f59e0b', icon:'🔗',
    components:[
      'IntelliStakeInvestment.sol — ERC-20 token (ISTK) on Sepolia testnet',
      'MilestoneEscrow.sol — 4-tranche oracle-gated fund release',
      'IdentityRegistry.sol — KYC & compliance on-chain registry',
      'Oracle Bridge — Off-chain AI ↔ on-chain smart contract sync',
      'Portfolio Engine — Black-Litterman + Sharpe maximisation',
      'Backtest Framework — Walk-forward strategy validation',
      'Finance Dashboard — AUM, Sharpe, Sortino, Max-Drawdown live KPIs',
    ],
  },
  {
    id:'P3', label:'Part 3 — GenAI, RAG & Evaluation (CO5)', color:'#e879f9', icon:'🤖',
    components:[
      'RAG Chatbot — ChromaDB + MiniLM + Mistral-Small grounded Q&A',
      '5-Model Sentiment Ensemble (FinBERT × 2, RoBERTa, DeBERTa, VADER)',
      'BLEU evaluation — from-scratch Python n-gram precision',
      'ROUGE-1/2/L — custom F1 + LCS implementation',
      'GPT-2 Perplexity — HuggingFace token log-probability',
      '10-case CO-mapped test suite with live chatbot scoring',
      'Live Perplexity Tester — any text, real-time GPT-2 scoring',
    ],
  },
];

// ── Helper components ─────────────────────────────────────────────────────────
function ScoreBar({ value, max = 1, color, invert = false }) {
  const pct = invert
    ? Math.max(0, Math.min(100, 100 - (value / max) * 100))
    : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden', width:'100%' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width 0.6s ease' }} />
    </div>
  );
}

function MetricCard({ metricKey, avg }) {
  const info = METRIC_INFO[metricKey];
  const isPerplexity = metricKey === 'perplexity';
  const displayVal = avg != null ? (isPerplexity ? avg.toFixed(1) : avg.toFixed(4)) : '—';
  const pctGood = avg != null
    ? (isPerplexity ? Math.max(0, 100 - ((avg - 1) / 300) * 100).toFixed(0) : (avg * 100).toFixed(1))
    : '—';

  return (
    <div style={{ background:info.bg, border:`1px solid ${info.color}33`, borderRadius:10, padding:'1rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:'0.7rem', color:info.color, fontWeight:700, letterSpacing:'0.08em' }}>{info.co} · {info.label}</div>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'#fff', fontFamily:'monospace', lineHeight:1.1, marginTop:2 }}>{displayVal}</div>
        </div>
        <div style={{ width:42, height:42, borderRadius:'50%', border:`2px solid ${info.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:info.color }}>
          {pctGood}{avg != null ? '%' : ''}
        </div>
      </div>
      {avg != null && <ScoreBar value={isPerplexity ? Math.min(avg, 300) : avg} max={isPerplexity ? 300 : 1} color={info.color} invert={isPerplexity} />}
      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', lineHeight:1.4 }}>{info.desc}</div>
      <div style={{ fontSize:'0.65rem', color:info.color, opacity:0.7 }}>Range: {info.range}</div>
    </div>
  );
}

function CaseRow({ c, i }) {
  const [expanded, setExpanded] = useState(false);
  const bleu = c.bleu?.toFixed(4)  ?? '—';
  const r1   = c.rouge?.['rouge-1']?.f?.toFixed(4) ?? '—';
  const r2   = c.rouge?.['rouge-2']?.f?.toFixed(4) ?? '—';
  const rL   = c.rouge?.['rouge-l']?.f?.toFixed(4) ?? '—';
  const ppl  = c.perplexity?.toFixed(1) ?? '—';

  const scoreColor = (v, invert = false) => {
    if (v == null || v === '—') return '#64748b';
    const n = parseFloat(v);
    if (isNaN(n)) return '#64748b';
    const good = invert ? n < 100 : n > 0.5;
    const ok   = invert ? n < 200 : n > 0.25;
    return good ? '#10b981' : ok ? '#f59e0b' : '#f87171';
  };

  return (
    <>
      <tr onClick={() => setExpanded(!expanded)} style={{ cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding:'0.6rem 0.75rem', fontSize:'0.75rem', color:'#64748b', fontFamily:'monospace' }}>Q{String(i+1).padStart(2,'0')}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontSize:'0.75rem', color:'#94a3b8' }}>{c.co_mapped}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontSize:'0.78rem', color:'var(--text-secondary)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.question}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.76rem', color:scoreColor(c.bleu), textAlign:'center' }}>{bleu}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.76rem', color:scoreColor(parseFloat(r1)), textAlign:'center' }}>{r1}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.76rem', color:scoreColor(parseFloat(r2)), textAlign:'center' }}>{r2}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.76rem', color:scoreColor(parseFloat(rL)), textAlign:'center' }}>{rL}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontFamily:'monospace', fontSize:'0.76rem', color:scoreColor(c.perplexity, true), textAlign:'center' }}>{ppl}</td>
        <td style={{ padding:'0.6rem 0.75rem', fontSize:'0.7rem', color:'#475569', textAlign:'center' }}>{expanded ? '▲' : '▼'}</td>
      </tr>
      {expanded && (
        <tr style={{ background:'rgba(255,255,255,0.02)' }}>
          <td colSpan={9} style={{ padding:'0.75rem 1rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', fontSize:'0.78rem' }}>
              <div>
                <div style={{ color:'#6366f1', fontWeight:600, marginBottom:4 }}>📌 Reference Answer</div>
                <div style={{ color:'var(--text-secondary)', lineHeight:1.55, background:'rgba(99,102,241,0.06)', padding:'0.5rem 0.75rem', borderRadius:6, borderLeft:'2px solid #6366f1' }}>{c.reference}</div>
              </div>
              <div>
                <div style={{ color:'#10b981', fontWeight:600, marginBottom:4 }}>🤖 Chatbot / Generated Answer</div>
                <div style={{ color:'var(--text-secondary)', lineHeight:1.55, background:'rgba(16,185,129,0.06)', padding:'0.5rem 0.75rem', borderRadius:6, borderLeft:'2px solid #10b981' }}>{c.hypothesis}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GenAIEval() {
  const [tab, setTab]                   = useState('eval');       // 'eval' | 'genai' | 'project'
  const [report, setReport]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [computing, setComputing]       = useState(false);
  const [error, setError]               = useState(null);
  const [perplexityText, setPerplexityText] = useState('');
  const [pplResult, setPplResult]       = useState(null);
  const [pplLoading, setPplLoading]     = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // ── Poll metrics ────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setComputing(false);
    try {
      const res  = await fetch(`${API_BASE}/api/eval/metrics`);
      const data = await res.json();
      if (res.status === 202 || data.status === 'computing') {
        setComputing(true);
        setLoading(false);
        setTimeout(fetchReport, 8000);   // poll every 8 s
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Force-refresh (bust cache + re-run live) ────────────────────────────────
  const forceRefresh = async () => {
    setReport(null);
    setError(null);
    setComputing(true);
    try {
      await fetch(`${API_BASE}/api/eval/refresh`, { method: 'POST' });
    } catch { /* ignore — will still poll */ }
    setTimeout(fetchReport, 3000);
  };

  useEffect(() => { fetchReport(); }, []);

  // ── Live perplexity tester ──────────────────────────────────────────────────
  const testPerplexity = async () => {
    if (!perplexityText.trim()) return;
    setPplLoading(true);
    setPplResult(null);
    try {
      const res  = await fetch(`${API_BASE}/api/eval/perplexity`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text: perplexityText }),
      });
      const data = await res.json();
      setPplResult(data);
    } catch {
      setPplResult({ error:'Could not reach API' });
    } finally { setPplLoading(false); }
  };

  const avgs = report?.averages || {};
  const mode = report?.mode || 'unknown';

  const tabStyle = (t) => ({
    padding:'0.4rem 1rem', borderRadius:6, fontSize:'0.78rem', fontWeight:600,
    cursor:'pointer', border:'none',
    background: tab === t ? 'rgba(99,102,241,0.25)' : 'transparent',
    color: tab === t ? '#a5b4fc' : '#64748b',
    transition:'all 0.2s',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="section-header" style={{ marginBottom:0 }}>
        <div>
          <div className="section-title">GenAI Evaluator</div>
          <div className="section-sub">BLEU · ROUGE-1/2/L · GPT-2 Perplexity · 10 live Q&amp;A pairs — CO5</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
          {report && (
            <span style={{ fontSize:'0.72rem', color:'#10b981', border:'1px solid #10b98144', borderRadius:4, padding:'0.2rem 0.6rem' }}>
              ✓ {report.cases?.length || 0} test cases
            </span>
          )}
          {mode !== 'unknown' && (
            <span style={{ fontSize:'0.7rem', color: mode === 'live_chatbot' ? '#10b981' : '#f59e0b', border:`1px solid ${mode === 'live_chatbot' ? '#10b98144' : '#f59e0b44'}`, borderRadius:4, padding:'0.2rem 0.6rem' }}>
              {mode === 'live_chatbot' ? '🤖 Live Chatbot' : '📐 Self-Reference'}
            </span>
          )}
          {lastRefreshed && <span style={{ fontSize:'0.68rem', color:'#475569' }}>Updated {lastRefreshed}</span>}
          <span className="badge" style={{ background:'rgba(232,121,249,0.15)', color:'#e879f9' }}>CO5</span>
          <span className="badge badge-ai">GPT-2</span>
          <button
            onClick={forceRefresh} disabled={loading || computing}
            title="Clear cache and re-run evaluation against live chatbot"
            style={{ background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:6, padding:'0.3rem 0.8rem', color:'#fca5a5', fontSize:'0.78rem', cursor:(loading||computing)?'not-allowed':'pointer', opacity:(loading||computing)?0.5:1 }}>
            🔄 Re-run Live
          </button>
          <button
            onClick={fetchReport} disabled={loading}
            style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:6, padding:'0.3rem 0.8rem', color:'#a5b4fc', fontSize:'0.78rem', cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1 }}>
            {loading ? '⏳ Loading…' : '▶ Run Evaluation'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:'0.25rem', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:4, width:'fit-content' }}>
        <button style={tabStyle('eval')}    onClick={() => setTab('eval')}>📊 Evaluation Results</button>
        <button style={tabStyle('genai')}   onClick={() => setTab('genai')}>🧠 GenAI — 3 Parts</button>
        <button style={tabStyle('project')} onClick={() => setTab('project')}>🏗 Project — 3 Parts</button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, padding:'1rem', color:'#fca5a5', fontSize:'0.84rem' }}>
          <strong>API Error:</strong> {error}
          <div style={{ marginTop:6, fontFamily:'monospace', fontSize:'0.73rem', color:'#94a3b8' }}>
            Make sure chatbot_api.py is running on :5500
          </div>
        </div>
      )}

      {/* ── Computing banner ────────────────────────────────────────────────── */}
      {computing && !report && (
        <div style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, padding:'0.85rem 1rem', color:'#a5b4fc', fontSize:'0.8rem' }}>
          ⏳ Evaluation is running against the live RAG chatbot — calling /api/chat for each of the 10 Q&A pairs. Results auto-refresh every 8 s.
        </div>
      )}

      {/* ══════════════ TAB: EVALUATION RESULTS ══════════════════════════════ */}
      {tab === 'eval' && (
        <>
          {/* Metric cards */}
          {report ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.75rem' }}>
              <MetricCard metricKey="bleu"       avg={avgs.bleu} />
              <MetricCard metricKey="rouge1"     avg={avgs.rouge1_f} />
              <MetricCard metricKey="rouge2"     avg={avgs.rouge2_f} />
              <MetricCard metricKey="rougeL"     avg={avgs.rougeL_f} />
              <MetricCard metricKey="perplexity" avg={avgs.perplexity} />
            </div>
          ) : loading && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.75rem' }}>
              {[...Array(5)].map((_,i) => (
                <div key={i} style={{ height:140, background:'rgba(255,255,255,0.03)', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', animation:'pulse 1.4s infinite' }} />
              ))}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1rem' }}>

            {/* Case-by-case table */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)' }}>Test Case Breakdown</div>
                <div style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>Click a row to expand Q&amp;A</div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                      {['#','CO','Question','BLEU','R-1','R-2','R-L','PPL',''].map(h => (
                        <th key={h} style={{ padding:'0.5rem 0.75rem', fontSize:'0.68rem', color:'#64748b', fontWeight:600, textAlign: h==='#'||h===''?'left':'center', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report?.cases?.map((c,i) => <CaseRow key={i} c={c} i={i} />) || (
                      <tr><td colSpan={9} style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.82rem' }}>
                        {loading || computing ? '⏳ Computing evaluation…' : 'Click "Re-run Live" to start evaluation'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>

              {/* Live perplexity tester */}
              <div className="card" style={{ padding:'1rem' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#e879f9', marginBottom:'0.6rem' }}>⚡ Live Perplexity Test</div>
                <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:'0.6rem', lineHeight:1.5 }}>Enter any text to measure GPT-2 perplexity in real-time</div>
                <textarea
                  value={perplexityText}
                  onChange={e => setPerplexityText(e.target.value)}
                  placeholder="Enter text to evaluate…"
                  rows={4}
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'0.6rem 0.75rem', color:'var(--text-primary)', fontSize:'0.8rem', resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.5 }}
                />
                <button onClick={testPerplexity} disabled={pplLoading || !perplexityText.trim()}
                  style={{ marginTop:'0.5rem', width:'100%', background:'rgba(232,121,249,0.15)', border:'1px solid rgba(232,121,249,0.3)', borderRadius:6, padding:'0.5rem', color:'#e879f9', fontSize:'0.78rem', cursor:pplLoading?'not-allowed':'pointer', opacity:pplLoading?0.6:1 }}>
                  {pplLoading ? '⏳ Computing…' : 'Compute Perplexity'}
                </button>
                {pplResult && !pplResult.error && (
                  <div style={{ marginTop:'0.75rem', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0.6rem', background:'rgba(232,121,249,0.08)', borderRadius:6 }}>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Perplexity</span>
                      <span style={{ fontFamily:'monospace', fontSize:'0.85rem', fontWeight:700, color:'#e879f9' }}>{pplResult.perplexity?.toFixed(2)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0.6rem', background:'rgba(255,255,255,0.03)', borderRadius:6 }}>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Avg NLL</span>
                      <span style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'#94a3b8' }}>{pplResult.avg_nll?.toFixed(4)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0.6rem', background:'rgba(255,255,255,0.03)', borderRadius:6 }}>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Tokens</span>
                      <span style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'#94a3b8' }}>{pplResult.tokens ?? pplResult.num_tokens}</span>
                    </div>
                    <div style={{ fontSize:'0.67rem', color: pplResult.perplexity < 100 ? '#10b981' : pplResult.perplexity < 200 ? '#f59e0b' : '#f87171', marginTop:2 }}>
                      {pplResult.perplexity < 100 ? '✓ High fluency' : pplResult.perplexity < 200 ? '~ Moderate fluency' : '✗ Low fluency'}
                    </div>
                    {pplResult.mode && <div style={{ fontSize:'0.64rem', color:'#475569' }}>Mode: {pplResult.mode}</div>}
                  </div>
                )}
                {pplResult?.error && <div style={{ marginTop:'0.5rem', color:'#f87171', fontSize:'0.74rem' }}>⚠ {pplResult.error}</div>}
              </div>

              {/* CO5 reference panel */}
              <div className="card" style={{ padding:'1rem' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#6366f1', marginBottom:'0.6rem' }}>📚 CO5 — Evaluate GenAI Systems</div>
                {[
                  { label:'BLEU',           src:'Papineni et al. (2002)',  note:'N-gram precision metric, original MT evaluation' },
                  { label:'ROUGE',          src:'Lin (2004)',              note:'Recall-based summarisation evaluation' },
                  { label:'Perplexity',     src:'GPT-2 (2019)',            note:'Language model fluency via cross-entropy' },
                  { label:'Implementation', src:'eval_genai.py',           note:'From scratch in Python — no evaluation libraries' },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', flexDirection:'column', borderBottom:'1px solid rgba(255,255,255,0.05)', padding:'0.4rem 0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'0.74rem', fontWeight:600, color:'var(--text-secondary)' }}>{row.label}</span>
                      <span style={{ fontSize:'0.68rem', color:'#6366f1', fontFamily:'monospace' }}>{row.src}</span>
                    </div>
                    <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{row.note}</span>
                  </div>
                ))}
              </div>

              {/* Score legend */}
              <div className="card" style={{ padding:'0.75rem' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:'0.5rem' }}>Score Legend</div>
                {[
                  { color:'#10b981', label:'Good', desc:'BLEU/ROUGE > 0.5, PPL < 100' },
                  { color:'#f59e0b', label:'Fair', desc:'BLEU/ROUGE 0.25–0.5, PPL 100–200' },
                  { color:'#f87171', label:'Poor', desc:'BLEU/ROUGE < 0.25, PPL > 200' },
                ].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'0.25rem 0' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:l.color, flexShrink:0 }} />
                    <span style={{ fontSize:'0.71rem', color:'var(--text-secondary)', fontWeight:600 }}>{l.label}</span>
                    <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{l.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ TAB: GENAI — 3 PARTS ════════════════════════════════ */}
      {tab === 'genai' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.6 }}>
            The GenAI component of IntelliStake is divided into three distinct sub-systems, each mapped to a Course Outcome (CO) and contributing to the overall AI intelligence layer.
          </div>
          {GENAI_PARTS.map(part => (
            <div key={part.id} className="card" style={{ padding:'1.25rem', border:`1px solid ${part.color}33` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${part.color}20`, border:`1px solid ${part.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{part.icon}</div>
                <div>
                  <div style={{ fontSize:'0.7rem', color:part.color, fontWeight:700, letterSpacing:'0.08em' }}>{part.id}</div>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, color:'var(--text-primary)' }}>{part.label}</div>
                </div>
                <div style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:'0.68rem', color:'#475569', background:'rgba(255,255,255,0.04)', padding:'0.2rem 0.6rem', borderRadius:4 }}>{part.apiEndpoint}</div>
              </div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:'1rem', lineHeight:1.6, borderLeft:`2px solid ${part.color}44`, paddingLeft:'0.75rem' }}>{part.desc}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'0.5rem' }}>
                {part.modules.map(m => (
                  <div key={m.name} style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'0.6rem 0.75rem', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:part.color, marginTop:'0.35rem', flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:'0.76rem', fontWeight:600, color:'var(--text-secondary)' }}>{m.name}</div>
                      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>{m.detail}</div>
                    </div>
                    <span style={{ marginLeft:'auto', fontSize:'0.62rem', color:'#10b981', background:'rgba(16,185,129,0.1)', padding:'0.1rem 0.4rem', borderRadius:3, flexShrink:0 }}>{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════ TAB: PROJECT — 3 PARTS ═══════════════════════════════ */}
      {tab === 'project' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.6 }}>
            IntelliStake is an institutional-grade AI investment platform. The project is structured into three core pillars, each independently functional and integrated via REST APIs.
          </div>
          {PROJECT_PARTS.map(part => (
            <div key={part.id} className="card" style={{ padding:'1.25rem', border:`1px solid ${part.color}33` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.9rem' }}>
                <div style={{ width:44, height:44, borderRadius:10, background:`${part.color}20`, border:`1px solid ${part.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem' }}>{part.icon}</div>
                <div>
                  <div style={{ fontSize:'0.68rem', color:part.color, fontWeight:700, letterSpacing:'0.08em' }}>{part.id}</div>
                  <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)' }}>{part.label}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'0.45rem' }}>
                {part.components.map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', padding:'0.45rem 0.7rem', background:'rgba(255,255,255,0.03)', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:part.color, marginTop:'0.4rem', flexShrink:0 }} />
                    <div style={{ fontSize:'0.76rem', color:'var(--text-secondary)', lineHeight:1.45 }}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
