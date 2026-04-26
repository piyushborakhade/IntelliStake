import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5500';

const INVESTOR_STARTERS = [
    'How is my portfolio doing?',
    'Which of my holdings is riskiest?',
    'Find me 3 new startups matching my profile',
    "What's the market sentiment today?",
];

const SAMPLE_QUERIES = [
    'Tell me about Zepto',
    'Top startups by trust score',
    'Which startups are hype anomalies?',
    'What is the backtest CAGR?',
    'Show portfolio allocations',
    'GitHub velocity top performers',
    'What is the VaR of the portfolio?',
    'How many funding rounds are tracked?',
    'Explain FinBERT sentiment results',
    'Which startups have HIGH risk?',
    'Sector distribution of startups',
    "Tell me about Byju's",
    'What is IntelliStake?',
    'Explain SHAP feature importance',
    'What is the Sharpe ratio of the portfolio?',
    'Which startup has the highest funding?',
];

// Simple markdown renderer — converts bold, code, bullets, headers to JSX
function renderMarkdown(text) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // H3 ###
        if (line.startsWith('### ')) {
            elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '0.6rem', marginBottom: '0.2rem' }}>{inlineMarkdown(line.slice(4))}</div>);
        }
        // H2 ##
        else if (line.startsWith('## ')) {
            elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.92rem', color: '#a5b4fc', marginTop: '0.75rem', marginBottom: '0.2rem' }}>{inlineMarkdown(line.slice(3))}</div>);
        }
        // Code block ```
        else if (line.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push(
                <pre key={`code-${i}`} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0.6rem 0.8rem', overflowX: 'auto', fontSize: '0.76rem', color: '#7dd3fc', margin: '0.4rem 0', lineHeight: 1.55 }}>
                    {codeLines.join('\n')}
                </pre>
            );
        }
        // Bullet - or *
        else if (/^[-*] /.test(line)) {
            const bulletItems = [];
            while (i < lines.length && /^[-*] /.test(lines[i])) {
                bulletItems.push(<li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.55, marginBottom: 2 }}>{inlineMarkdown(lines[i].slice(2))}</li>);
                i++;
            }
            elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '1.2rem', margin: '0.3rem 0', listStyleType: 'disc' }}>{bulletItems}</ul>);
            continue;
        }
        // Numbered list
        else if (/^\d+\. /.test(line)) {
            const numItems = [];
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                numItems.push(<li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.55, marginBottom: 2 }}>{inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>);
                i++;
            }
            elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: '1.2rem', margin: '0.3rem 0' }}>{numItems}</ol>);
            continue;
        }
        // Separator ---
        else if (/^---+$/.test(line.trim())) {
            elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />);
        }
        // Empty line
        else if (line.trim() === '') {
            elements.push(<div key={i} style={{ height: '0.35rem' }} />);
        }
        // Normal paragraph
        else {
            elements.push(<div key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.65 }}>{inlineMarkdown(line)}</div>);
        }
        i++;
    }
    return elements;
}

// Inline: **bold**, `code`, *italic*
function inlineMarkdown(text) {
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        const bold = remaining.match(/\*\*(.+?)\*\*/);
        const code = remaining.match(/`(.+?)`/);
        const italic = remaining.match(/\*(.+?)\*/);

        const candidates = [bold, code, italic].filter(Boolean);
        if (candidates.length === 0) { parts.push(<span key={key++}>{remaining}</span>); break; }

        const first = candidates.reduce((a, b) => a.index <= b.index ? a : b);

        if (first.index > 0) parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>);

        if (first === bold) {
            parts.push(<strong key={key++} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{first[1]}</strong>);
        } else if (first === code) {
            parts.push(<code key={key++} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3, padding: '0 4px', fontFamily: 'monospace', fontSize: '0.82em', color: '#7dd3fc' }}>{first[1]}</code>);
        } else if (first === italic) {
            parts.push(<em key={key++} style={{ color: '#c4b5fd', fontStyle: 'italic' }}>{first[1]}</em>);
        }
        remaining = remaining.slice(first.index + first[0].length);
    }
    return parts;
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button onClick={copy} title="Copy" style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
            padding: '2px 6px', cursor: 'pointer', fontSize: '0.68rem',
            color: copied ? '#10b981' : '#64748b', transition: 'all 0.2s',
        }}>
            {copied ? '✓ copied' : '⎘'}
        </button>
    );
}

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    const isAssistant = msg.role === 'assistant';

    return (
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                background: isUser
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : isSystem
                        ? '#1e293b'
                        : 'linear-gradient(135deg,#10b981,#3b82f6)',
                border: isSystem ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
                {isUser ? '👤' : isSystem ? '⚙️' : '🤖'}
            </div>

            <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Role label + copy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: '0.65rem', color: isUser ? '#60a5fa' : isSystem ? '#64748b' : '#34d399', fontWeight: 600, letterSpacing: '0.04em' }}>
                        {isUser ? 'YOU' : isSystem ? 'SYSTEM' : 'INTELLISTAKE AI'}
                    </span>
                    {isAssistant && <CopyButton text={msg.text} />}
                    {msg.timestamp && <span style={{ fontSize: '0.6rem', color: '#334155' }}>{msg.timestamp}</span>}
                </div>

                {/* Bubble */}
                <div style={{
                    background: isUser ? 'rgba(59,130,246,0.13)' : isSystem ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isUser ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    padding: '0.75rem 1rem',
                }}>
                    {isUser || isSystem
                        ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        : <div style={{ lineHeight: 1.65 }}>{renderMarkdown(msg.text)}</div>
                    }

                    {/* Sources + intent + model badges */}
                    {(msg.sources?.length > 0 || msg.intents?.length > 0 || msg.ollama_used || msg.model) && (
                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {msg.model && (
                                <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '0.1rem 0.45rem', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700 }}>
                                    ⚡ {msg.model}
                                </span>
                            )}
                            {msg.ollama_used && (
                                <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '0.1rem 0.45rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    🦙 llama3
                                </span>
                            )}
                            {msg.rag_used && (
                                <span style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 600 }}>
                                    📚 RAG
                                </span>
                            )}
                            {msg.sources?.slice(0, 4).map(s => (
                                <span key={s} style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem' }}>
                                    📎 {s}
                                </span>
                            ))}
                            {msg.intents?.slice(0, 3).map(intent => (
                                <span key={intent} style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.68rem' }}>
                                    #{intent}
                                </span>
                            ))}
                        </div>
                    )}
                    {msg.error && (
                        <div style={{ marginTop: '0.4rem', color: '#f87171', fontSize: '0.76rem' }}>⚠ {msg.error}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

const INITIAL_MESSAGES = [
    {
        role: 'system',
        text: 'IntelliStake VC Auditor AI is ready.\n\nI have real-time access to the full data lake:\n• 50,000 startups with trust scores, risk signals & GitHub velocity\n• 46,809 funding rounds\n• BL Portfolio, Monte Carlo simulations, Backtest results\n• SHAP narratives, FinBERT sentiment, Hype Anomaly flags\n• KYC/Identity registry & Oracle transactions\n• CLIP sector classifications (LVM — CO4)\n• RAG pipeline: ChromaDB + MiniLM + Ollama llama3\n\nAsk me anything about the IntelliStake platform.',
    }
];

export default function RagChatbot() {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState({ status: 'checking' });
    const [suggestions, setSuggestions] = useState([]);
    const [evalMetrics, setEvalMetrics] = useState(null);
    const chatRef = useRef(null);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    // Check API status
    useEffect(() => {
        const check = () => {
            fetch(`${API_BASE}/api/status`)
                .then(r => r.json())
                .then(d => setApiStatus(d))
                .catch(() => setApiStatus({ status: 'offline' }));
        };
        check();
        const id = setInterval(check, 15000);
        return () => clearInterval(id);
    }, []);

    // Fetch eval metrics summary for sidebar
    useEffect(() => {
        fetch(`${API_BASE}/api/eval/metrics`)
            .then(r => r.json())
            .then(d => setEvalMetrics(d?.averages))
            .catch(() => {});
    }, []);

    // Live search suggestions
    const fetchSuggestions = useCallback((val) => {
        clearTimeout(debounceRef.current);
        if (!val || val.length < 2) { setSuggestions([]); return; }
        debounceRef.current = setTimeout(() => {
            fetch(`${API_BASE}/api/search?q=${encodeURIComponent(val)}`)
                .then(r => r.json())
                .then(results => setSuggestions(results.map(r => `Tell me about ${r.name}`)))
                .catch(() => setSuggestions([]));
        }, 250);
    }, []);

    const handleInput = (val) => {
        setInput(val);
        fetchSuggestions(val);
    };

    const sendQuery = async (q) => {
        if (!q.trim() || loading) return;
        const query = q.trim();
        setInput('');
        setSuggestions([]);

        const userMsg = { role: 'user', text: query, timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }) };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Build conversation history for the API (last 6 turns, excluding system)
        const history = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-6)
            .map(m => ({ role: m.role, content: m.text }));

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, history }),
            });

            if (!res.ok) throw new Error(`API error ${res.status}`);
            const data = await res.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                text: data.answer,
                sources: data.sources,
                intents: data.intents,
                ollama_used: data.ollama_used,
                rag_used: data.rag_used ?? !!data.sources?.length,
                model: data.model_used || (data.ollama_used ? 'llama3' : 'RAG'),
                timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: 'Could not reach the chatbot API. Make sure it is running:\n\n  python3 engine/chatbot_api.py --port 5500',
                error: err.message,
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); }
        if (e.key === 'Escape') setSuggestions([]);
    };

    const clearChat = () => setMessages(INITIAL_MESSAGES);

    const { status: apiStat, data: apiData, ollama } = apiStatus;
    const statusLabel = apiStat === 'ready'
        ? `🟢 ${apiData?.startups?.toLocaleString() || '…'} startups`
        : apiStat === 'offline'
            ? '🔴 API Offline'
            : '⏳ Connecting…';
    const statusColor = apiStat === 'ready' ? '#10b981' : apiStat === 'offline' ? '#f87171' : '#94a3b8';

    const msgCount = messages.filter(m => m.role !== 'system').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: '0.75rem' }}>

            {/* Header */}
            <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                    <div className="section-title">AI Analyst — RAG Chatbot</div>
                    <div className="section-sub">ChromaDB · MiniLM-L6-v2 · Ollama llama3 · 50K startups · Real data only · CO3</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 4, padding: '0.2rem 0.6rem' }}>
                        {statusLabel}
                    </span>
                    {ollama?.running && (
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>
                            🦙 {ollama.models?.[0] || 'llama3'}
                        </span>
                    )}
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>📚 RAG</span>
                    <span className="badge badge-ai">CO3</span>
                    {msgCount > 0 && (
                        <button onClick={clearChat} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 4, padding: '0.2rem 0.55rem', color: '#f87171', fontSize: '0.7rem', cursor: 'pointer' }}>
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1rem', flex: 1, minHeight: 0 }}>

                {/* Chat panel */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

                    {/* Architecture pills */}
                    <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                            { label: 'Query', color: '#6366f1' },
                            { label: '→ Intent Classify', color: '#8b5cf6' },
                            { label: '→ ChromaDB Retrieve', color: '#3b82f6' },
                            { label: '→ MiniLM Embed', color: '#06b6d4' },
                            { label: '→ Ollama Generate', color: '#10b981' },
                            { label: '→ Response', color: '#f59e0b' },
                        ].map(p => (
                            <span key={p.label} style={{ fontSize: '0.63rem', color: p.color, opacity: 0.85, letterSpacing: '0.04em' }}>{p.label}</span>
                        ))}
                    </div>

                    {/* Messages */}
                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                        {loading && (
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🤖</div>
                                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px 12px 12px 12px', padding: '0.75rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Querying IntelliStake data lake</span>
                                        {[0, 1, 2].map(d => (
                                            <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: `bounce 1.2s ${d * 0.2}s infinite` }} />
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: '0.68rem', color: '#475569' }}>ChromaDB → MiniLM → Ollama…</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem', flexShrink: 0 }}>
                        {/* Investor quick-start chips */}
                        {messages.length <= 2 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                                {INVESTOR_STARTERS.map((q, i) => (
                                    <button key={i} onClick={() => sendQuery(q)} style={{
                                        fontSize: '0.72rem', padding: '4px 11px', borderRadius: 999,
                                        border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.07)',
                                        color: '#a5b4fc', cursor: 'pointer', fontWeight: 600,
                                        transition: 'all 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                                    >{q}</button>
                                ))}
                            </div>
                        )}
                        {suggestions.length > 0 && (
                            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '0.5rem', overflow: 'hidden' }}>
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => sendQuery(s)}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.8rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.81rem', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >🔍 {s}</button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => handleInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Ask anything about IntelliStake data… (Enter to send, Shift+Enter for newline)"
                                disabled={loading}
                                rows={1}
                                style={{
                                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '8px', padding: '0.6rem 0.9rem', color: 'var(--text-primary)',
                                    fontSize: '0.88rem', outline: 'none', resize: 'none',
                                    fontFamily: 'inherit', lineHeight: 1.5,
                                    transition: 'border 0.2s', maxHeight: '120px', overflowY: 'auto',
                                }}
                                onInput={e => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                }}
                            />
                            <button onClick={() => sendQuery(input)} disabled={loading || !input.trim()}
                                style={{
                                    padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none',
                                    background: loading || !input.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366f1,#3b82f6)',
                                    color: loading || !input.trim() ? '#475569' : '#fff',
                                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '0.84rem', fontWeight: 600, transition: 'all 0.2s',
                                }}>
                                Send ↑
                            </button>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.63rem', color: '#334155', textAlign: 'right' }}>
                            {msgCount} messages · history: last 6 turns sent to API
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>

                    {/* Data inventory */}
                    {apiData && (
                        <div className="card" style={{ padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>📦 DATA LAKE</div>
                            {[
                                ['Startups', apiData.startups, '#10b981'],
                                ['Funding Rounds', apiData.funding, '#3b82f6'],
                                ['Investors (KYC)', apiData.investors, '#6366f1'],
                                ['Portfolio Holdings', apiData.portfolio, '#f59e0b'],
                                ['Hype Flags', apiData.hype_flags, '#f87171'],
                                ['SHAP Narratives', apiData.shap, '#e879f9'],
                            ].map(([label, val, color]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.22rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{label}</span>
                                    <span style={{ color, fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 700 }}>
                                        {(val || 0).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* GenAI eval summary */}
                    {evalMetrics && (
                        <div className="card" style={{ padding: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e879f9', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>📐 EVAL METRICS (CO5)</div>
                            {[
                                ['BLEU', evalMetrics.bleu?.toFixed(3), '#6366f1'],
                                ['ROUGE-1 F1', evalMetrics.rouge1_f?.toFixed(3), '#10b981'],
                                ['ROUGE-L F1', evalMetrics.rougeL_f?.toFixed(3), '#3b82f6'],
                                ['Perplexity', evalMetrics.perplexity?.toFixed(1), '#e879f9'],
                            ].map(([label, val, color]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.22rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</span>
                                    <span style={{ color, fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>{val}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sample queries */}
                    <div className="card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>💡 TRY ASKING</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {SAMPLE_QUERIES.map((q, i) => (
                                <button key={i} onClick={() => sendQuery(q)}
                                    style={{
                                        display: 'block', textAlign: 'left', width: '100%',
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '5px', padding: '0.35rem 0.5rem',
                                        color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer',
                                        transition: 'all 0.15s', lineHeight: 1.4,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#a5b4fc'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                                >{q}</button>
                            ))}
                        </div>
                    </div>

                    {/* Tech stack */}
                    <div className="card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>⚙️ RAG PIPELINE</div>
                        {[
                            { step: 'Embed', tech: 'MiniLM-L6-v2', co: 'CO3' },
                            { step: 'Retrieve', tech: 'ChromaDB', co: 'CO3' },
                            { step: 'Generate', tech: 'Ollama llama3', co: 'CO3' },
                            { step: 'Eval', tech: 'GPT-2 PPL', co: 'CO5' },
                            { step: 'Classify', tech: 'CLIP ViT-B/32', co: 'CO4' },
                        ].map(r => (
                            <div key={r.step} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.step}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.tech}</span>
                                <span style={{ fontSize: '0.62rem', color: '#6366f1', fontWeight: 700 }}>{r.co}</span>
                            </div>
                        ))}
                        <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.68rem', color: '#334155', lineHeight: 1.6 }}>
                            <span style={{ color: '#475569' }}>POST </span>:5500/api/chat
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); opacity: 0.4; }
                    50% { transform: translateY(-4px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
