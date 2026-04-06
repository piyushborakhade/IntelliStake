import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5500';

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
    'Tell me about the MilestoneEscrow contract',
    'How many investors in the KYC registry?',
    'Sector distribution of startups',
    'Tell me about Byju\'s',
    'What is IntelliStake?',
];

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isUser ? 'row-reverse' : 'row' }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                background: isUser
                    ? 'var(--accent-blue)'
                    : msg.role === 'system'
                        ? '#334155'
                        : 'linear-gradient(135deg,#10b981,#3b82f6)',
            }}>
                {isUser ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}
            </div>
            <div style={{
                maxWidth: '82%',
                background: isUser ? 'rgba(59,130,246,0.13)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isUser ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                padding: '0.75rem 1rem',
            }}>
                <pre style={{
                    margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem',
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.65,
                }}>
                    {msg.text}
                </pre>

                {/* Sources + intent badges */}
                {(msg.sources?.length > 0 || msg.intents?.length > 0 || msg.ollama_used) && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {msg.ollama_used && (
                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '0.1rem 0.45rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>
                                🦙 llama3
                            </span>
                        )}
                        {msg.sources?.map(s => (
                            <span key={s} style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem' }}>
                                📎 {s}
                            </span>
                        ))}
                        {msg.intents?.slice(0, 3).map(i => (
                            <span key={i} style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.68rem' }}>
                                #{i}
                            </span>
                        ))}
                    </div>
                )}

                {/* Error */}
                {msg.error && (
                    <div style={{ marginTop: '0.4rem', color: '#f87171', fontSize: '0.76rem' }}>
                        ⚠ {msg.error}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function RagChatbot() {
    const [messages, setMessages] = useState([
        {
            role: 'system',
            text: 'IntelliStake VC Auditor AI is ready.\n\nI have real-time access to the full data lake:\n• 50,000 startups with trust scores, risk signals & GitHub velocity\n• 46,809 funding rounds\n• BL Portfolio, Monte Carlo simulations, Backtest results\n• SHAP narratives, FinBERT sentiment, Hype Anomaly flags\n• KYC/Identity registry & Oracle transactions\n\nAsk me anything about the project.',
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState({ status: 'checking' });
    const [suggestions, setSuggestions] = useState([]);
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
        const id = setInterval(check, 12000);
        return () => clearInterval(id);
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
        setInput('');
        setSuggestions([]);
        setMessages(prev => [...prev, { role: 'user', text: q }]);
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q }),
            });

            if (!res.ok) throw new Error(`API error ${res.status}`);
            const data = await res.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                text: data.answer,
                sources: data.sources,
                intents: data.intents,
                ollama_used: data.ollama_used,
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: 'Could not reach the chatbot API. Make sure it is running:\n\n  python3 engine/chatbot_api.py --port 5500',
                error: err.message,
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); }
        if (e.key === 'Escape') setSuggestions([]);
    };

    // Status indicator
    const { status: apiStat, data: apiData, ollama } = apiStatus;
    const statusLabel = apiStat === 'ready'
        ? `🟢 API Ready — ${apiData?.startups?.toLocaleString() || '…'} startups loaded`
        : apiStat === 'offline'
            ? '🔴 API Offline — start: python3 engine/chatbot_api.py'
            : '⏳ Connecting…';
    const statusColor = apiStat === 'ready' ? 'var(--accent-green)' : apiStat === 'offline' ? '#f87171' : '#94a3b8';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: '0.75rem' }}>

            {/* Header */}
            <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                    <div className="section-title">VC Auditor RAG Chatbot</div>
                    <div className="section-sub">Real data · 50K startups · 46K funding rounds · Ollama llama3 enrichment</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: statusColor, border: `1px solid ${statusColor}`, borderRadius: '4px', padding: '0.2rem 0.6rem' }}>
                        {statusLabel}
                    </span>
                    {ollama?.running && (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                            🦙 {ollama.models?.[0] || 'llama3'}
                        </span>
                    )}
                    <span className="badge badge-ai">RAG</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1rem', flex: 1, minHeight: 0 }}>

                {/* Chat panel */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                        {loading && (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
                                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px 12px 12px 12px', padding: '0.75rem 1rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Querying IntelliStake data lake…</span>
                                    <span style={{ color: 'var(--accent-green)', marginLeft: 4 }}>●●●</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input area */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem' }}>
                        {/* Suggestions dropdown */}
                        {suggestions.length > 0 && (
                            <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '0.5rem', overflow: 'hidden' }}>
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => sendQuery(s)}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.8rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >{s}</button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => handleInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Ask anything about IntelliStake data…"
                                disabled={loading}
                                style={{
                                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '8px', padding: '0.6rem 0.9rem', color: 'var(--text-primary)',
                                    fontSize: '0.88rem', outline: 'none', transition: 'border 0.2s',
                                }}
                            />
                            <button onClick={() => sendQuery(input)} disabled={loading || !input.trim()}
                                className="nav-item active"
                                style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', opacity: loading || !input.trim() ? 0.5 : 1 }}>
                                Send ↑
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar: sample questions + data stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>

                    {/* Data inventory */}
                    {apiData && (
                        <div className="card" style={{ padding: '0.75rem' }}>
                            <div className="card-label" style={{ marginBottom: '0.5rem' }}>📦 Data Loaded</div>
                            {[
                                ['Startups', apiData.startups],
                                ['Funding Rounds', apiData.funding],
                                ['Investors (KYC)', apiData.investors],
                                ['Portfolio Holdings', apiData.portfolio],
                                ['Hype Flags', apiData.hype_flags],
                                ['SHAP Narratives', apiData.shap],
                            ].map(([label, val]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}</span>
                                    <span style={{ color: 'var(--accent-green)', fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {(val || 0).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sample queries */}
                    <div className="card" style={{ padding: '0.75rem' }}>
                        <div className="card-label" style={{ marginBottom: '0.5rem' }}>💡 Try Asking</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {SAMPLE_QUERIES.map((q, i) => (
                                <button key={i} onClick={() => sendQuery(q)}
                                    style={{
                                        display: 'block', textAlign: 'left', width: '100%',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '5px', padding: '0.38rem 0.55rem',
                                        color: 'var(--text-secondary)', fontSize: '0.73rem', cursor: 'pointer',
                                        transition: 'all 0.15s', lineHeight: 1.4,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#93c5fd'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >{q}</button>
                            ))}
                        </div>
                    </div>

                    {/* API info */}
                    <div className="card" style={{ padding: '0.75rem' }}>
                        <div className="card-label" style={{ marginBottom: '0.4rem' }}>⚙️ Backend</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.71rem', color: '#475569', lineHeight: 1.8 }}>
                            <div style={{ color: '#64748b' }}># If API is offline:</div>
                            <div style={{ color: '#94a3b8' }}>python3 engine/chatbot_api.py</div>
                            <div style={{ color: '#64748b', marginTop: 4 }}># Endpoint:</div>
                            <div style={{ color: '#94a3b8' }}>POST :5500/api/chat</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
