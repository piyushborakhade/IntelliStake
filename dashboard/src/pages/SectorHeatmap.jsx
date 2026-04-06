import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:5500';

const SECTOR_COLORS = {
    'AI/ML': '#10b981',
    'SaaS': '#3b82f6',
    'FinTech': '#8b5cf6',
    'Fintech': '#8b5cf6',
    'Healthcare': '#ef4444',
    'HealthTech': '#ef4444',
    'Blockchain': '#f59e0b',
    'Logistics': '#06b6d4',
    'E-commerce': '#ec4899',
    'eCommerce': '#ec4899',
    'Biotechnology': '#84cc16',
    'Software': '#14b8a6',
    'Technology': '#6366f1',
    'EdTech': '#f97316',
    'Other': '#64748b',
};

function sectorColor(sector) {
    for (const [key, col] of Object.entries(SECTOR_COLORS)) {
        if (sector?.toLowerCase().includes(key.toLowerCase())) return col;
    }
    return '#64748b';
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

/* ── Galaxy Canvas (X=Funding, Y=Trust, Z=Survival→opacity+glow) ─────────── */
function GalaxyCanvas({ points, width, height }) {
    const canvasRef = useRef();
    const offsetRef = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    const tooltipRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);

    useEffect(() => {
        if (!points.length) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const maxFund = Math.max(...points.map(p => p.x), 1);
        const padding = 60;
        const W = canvas.width - padding * 2;
        const H = canvas.height - padding * 2;

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Deep space background
            const bgGrad = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width * 0.7
            );
            bgGrad.addColorStop(0, '#0d1526');
            bgGrad.addColorStop(1, '#060d1a');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const ox = offsetRef.current.x;
            const oy = offsetRef.current.y;
            const sc = scaleRef.current;

            // Grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.035)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= 10; i++) {
                const gx = padding + (W / 10) * i;
                const gy = padding + (H / 10) * i;
                ctx.beginPath(); ctx.moveTo(gx, padding); ctx.lineTo(gx, padding + H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(padding, gy); ctx.lineTo(padding + W, gy); ctx.stroke();
            }

            // Axis labels
            ctx.fillStyle = 'rgba(148,163,184,0.75)';
            ctx.font = '11px Inter, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('← Total Funding ($M) →', canvas.width / 2, canvas.height - 8);
            ctx.save();
            ctx.translate(13, canvas.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('← AI Trust Score →', 0, 0);
            ctx.restore();

            // Z-axis legend (top-right)
            ctx.textAlign = 'right';
            ctx.font = '9px Inter, monospace';
            ctx.fillStyle = 'rgba(148,163,184,0.6)';
            ctx.fillText('Opacity = 5-yr Survival', canvas.width - 8, 20);
            ctx.fillText('Size = Valuation', canvas.width - 8, 32);

            // Points — sorted so high-survival (bright) renders on top
            const sorted = [...points].sort((a, b) => (a.z || 0) - (b.z || 0));

            sorted.forEach(p => {
                const cx = padding + ((p.x / maxFund) * W * sc + ox);
                const cy = padding + H - (p.y * H * sc + oy * H);
                const r = Math.max(1.5, (p.size || 5) * 0.55);

                if (cx < padding - r - 10 || cx > padding + W + r + 10) return;
                if (cy < padding - r - 10 || cy > padding + H + r + 10) return;

                const col = sectorColor(p.sector);
                const { r: cr, g: cg, b: cb } = hexToRgb(col);
                // Z (survival 0–1) → opacity range 0.18 to 1.0
                const alpha = 0.18 + (p.z || 0.5) * 0.82;

                // Glow for high-survival points
                if (p.z > 0.7 && r > 2) {
                    ctx.shadowColor = col;
                    ctx.shadowBlur = 8 * (p.z - 0.7) / 0.3;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, alpha + 0.3)})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            ctx.textAlign = 'left';
        }

        draw();
        canvas.style.cursor = 'grab';

        // Drag to pan
        const onDown = (e) => {
            dragging.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        };
        const onMove = (e) => {
            if (!dragging.current) return;
            const dx = (e.clientX - lastPos.current.x) / (width * scaleRef.current) * maxFund / 100;
            const dy = (e.clientY - lastPos.current.y) / height;
            offsetRef.current.x += (e.clientX - lastPos.current.x) * scaleRef.current * 0.01;
            offsetRef.current.y += (e.clientY - lastPos.current.y) * 0.005;
            lastPos.current = { x: e.clientX, y: e.clientY };
            draw();
        };
        const onUp = () => { dragging.current = false; canvas.style.cursor = 'grab'; };
        const onWheel = (e) => {
            e.preventDefault();
            scaleRef.current = Math.max(0.4, Math.min(5, scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.9)));
            draw();
        };

        // Hover tooltip
        const onMouseMove = (e) => {
            if (dragging.current) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const ox = offsetRef.current.x;
            const oy = offsetRef.current.y;
            const sc = scaleRef.current;

            let found = null;
            let minDist = 12;
            for (const p of points) {
                const cx = padding + ((p.x / maxFund) * W * sc + ox);
                const cy = padding + H - (p.y * H * sc + oy * H);
                const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
                if (dist < minDist) { minDist = dist; found = { ...p, cx, cy }; }
            }
            if (found) {
                setTooltip({
                    name: found.name,
                    sector: found.sector,
                    funding: found.x,
                    trust: found.y,
                    survival: found.z,
                    velocity: found.velocity,
                    x: e.clientX - rect.left + 14,
                    y: e.clientY - rect.top - 10,
                });
            } else {
                setTooltip(null);
            }
        };

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', () => setTooltip(null));

        return () => {
            canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mousemove', onMouseMove);
        };
    }, [points]);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 8, display: 'block' }} />
            {tooltip && (
                <div style={{
                    position: 'absolute',
                    left: tooltip.x, top: tooltip.y,
                    background: 'rgba(15,23,42,0.95)',
                    border: `1px solid ${sectorColor(tooltip.sector)}55`,
                    borderRadius: 8, padding: '0.55rem 0.85rem',
                    fontSize: '0.72rem', pointerEvents: 'none',
                    zIndex: 10, minWidth: 170,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 8px ${sectorColor(tooltip.sector)}33`,
                }}>
                    <div style={{ fontWeight: 800, color: sectorColor(tooltip.sector), marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                        {tooltip.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                        <span style={{ color: '#3b82f6' }}>■</span> Funding: <strong style={{ color: 'var(--text-primary)' }}>${tooltip.funding?.toFixed(1)}M</strong><br />
                        <span style={{ color: '#10b981' }}>■</span> Trust: <strong style={{ color: 'var(--text-primary)' }}>{(tooltip.trust * 100).toFixed(1)}%</strong><br />
                        <span style={{ color: '#f59e0b' }}>■</span> Survival: <strong style={{ color: tooltip.survival > 0.6 ? '#10b981' : tooltip.survival > 0.4 ? '#f59e0b' : '#ef4444' }}>{(tooltip.survival * 100).toFixed(1)}%</strong><br />
                        <span style={{ color: '#8b5cf6' }}>■</span> Sector: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.sector}</strong>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── CSS TreeMap ─────────────────────────────────────────────────────────────── */
function TreeMap({ sectors, onSelect, selected }) {
    const total = sectors.reduce((s, x) => s + x.count, 0);
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%', height: 240 }}>
            {sectors.slice(0, 16).map(s => {
                const pct = (s.count / total) * 100;
                const col = sectorColor(s.sector);
                const isSelected = selected?.sector === s.sector;
                return (
                    <div
                        key={s.sector}
                        onClick={() => onSelect(isSelected ? null : s)}
                        style={{
                            flexGrow: pct,
                            flexBasis: `${Math.max(5, pct * 2)}%`,
                            minWidth: 40,
                            background: col + (isSelected ? 'dd' : '22'),
                            border: `1px solid ${col}${isSelected ? '' : '44'}`,
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.3rem',
                            transition: 'all 0.15s',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ fontSize: `${Math.max(0.55, Math.min(0.9, pct / 8))}rem`, fontWeight: 700, color: isSelected ? '#fff' : col, textAlign: 'center', lineHeight: 1.2 }}>
                            {s.sector}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', marginTop: '0.1rem' }}>
                            {s.count.toLocaleString()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function SectorHeatmap({ onNav }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [view, setView] = useState('galaxy');   // 'galaxy' | 'treemap' | 'table'
    const [survivalFilter, setSurvivalFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'low'

    useEffect(() => {
        fetch(`${API}/api/heatmap`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError('API not reachable — start chatbot_api.py on port 5500'); setLoading(false); });
    }, []);

    const sectors = data?.sector_summary || [];
    const allPoints = data?.sample || [];

    const filtered = allPoints.filter(p => {
        if (selected && p.sector !== selected.sector) return false;
        if (survivalFilter === 'high' && (p.z || 0) < 0.6) return false;
        if (survivalFilter === 'medium' && ((p.z || 0) < 0.4 || (p.z || 0) > 0.7)) return false;
        if (survivalFilter === 'low' && (p.z || 0) >= 0.4) return false;
        return true;
    });

    const avgSurvival = filtered.length
        ? filtered.reduce((s, p) => s + (p.z || 0), 0) / filtered.length
        : 0;

    return (
        <div>
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">74K Startups</span>
                        <span className="badge badge-purple">Galaxy View</span>
                        <span className="badge badge-green">Z-Axis: Survival</span>
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Drag · Zoom · Hover</span>
                    </div>
                    <div className="page-title">🌌 Macro Market Heatmap</div>
                    <div className="page-sub">
                        Galaxy view of {data?.total_startups?.toLocaleString() || '74,577'} Indian startups.
                        <span style={{ color: '#3b82f6' }}> X</span>=Funding,
                        <span style={{ color: '#10b981' }}> Y</span>=Trust Score,
                        <span style={{ color: '#f59e0b' }}> Opacity</span>=5-yr Survival,
                        <span style={{ color: '#8b5cf6' }}> Color</span>=Sector
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {['galaxy', 'treemap', 'table'].map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className={`btn ${view === v ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ textTransform: 'capitalize' }}>
                            {v === 'galaxy' ? '🌌 Galaxy' : v === 'treemap' ? '🟦 TreeMap' : '📊 Table'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI strip */}
            <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: '1.25rem' }}>
                {[
                    { label: 'Total Startups', value: data?.total_startups?.toLocaleString() || '—', color: 'var(--blue)', sub: 'in knowledge graph' },
                    { label: 'Sectors', value: data?.sectors || '—', color: 'var(--purple)', sub: 'industry categories' },
                    { label: 'Plotted', value: filtered.length.toLocaleString(), color: 'var(--green)', sub: 'visible companies' },
                    { label: 'Avg Survival', value: `${(avgSurvival * 100).toFixed(1)}%`, color: avgSurvival > 0.6 ? 'var(--green)' : avgSurvival > 0.4 ? 'var(--amber)' : 'var(--red)', sub: 'Z-axis average' },
                    { label: 'Selected', value: selected ? selected.count.toLocaleString() : '—', color: 'var(--amber)', sub: selected ? selected.sector : 'click sector to filter' },
                ].map(m => (
                    <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{ color: m.color, fontSize: '1.35rem' }}>{m.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* Survival filter row */}
            {view === 'galaxy' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Z-axis filter:</span>
                    {[
                        { key: 'all', label: 'All Survival', color: 'var(--text-muted)' },
                        { key: 'high', label: '🟢 High (≥60%)', color: '#10b981' },
                        { key: 'medium', label: '🟡 Medium (40–70%)', color: '#f59e0b' },
                        { key: 'low', label: '🔴 At-Risk (<40%)', color: '#ef4444' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setSurvivalFilter(f.key)} style={{
                            padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.72rem',
                            background: survivalFilter === f.key ? `${f.color}22` : 'rgba(255,255,255,0.04)',
                            color: survivalFilter === f.key ? f.color : 'var(--text-muted)',
                            fontWeight: survivalFilter === f.key ? 700 : 400,
                        }}>
                            {f.label}
                        </button>
                    ))}
                    {selected && (
                        <button onClick={() => setSelected(null)} style={{
                            marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)',
                            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                            padding: '0.2rem 0.6rem', cursor: 'pointer',
                        }}>
                            ✕ Clear: {selected.sector}
                        </button>
                    )}
                </div>
            )}

            {loading && (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '2rem', animation: 'float 2s ease-in-out infinite' }}>🌌</div>
                    Loading startup galaxy…
                </div>
            )}
            {error && (
                <div style={{ padding: '1.25rem', color: 'var(--red)', fontSize: '0.82rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                    ❌ {error}
                </div>
            )}

            {data && (
                <>
                    {/* ── Galaxy View ─────────────────────────────── */}
                    {view === 'galaxy' && (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>🌌 Startup Galaxy — {filtered.length.toLocaleString()} companies</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Drag to pan · Scroll to zoom · Hover for details · Bright = High Survival
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <GalaxyCanvas points={filtered} width={Math.max(860, window.innerWidth - 120)} height={490} />
                            </div>
                            {/* Z-axis opacity scale legend */}
                            <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Opacity = 5-yr Survival →</div>
                                {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                                    <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: `rgba(16,185,129,${0.18 + v * 0.82})`, flexShrink: 0, display: 'inline-block', boxShadow: v > 0.6 ? `0 0 6px rgba(16,185,129,${v})` : 'none' }} />
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(v * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                                <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {sectors.slice(0, 10).map(s => (
                                        <div key={s.sector} onClick={() => setSelected(selected?.sector === s.sector ? null : s)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer',
                                                padding: '0.2rem 0.5rem', borderRadius: 4,
                                                background: selected?.sector === s.sector ? sectorColor(s.sector) + '22' : 'transparent',
                                                border: `1px solid ${sectorColor(s.sector)}44`,
                                            }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sectorColor(s.sector), flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.sector}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TreeMap View ─────────────────────────────── */}
                    {view === 'treemap' && (
                        <div className="card">
                            <div className="card-title">🟦 Sector TreeMap — Size = Company Count</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Click a sector to filter the galaxy view.
                            </div>
                            <TreeMap sectors={sectors} onSelect={setSelected} selected={selected} />
                            {selected && (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: `${sectorColor(selected.sector)}11`, border: `1px solid ${sectorColor(selected.sector)}33`, borderRadius: 8 }}>
                                    <div style={{ fontWeight: 700, color: sectorColor(selected.sector), marginBottom: '0.5rem' }}>{selected.sector}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
                                        {[
                                            { label: 'Companies', v: selected.count.toLocaleString() },
                                            { label: 'Avg Trust', v: (selected.avg_trust * 100).toFixed(1) + '%' },
                                            { label: 'Avg Survival (Z)', v: (selected.avg_survival * 100).toFixed(1) + '%' },
                                            { label: 'Avg Funding', v: selected.avg_funding_usd >= 1e6 ? `$${(selected.avg_funding_usd / 1e6).toFixed(1)}M` : `$${(selected.avg_funding_usd / 1e3).toFixed(0)}K` },
                                            { label: 'Total Funding', v: `$${(selected.total_funding_usd / 1e9).toFixed(2)}B` },
                                            { label: 'Avg Valuation', v: selected.avg_valuation >= 1e6 ? `$${(selected.avg_valuation / 1e6).toFixed(1)}M` : 'N/A' },
                                        ].map(m => (
                                            <div key={m.label}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.label}</div>
                                                <div style={{ fontWeight: 700, color: sectorColor(selected.sector), fontSize: '0.88rem' }}>{m.v}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Table View ─────────────────────────────── */}
                    {view === 'table' && (
                        <div className="card" style={{ padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            {['#', 'Sector', 'Companies', 'Avg Trust (Y)', 'Avg Survival (Z)', 'Total Funding (X)', 'Avg Valuation'].map(h => (
                                                <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sectors.map((s, i) => (
                                            <tr key={s.sector} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                <td style={{ padding: '0.65rem 1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sectorColor(s.sector), flexShrink: 0 }} />
                                                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: sectorColor(s.sector) }}>{s.sector}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.count.toLocaleString()}</td>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: s.avg_trust > 0.6 ? 'var(--green)' : s.avg_trust > 0.4 ? 'var(--amber)' : 'var(--red)' }}>
                                                    {(s.avg_trust * 100).toFixed(1)}%
                                                </td>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${s.avg_survival * 100}%`, background: s.avg_survival > 0.6 ? 'var(--green)' : s.avg_survival > 0.4 ? 'var(--amber)' : 'var(--red)', borderRadius: 3 }} />
                                                        </div>
                                                        <span style={{ color: s.avg_survival > 0.6 ? 'var(--green)' : s.avg_survival > 0.4 ? 'var(--amber)' : 'var(--red)' }}>
                                                            {(s.avg_survival * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>${(s.total_funding_usd / 1e9).toFixed(2)}B</td>
                                                <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.avg_valuation >= 1e6 ? `$${(s.avg_valuation / 1e6).toFixed(1)}M` : 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
