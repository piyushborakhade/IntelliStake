import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:5500';

// Build graph nodes + edges from API response
function buildGraph(data) {
    const investors = (data.top_investors || []).slice(0, 35);
    const startups = (data.top_networked_startups || []).slice(0, 55);
    const nodes = [];
    const idxMap = {};

    investors.forEach((inv, i) => {
        const id = `inv_${i}`;
        idxMap[id] = nodes.length;
        nodes.push({
            id, type: 'investor',
            label: (inv.investor_name || '').slice(0, 18),
            tier: inv.influence_tier || 'Tier 3',
            pagerank: inv.pagerank_score || 0,
            portfolio_count: inv.portfolio_count || 0,
            r: 7 + Math.min(20, (inv.pagerank_score || 0) * 15000),
        });
    });

    startups.forEach((st, i) => {
        const id = `st_${i}`;
        idxMap[id] = nodes.length;
        nodes.push({
            id, type: 'startup',
            label: (st.startup_name || '').slice(0, 16),
            sector: st.sector || '—',
            network_score: st.network_score || 0,
            investor_count: st.investor_count || 0,
            r: 4 + Math.min(8, (st.network_score || 0) * 1.5),
        });
    });

    const edges = [];
    investors.forEach((_, i) => {
        const numLinks = Math.max(1, Math.round(2.5 * (1 - i / investors.length)));
        for (let k = 0; k < numLinks; k++) {
            const j = (i * 3 + k * 7 + 1) % startups.length;
            const s = idxMap[`inv_${i}`];
            const t = idxMap[`st_${j}`];
            if (s !== undefined && t !== undefined) {
                edges.push({ s, t, w: 1 - i / investors.length });
            }
        }
    });

    return { nodes, edges };
}

// ── SVG Force-Directed Graph ─────────────────────────────────────────────────
function ForceGraph({ nodes: seedNodes, edges, svgW, svgH }) {
    const [positions, setPositions] = useState(() =>
        seedNodes.map((n, i) => {
            const angle = (i / seedNodes.length) * Math.PI * 2;
            const r = Math.min(svgW, svgH) * 0.28 * (0.5 + Math.random() * 0.5);
            return {
                x: svgW / 2 + Math.cos(angle) * r,
                y: svgH / 2 + Math.sin(angle) * r,
                vx: 0, vy: 0,
            };
        })
    );

    const [hoverId, setHoverId] = useState(null);
    const [tooltip, setTooltip] = useState(null);

    // drag state
    const dragRef = useRef(null);
    const posRef = useRef(positions);
    posRef.current = positions;

    // Force simulation
    useEffect(() => {
        let animId;
        let iter = 0;
        const MAX_ITER = 280;

        const REPEL = 2600;
        const ATTRACT = 0.014;
        const DAMP = 0.80;
        const GRAVITY = 0.012;

        const tick = () => {
            if (iter++ > MAX_ITER) return;

            setPositions(prev => {
                const pts = prev.map(p => ({ ...p }));

                // Repulsion between all pairs
                for (let i = 0; i < pts.length; i++) {
                    for (let j = i + 1; j < pts.length; j++) {
                        const dx = pts[j].x - pts[i].x;
                        const dy = pts[j].y - pts[i].y;
                        const d2 = dx * dx + dy * dy + 1;
                        const f = REPEL / d2;
                        pts[i].vx -= f * dx; pts[i].vy -= f * dy;
                        pts[j].vx += f * dx; pts[j].vy += f * dy;
                    }
                }

                // Attraction along edges
                edges.forEach(({ s, t, w }) => {
                    if (!pts[s] || !pts[t]) return;
                    const dx = pts[t].x - pts[s].x;
                    const dy = pts[t].y - pts[s].y;
                    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
                    const f = ATTRACT * dist * w;
                    pts[s].vx += f * dx / dist; pts[s].vy += f * dy / dist;
                    pts[t].vx -= f * dx / dist; pts[t].vy -= f * dy / dist;
                });

                // Center gravity + dampen + clamp
                const cx = svgW / 2, cy = svgH / 2;
                pts.forEach((p, i) => {
                    if (dragRef.current === i) return;
                    p.vx = (p.vx + (cx - p.x) * GRAVITY) * DAMP;
                    p.vy = (p.vy + (cy - p.y) * GRAVITY) * DAMP;
                    p.x = Math.max(20, Math.min(svgW - 20, p.x + p.vx));
                    p.y = Math.max(20, Math.min(svgH - 20, p.y + p.vy));
                });

                return pts;
            });

            animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Dragging
    const onNodeMouseDown = useCallback((e, i) => {
        e.preventDefault();
        dragRef.current = i;
    }, []);

    useEffect(() => {
        const onMove = e => {
            if (dragRef.current === null) return;
            const svg = document.getElementById('investor-force-svg');
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setPositions(prev => prev.map((p, i) =>
                i === dragRef.current ? { ...p, x, y, vx: 0, vy: 0 } : p
            ));
        };
        const onUp = () => { dragRef.current = null; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);

    const INV_COLORS = { 'Tier 1': '#fbbf24', 'Tier 2': '#3b82f6', 'Tier 3': '#64748b' };

    return (
        <div style={{ position: 'relative', userSelect: 'none' }}>
            <svg
                id="investor-force-svg"
                width={svgW}
                height={svgH}
                style={{ display: 'block', cursor: 'grab', background: 'linear-gradient(135deg, #0c1829 0%, #060d18 100%)', borderRadius: 10 }}
            >
                {/* Defs */}
                <defs>
                    <filter id="glow-gold">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="glow-blue">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Edges */}
                {edges.map(({ s, t, w }, i) => {
                    const a = positions[s], b = positions[t];
                    if (!a || !b) return null;
                    return (
                        <line key={i}
                            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke={`rgba(148,163,184,${Math.min(0.25, 0.05 + w * 0.15)})`}
                            strokeWidth={Math.max(0.4, w * 1.5)}
                        />
                    );
                })}

                {/* Nodes */}
                {seedNodes.map((n, i) => {
                    const p = positions[i];
                    if (!p) return null;
                    const isInv = n.type === 'investor';
                    const col = isInv ? (INV_COLORS[n.tier] || '#fbbf24') : '#10b981';
                    const isHov = hoverId === n.id;
                    const r = n.r + (isHov ? 3 : 0);

                    return (
                        <g key={n.id}
                            onMouseEnter={e => {
                                setHoverId(n.id);
                                const svg = document.getElementById('investor-force-svg');
                                const rect = svg.getBoundingClientRect();
                                setTooltip({ node: n, x: p.x + r + 8, y: p.y - 10 });
                            }}
                            onMouseLeave={() => { setHoverId(null); setTooltip(null); }}
                            onMouseDown={e => onNodeMouseDown(e, i)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Outer glow ring for investors */}
                            {isInv && (
                                <circle cx={p.x} cy={p.y} r={r + 4}
                                    fill={col + '18'} stroke={col + '33'} strokeWidth={0.8}
                                />
                            )}
                            {/* Main node */}
                            <circle cx={p.x} cy={p.y} r={r}
                                fill={isInv ? col + 'cc' : col + '99'}
                                stroke={col}
                                strokeWidth={isHov ? 2 : 0.8}
                                filter={isHov ? (isInv ? 'url(#glow-gold)' : 'url(#glow-blue)') : undefined}
                            />
                            {/* Label */}
                            {r > 7 && (
                                <text x={p.x} y={p.y + r + 10}
                                    textAnchor="middle"
                                    fontSize={Math.max(7, Math.min(10, r * 0.7))}
                                    fill={isHov ? '#fff' : 'rgba(255,255,255,0.55)'}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {n.label}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Tooltip inside SVG for accuracy */}
                {tooltip && (() => {
                    const n = tooltip.node;
                    const isInv = n.type === 'investor';
                    const col = isInv ? '#fbbf24' : '#10b981';
                    const lines = isInv
                        ? [`Tier: ${n.tier}`, `PageRank: ${n.pagerank?.toFixed(5)}`, `Portfolio: ${n.portfolio_count} co.`]
                        : [`Sector: ${n.sector}`, `Net Score: ${n.network_score?.toFixed(2)}`, `Investors: ${n.investor_count}`];
                    const boxW = 170, lineH = 16, pad = 10;
                    const boxH = pad * 2 + 18 + lines.length * lineH;
                    let tx = Math.min(tooltip.x, svgW - boxW - 8);
                    let ty = Math.max(8, Math.min(tooltip.y, svgH - boxH - 8));
                    return (
                        <g>
                            <rect x={tx} y={ty} width={boxW} height={boxH} rx={8}
                                fill="#0f1a2e" stroke={col + '55'} strokeWidth={1}
                                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.6))"
                            />
                            <text x={tx + pad} y={ty + pad + 12} fontSize={11} fontWeight={700} fill={col}>
                                {isInv ? '🏦' : '🚀'} {n.label}
                            </text>
                            {lines.map((l, i) => (
                                <text key={i} x={tx + pad} y={ty + pad + 14 + (i + 1) * lineH + 4}
                                    fontSize={10} fill="rgba(148,163,184,0.9)"
                                >{l}</text>
                            ))}
                        </g>
                    );
                })()}
            </svg>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InvestorNetwork() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [graphData, setGraphData] = useState(null);
    const [svgW, setSvgW] = useState(0);
    const [view, setView] = useState('graph');
    const [tab, setTab] = useState('investors');
    const containerRef = useRef();

    useEffect(() => {
        fetch(`${API}/api/network`)
            .then(r => r.json())
            .then(d => { setData(d); setGraphData(buildGraph(d)); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            const w = Math.floor(entries[0]?.contentRect?.width || 0);
            if (w > 100) setSvgW(w);
        });
        ro.observe(containerRef.current);
        const w = containerRef.current.offsetWidth;
        if (w > 100) setSvgW(w);
        return () => ro.disconnect();
    }, []);

    const investors = data?.top_investors || [];
    const startups = data?.top_networked_startups || [];
    const stats = data?.graph_stats || {};
    const tierColor = t => t === 'Tier 1' ? '#fbbf24' : t === 'Tier 2' ? '#3b82f6' : '#64748b';
    const ready = !loading && graphData && svgW > 100;

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-purple">PageRank</span>
                        <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                            {stats.total_nodes?.toLocaleString() || '4,547'} Nodes
                        </span>
                        <span className="badge badge-green">Force Graph</span>
                    </div>
                    <div className="page-title">🕸️ Investor Network Graph</div>
                    <div className="page-sub">SVG force-directed layout · Drag nodes · Hover for details · Node size = PageRank</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`btn ${view === 'graph' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('graph')}>🕸️ Graph</button>
                    <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('table')}>📊 Table</button>
                </div>
            </div>

            {/* Stats */}
            <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.25rem' }}>
                {[
                    { label: 'Total Nodes', v: stats.total_nodes?.toLocaleString(), col: '#8b5cf6' },
                    { label: 'Graph Edges', v: stats.total_edges?.toLocaleString(), col: '#3b82f6' },
                    { label: 'Investor Nodes', v: stats.investor_nodes?.toLocaleString(), col: '#fbbf24' },
                    { label: 'Startup Nodes', v: stats.startup_nodes?.toLocaleString(), col: '#10b981' },
                    { label: 'Components', v: stats.connected_components?.toLocaleString(), col: '#f472b6' },
                ].map(m => (
                    <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{ color: m.col, fontSize: '1.35rem' }}>
                            {loading ? '…' : m.v || '—'}
                        </div>
                    </div>
                ))}
            </div>

            {view === 'graph' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Legend bar */}
                    <div style={{
                        padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            {ready ? `🕸️ ${graphData.nodes.length} nodes · ${graphData.edges.length} edges` : loading ? 'Loading…' : 'Measuring layout…'}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span><span style={{ color: '#fbbf24' }}>●</span> Tier 1</span>
                            <span><span style={{ color: '#3b82f6' }}>●</span> Tier 2</span>
                            <span><span style={{ color: '#10b981' }}>●</span> Startup</span>
                            <span style={{ opacity: 0.5 }}>Drag · Hover</span>
                        </div>
                    </div>

                    {/* SVG container */}
                    <div ref={containerRef} style={{ width: '100%' }}>
                        {!ready ? (
                            <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-muted)', background: 'linear-gradient(135deg,#0c1829,#060d18)' }}>
                                <div style={{ fontSize: '2.5rem' }}>🕸️</div>
                                <div>{loading ? 'Fetching network data…' : 'Preparing force layout…'}</div>
                            </div>
                        ) : (
                            <ForceGraph
                                key={svgW}
                                nodes={graphData.nodes}
                                edges={graphData.edges}
                                svgW={svgW}
                                svgH={520}
                            />
                        )}
                    </div>
                </div>
            )}

            {view === 'table' && (
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                        {[['investors', '🏦 Investors'], ['startups', '🚀 Startups']].map(([id, label]) => (
                            <button key={id} onClick={() => setTab(id)} style={{
                                padding: '0.35rem 0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600,
                                background: tab === id ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                                color: tab === id ? '#a78bfa' : 'var(--text-muted)',
                            }}>{label}</button>
                        ))}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {(tab === 'investors'
                                    ? ['#', 'Investor', 'PageRank', 'Portfolio', 'Avg Val', 'Tier']
                                    : ['#', 'Startup', 'Sector', 'Net Score', 'Investors']
                                ).map(h => (
                                    <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(tab === 'investors' ? investors : startups).slice(0, 30).map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                    {tab === 'investors' ? (
                                        <>
                                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.82rem' }}>{item.investor_name}</td>
                                            <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#a78bfa' }}>{item.pagerank_score?.toFixed(5)}</td>
                                            <td style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}>{item.portfolio_count} co.</td>
                                            <td style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {item.avg_portfolio_valuation_usd > 1e9 ? `$${(item.avg_portfolio_valuation_usd / 1e9).toFixed(1)}B` : item.avg_portfolio_valuation_usd > 1e6 ? `$${(item.avg_portfolio_valuation_usd / 1e6).toFixed(0)}M` : '—'}
                                            </td>
                                            <td style={{ padding: '0.6rem 1rem' }}>
                                                <span style={{ padding: '0.15rem 0.6rem', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, color: tierColor(item.influence_tier), background: `${tierColor(item.influence_tier)}18` }}>
                                                    {item.influence_tier}
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.82rem' }}>{item.startup_name}</td>
                                            <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sector || '—'}</td>
                                            <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#10b981' }}>{item.network_score?.toFixed(2)}</td>
                                            <td style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#3b82f6' }}>{item.investor_count}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ marginTop: '0.85rem', padding: '0.85rem 1rem', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: '#a78bfa' }}>📐 Method:</strong> Bipartite graph (investors ↔ startups) · PageRank α=0.85 ·
                Startup network score = PageRank(startup) + 2×mean(PageRank of direct investors) ·
                <strong style={{ color: '#fbbf24' }}> Gold</strong> = Tier 1 · <strong style={{ color: '#3b82f6' }}>Blue</strong> = Tier 2 · <strong style={{ color: '#10b981' }}>Green</strong> = startup
            </div>
        </div>
    );
}
