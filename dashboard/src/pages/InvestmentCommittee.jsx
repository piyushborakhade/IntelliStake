import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:5500';

const AGENTS = [
    {
        id: 'quant',
        name: 'The Quant',
        role: 'Financial Agent',
        icon: '📈',
        color: '#3b82f6',
        desc: 'Black-Litterman · Monte Carlo · Sharpe Ratio',
        thinking: ['Running Black-Litterman optimization…', 'Computing Sharpe & VaR metrics…', 'Checking portfolio correlation…'],
    },
    {
        id: 'auditor',
        name: 'The Auditor',
        role: 'Security Agent',
        icon: '🔍',
        color: '#10b981',
        desc: 'IsolationForest · GitHub Velocity · Risk Signals',
        thinking: ['Scanning GitHub velocity signals…', 'Running IsolationForest anomaly check…', 'Cross-referencing R.A.I.S.E. risk matrix…'],
    },
    {
        id: 'newsroom',
        name: 'The Newsroom',
        role: 'Sentiment Agent',
        icon: '📡',
        color: '#8b5cf6',
        desc: 'FinBERT · RSS Headlines · Sentiment Compound',
        thinking: ['Fetching live FinBERT headlines…', 'Computing sentiment compound score…', 'Checking for portfolio alert triggers…'],
    },
    {
        id: 'manager',
        name: 'The Manager',
        role: 'Orchestrator Agent',
        icon: '🧠',
        color: '#f59e0b',
        desc: 'Synthesizes Quant · Auditor · Newsroom outputs',
        thinking: ['Receiving agent briefs…', 'Weighing risk vs. reward signals…', 'Forming final investment committee verdict…'],
    },
];

const QUICK_PICKS = ['Zepto', 'Razorpay', 'CRED', 'Meesho', 'PhonePe', 'Nykaa', 'Ola', 'Swiggy'];

function TypingDots() {
    return (
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 6 }}>
            {[0, 1, 2].map(i => (
                <span key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    opacity: 0.7,
                }} />
            ))}
        </span>
    );
}

function AgentCard({ agent, state, output, elapsed }) {
    const isDone = state === 'done';
    const isThinking = state === 'thinking';
    const isIdle = state === 'idle';

    return (
        <div style={{
            borderRadius: 16,
            border: `1px solid ${isDone ? agent.color + '55' : isThinking ? agent.color + '33' : 'var(--border)'}`,
            background: isDone ? `${agent.color}08` : isThinking ? `${agent.color}05` : 'var(--bg-card)',
            padding: '1.25rem',
            transition: 'all 0.4s ease',
            boxShadow: isDone ? `0 4px 24px ${agent.color}15` : 'none',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Scanning line animation when thinking */}
            {isThinking && (
                <div style={{
                    position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
                    background: `linear-gradient(90deg, transparent, ${agent.color}12, transparent)`,
                    animation: 'slide-right 1.5s linear infinite',
                    pointerEvents: 'none',
                }} />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `${agent.color}20`, border: `1px solid ${agent.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                    flexShrink: 0,
                }}>
                    {agent.icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isDone ? agent.color : 'var(--text-primary)' }}>
                        {agent.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{agent.role}</div>
                </div>
                <div style={{
                    padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.62rem', fontWeight: 700,
                    background: isDone ? `${agent.color}20` : isThinking ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                    color: isDone ? agent.color : isThinking ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${isDone ? agent.color + '44' : 'var(--border)'}`,
                }}>
                    {isDone ? `✓ ${elapsed}s` : isThinking ? <>ANALYZING<TypingDots /></> : 'WAITING'}
                </div>
            </div>

            {/* Content */}
            {isIdle && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                    {agent.desc}
                </div>
            )}
            {isThinking && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: agent.color }}>{agent.thinking[Math.floor(Date.now() / 1200) % agent.thinking.length]}</span>
                </div>
            )}
            {isDone && output && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* KPI chips */}
                    {output.kpis && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                            {output.kpis.map((k, i) => (
                                <span key={i} style={{
                                    padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 700,
                                    background: `${agent.color}18`, color: agent.color, border: `1px solid ${agent.color}33`,
                                }}>
                                    {k}
                                </span>
                            ))}
                        </div>
                    )}
                    {/* Main finding */}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {output.brief}
                    </div>
                    {/* Verdict chip */}
                    {output.verdict && (
                        <div style={{
                            marginTop: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 8,
                            background: output.verdict === 'BUY' ? 'rgba(16,185,129,0.12)' :
                                output.verdict === 'SELL' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                            border: `1px solid ${output.verdict === 'BUY' ? 'rgba(16,185,129,0.3)' :
                                output.verdict === 'SELL' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            color: output.verdict === 'BUY' ? '#10b981' : output.verdict === 'SELL' ? '#ef4444' : '#f59e0b',
                            fontWeight: 800, fontSize: '0.78rem', display: 'inline-block',
                        }}>
                            {output.verdict === 'BUY' ? '▲ ' : output.verdict === 'SELL' ? '▼ ' : '⚖ '}{output.verdict}
                            {output.confidence && <span style={{ fontWeight: 400, opacity: 0.8 }}> · {output.confidence}% confidence</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function InvestmentCommittee({ onNav }) {
    const [company, setCompany] = useState('');
    const [inputVal, setInputVal] = useState('');
    const [agentStates, setAgentStates] = useState({ quant: 'idle', auditor: 'idle', newsroom: 'idle', manager: 'idle' });
    const [outputs, setOutputs] = useState({});
    const [elapsed, setElapsed] = useState({});
    const [running, setRunning] = useState(false);
    const [managerSummary, setManagerSummary] = useState(null);
    const [log, setLog] = useState([]);
    const logRef = useRef();
    const startRef = useRef({});

    const addLog = (msg) => setLog(l => [...l, { msg, ts: new Date().toLocaleTimeString('en-IN', { hour12: false }) }]);

    const runCommittee = async (co) => {
        if (!co.trim() || running) return;
        setRunning(true);
        setOutputs({});
        setElapsed({});
        setManagerSummary(null);
        setLog([]);
        setAgentStates({ quant: 'idle', auditor: 'idle', newsroom: 'idle', manager: 'idle' });

        addLog(`🏛️ Investment Committee convened for: ${co}`);

        try {
            // Quant + Auditor + Newsroom start together
            const t0 = Date.now();
            startRef.current = { quant: t0, auditor: t0, newsroom: t0 };

            setAgentStates(s => ({ ...s, quant: 'thinking', auditor: 'thinking', newsroom: 'thinking' }));
            addLog('🧠 Quant, Auditor & Newsroom agents dispatched in parallel…');

            const res = await fetch(`${API}/api/committee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: co }),
            });
            const data = await res.json();
            const t1 = Date.now();
            const totalMs = t1 - t0;

            // Quant done
            setAgentStates(s => ({ ...s, quant: 'done' }));
            setOutputs(o => ({ ...o, quant: data.quant }));
            setElapsed(e => ({ ...e, quant: ((totalMs * 0.6) / 1000).toFixed(1) }));
            addLog(`📈 Quant brief ready: ${data.quant?.verdict || 'computed'}`);

            await new Promise(r => setTimeout(r, 300));

            // Auditor done
            setAgentStates(s => ({ ...s, auditor: 'done' }));
            setOutputs(o => ({ ...o, auditor: data.auditor }));
            setElapsed(e => ({ ...e, auditor: ((totalMs * 0.75) / 1000).toFixed(1) }));
            addLog(`🔍 Auditor brief ready: ${data.auditor?.verdict || 'computed'}`);

            await new Promise(r => setTimeout(r, 300));

            // Newsroom done
            setAgentStates(s => ({ ...s, newsroom: 'done' }));
            setOutputs(o => ({ ...o, newsroom: data.newsroom }));
            setElapsed(e => ({ ...e, newsroom: ((totalMs * 0.85) / 1000).toFixed(1) }));
            addLog(`📡 Newsroom brief ready: ${data.newsroom?.verdict || 'computed'}`);

            addLog('🧠 Manager synthesizing committee opinions…');
            setAgentStates(s => ({ ...s, manager: 'thinking' }));

            await new Promise(r => setTimeout(r, 800));

            // Manager final
            setAgentStates(s => ({ ...s, manager: 'done' }));
            setOutputs(o => ({ ...o, manager: data.manager }));
            setElapsed(e => ({ ...e, manager: (totalMs / 1000).toFixed(1) }));
            setManagerSummary(data.manager);
            addLog(`✅ Committee verdict: ${data.manager?.verdict || 'HOLD'} — ${data.manager?.summary?.slice(0, 60)}…`);

        } catch (err) {
            addLog(`❌ Error: ${err.message}`);
        } finally {
            setRunning(false);
        }
    };

    // Auto-scroll log
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [log]);

    const handleSubmit = () => { setCompany(inputVal); runCommittee(inputVal); };

    const verdictColor = v => v === 'BUY' ? '#10b981' : v === 'SELL' ? '#ef4444' : '#f59e0b';
    const verdictBg = v => v === 'BUY' ? 'rgba(16,185,129,0.1)' : v === 'SELL' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';

    return (
        <div>
            {/* Inline keyframes */}
            <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes slide-right { 0%{left:-100%} 100%{left:200%} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

            {/* Header */}
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">Multi-Agent</span>
                        <span className="badge badge-purple">4 Specialists</span>
                        <span className="badge badge-green">Real-time Synthesis</span>
                    </div>
                    <div className="page-title">🏛️ AI Investment Committee</div>
                    <div className="page-sub">4 specialized agents deliberate on a startup · Quant · Auditor · Newsroom · Manager synthesizes</div>
                </div>
            </div>

            {/* Search */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 280 }}>
                        <div className="input-wrapper">
                            <span className="input-icon">🏢</span>
                            <input
                                className="input-field has-icon"
                                placeholder='Enter startup name — e.g. "Zepto"'
                                value={inputVal}
                                onChange={e => setInputVal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                disabled={running}
                            />
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={running || !inputVal.trim()}>
                        {running ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Deliberating…</> : '🏛️ Convene Committee'}
                    </button>
                </div>

                {/* Quick picks */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick:</span>
                    {QUICK_PICKS.map(q => (
                        <button key={q} onClick={() => { setInputVal(q); runCommittee(q); }}
                            disabled={running}
                            style={{
                                padding: '0.25rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.72rem',
                                cursor: running ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                            }}>
                            {q}
                        </button>
                    ))}
                </div>
            </div>

            {/* Agent cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {AGENTS.slice(0, 3).map(agent => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        state={agentStates[agent.id]}
                        output={outputs[agent.id]}
                        elapsed={elapsed[agent.id]}
                    />
                ))}
                {/* Manager spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <AgentCard
                        agent={AGENTS[3]}
                        state={agentStates.manager}
                        output={outputs.manager}
                        elapsed={elapsed.manager}
                    />
                </div>
            </div>

            {/* Committee verdict banner */}
            {managerSummary && (
                <div style={{
                    padding: '1.5rem', borderRadius: 16, marginBottom: '1.25rem',
                    background: verdictBg(managerSummary.verdict),
                    border: `1px solid ${verdictColor(managerSummary.verdict)}33`,
                    animation: 'fadeSlide 0.4s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{
                            fontSize: '2.5rem', fontWeight: 900, color: verdictColor(managerSummary.verdict),
                            letterSpacing: '-0.04em', lineHeight: 1,
                        }}>
                            {managerSummary.verdict === 'BUY' ? '▲' : managerSummary.verdict === 'SELL' ? '▼' : '⚖'} {managerSummary.verdict}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: verdictColor(managerSummary.verdict), marginBottom: '0.25rem' }}>
                                Committee Decision for {company}
                                {managerSummary.confidence && (
                                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                        · {managerSummary.confidence}% consensus confidence
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {managerSummary.summary}
                            </div>
                        </div>
                        {/* Vote breakdown */}
                        {managerSummary.votes && (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {Object.entries(managerSummary.votes).map(([v, n]) => (
                                    <div key={v} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: verdictColor(v) }}>{n}</div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom: Log + KPI row together */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Deliberation log */}
                <div className="card">
                    <div className="card-title">📋 Deliberation Log</div>
                    <div
                        ref={logRef}
                        style={{ height: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {log.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', paddingTop: '3rem' }}>
                                Convene a committee to see the deliberation log here
                            </div>
                        ) : log.map((l, i) => (
                            <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{l.ts}</span>
                                <span>{l.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* How it works */}
                <div className="card">
                    <div className="card-title">⚙️ How the MAS Works</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[
                            { icon: '📈', label: 'Quant', desc: 'Black-Litterman BL_return, Monte Carlo VaR, Sharpe ratio from portfolio data' },
                            { icon: '🔍', label: 'Auditor', desc: 'IsolationForest hype anomaly, GitHub velocity RAISE risk scoring' },
                            { icon: '📡', label: 'Newsroom', desc: 'FinBERT compound sentiment score, portfolio alert detection, sector momentum' },
                            { icon: '🧠', label: 'Manager', desc: 'Weighted vote synthesis → BUY / HOLD / SELL + confidence score' },
                        ].map(a => (
                            <div key={a.label} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{a.icon}</span>
                                <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>{a.label}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
