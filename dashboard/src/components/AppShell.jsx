import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLES } from '../context/AuthContext';
import CommandPalette from './shared/CommandPalette';
import LensToggle from './shared/LensToggle';

const API = 'http://localhost:5500';

// ── Investor Journey step labels per page ─────────────────────────────────────
const JOURNEY_STEP = {
    home: null,
    company: { step: 1, label: '🔍 Discover', color: '#a78bfa' },
    valuation: { step: 1, label: '🔍 Discover', color: '#a78bfa' },
    intelligence: { step: 1, label: '🔍 Discover', color: '#a78bfa' },
    shap: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    risk: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    hype: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    models: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    scenario: { step: 3, label: '🎲 Simulate', color: '#34d399' },
    montecarlo: { step: 3, label: '🎲 Simulate', color: '#34d399' },
    backtest: { step: 3, label: '🎲 Simulate', color: '#34d399' },
    portfolio: { step: 3, label: '🎲 Simulate', color: '#34d399' },
    oracle: { step: 4, label: '⛓️ Execute', color: '#fb923c' },
    escrow: { step: 4, label: '⛓️ Execute', color: '#fb923c' },
    kyc: { step: 4, label: '⛓️ Execute', color: '#fb923c' },
    committee: { step: 4, label: '⛓️ Execute', color: '#fb923c' },
    agent: { step: 4, label: '⛓️ Execute', color: '#fb923c' },
    memo: { step: 5, label: '📄 Report', color: '#f472b6' },
    sentiment: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    network: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
    heatmap: { step: 2, label: '📊 Analyse', color: '#38bdf8' },
};

// ── Navigation Structure ──────────────────────────────────────────────────────
const NAV = [
    {
        id: 'home', label: 'Dashboard', icon: '⚡', path: '/home',
        single: true,
    },
    {
        id: 'ai', label: 'AI Models', icon: '🧠',
        items: [
            { id: 'valuation', label: 'Stacked Valuation', icon: '🧠', desc: 'XGB + LGB + CatBoost + MLP (R²=0.9738)', badge: 'R²0.97' },
            { id: 'shap', label: 'SHAP Explainer', icon: '📊', desc: 'Real TreeSHAP · 37,699 narratives', badge: 'XAI' },
            { id: 'hype', label: 'Hype Detector', icon: '🚨', desc: 'IsolationForest · 50 anomalies flagged', badge: 'IF' },
            { id: 'models', label: 'Model Hub', icon: '🏆', desc: 'AutoGluon leaderboard · Survival · NLP', badge: 'NEW' },
            { id: 'risk', label: 'Risk Auditor', icon: '🔍', desc: 'Multi-factor risk scoring & signals' },
            { id: 'sentiment', label: 'Sentiment OSINT', icon: '📡', desc: 'FinBERT NLP on 5K news headlines' },
        ],
    },
    {
        id: 'finance', label: 'Finance', icon: '📈',
        items: [
            { id: 'portfolio', label: 'BL Portfolio', icon: '💼', desc: 'Black-Litterman allocation (Sharpe 0.94)', badge: 'S:0.94' },
            { id: 'monitor', label: 'Portfolio Monitor', icon: '📡', desc: 'Live alerts: trust · hype · survival · FinBERT news', badge: 'LIVE' },
            { id: 'montecarlo', label: 'Monte Carlo + VaR', icon: '🎲', desc: '10K Cholesky GBM paths × 6 sectors', badge: '10K' },
            { id: 'backtest', label: 'Backtest Engine', icon: '📈', desc: '2018 cohort vs Nifty 50 benchmark' },
            { id: 'agent', label: 'Autonomous Agent', icon: '🤖', desc: 'AI-powered investment decision agent', badge: 'AI' },
            { id: 'committee', label: 'Investment Committee', icon: '🏛️', desc: 'Quant · Auditor · Newsroom · Manager — MAS orchestrator', badge: 'MAS' },
        ],
    },
    {
        id: 'research', label: 'Research', icon: '🔬',
        items: [
            { id: 'company', label: 'Company Profile', icon: '🏢', desc: 'Full deep-dive: Valuation · SHAP · Survival · Oracle · Scenario', badge: 'NEW' },
            { id: 'intelligence', label: 'Company Intelligence', icon: '🔬', desc: 'Deep-dive OSINT per startup' },
            { id: 'network', label: 'Investor Network', icon: '🕸️', desc: 'Force-directed graph · 4,547 nodes · Drag & Zoom', badge: '3D' },
            { id: 'heatmap', label: 'Galaxy Heatmap', icon: '🌌', desc: 'X=Funding · Y=Trust · Opacity=Survival · 74K pts', badge: 'Z-AXIS' },
            { id: 'terminal', label: 'News Terminal', icon: '📰', desc: 'Live FinBERT headlines feed' },
            { id: 'scenario', label: 'Digital Twin', icon: '🔬', desc: 'Scenario Analysis · What-if sliders · Trust + Survival', badge: 'NEW' },
            { id: 'datalake', label: 'Data Lake', icon: '🗄️', desc: '74K startups · 37K real · 10 Kaggle sources', badge: '74K' },
        ],
    },
    {
        id: 'blockchain', label: 'Blockchain', icon: '⛓️',
        items: [
            { id: 'escrow', label: 'Milestone Escrow', icon: '🔐', desc: 'ERC-20 tranche-release smart contracts' },
            { id: 'oracle', label: 'Oracle Bridge', icon: '⛓️', desc: 'Chainlink-style on-chain data feed' },
            { id: 'kyc', label: 'KYC / Identity', icon: '🪪', desc: 'DID-based accreditation verification' },
        ],
    },
    {
        id: 'system', label: 'System', icon: '⚙️',
        items: [
            { id: 'architecture', label: 'Architecture', icon: '🏗️', desc: 'Full-stack system design overview' },
            { id: 'roadmap', label: 'Roadmap', icon: '🗺️', desc: 'Phase progress & milestones' },
            { id: 'profile', label: 'My Profile', icon: '👤', desc: 'Account, KYC tier, wallet' },
        ],
    },
    // Admin-only group (shown only when role=ADMIN)
    {
        id: 'command', label: 'Command', icon: '👑', adminOnly: true,
        items: [
            { id: 'admin',            label: 'Command Center',  icon: '👑', desc: 'System overview, real-time metrics', badge: 'ADMIN' },
            { id: 'admin-users',      label: 'User Management', icon: '👥', desc: 'All users, KYC tiers, wallet addresses', badge: 'ADMIN' },
            { id: 'admin-monitor',    label: 'Model Monitor',   icon: '📊', desc: 'R², RMSE, MAE, drift alerts', badge: 'ADMIN' },
            { id: 'admin-contracts',  label: 'Contract Console',icon: '⛓️', desc: 'Live Sepolia ABI browser + terminal', badge: 'ADMIN' },
        ],
    },
];

// Flat lookup for breadcrumbs & active detection
const ALL_PAGES = {};
NAV.forEach(n => {
    if (n.single) { ALL_PAGES[n.id] = { label: n.label, group: n.label }; return; }
    (n.items || []).forEach(i => { ALL_PAGES[i.id] = { label: i.label, group: n.label }; });
});
// Also register new page IDs not in NAV
['dashboard','discover','my-portfolio','onboarding','admin-users','admin-monitor','admin-contracts'].forEach(id => {
    const labels = { dashboard: 'Dashboard', discover: 'Discover', 'my-portfolio': 'My Portfolio', onboarding: 'Onboarding', 'admin-users': 'User Management', 'admin-monitor': 'Model Monitor', 'admin-contracts': 'Contract Console' };
    ALL_PAGES[id] = { label: labels[id] || id, group: id.startsWith('admin') ? 'Command' : 'User App' };
});

// ── Mega-Menu Dropdown ────────────────────────────────────────────────────────
function MegaMenu({ group, onNav, onClose }) {
    if (!group || !group.items) return null;
    return (
        <div className="mega-menu">
            <div className="mega-menu-bridge" />
            <div className="mega-menu-inner">
                {group.items.map(item => (
                    <button
                        key={item.id}
                        className="mega-menu-item"
                        onMouseDown={(e) => { e.preventDefault(); onNav(item.id); onClose(); }}
                    >
                        <span className="mega-menu-icon">{item.icon}</span>
                        <div className="mega-menu-text">
                            <div className="mega-menu-label">
                                {item.label}
                                {item.badge && <span className="mega-badge">{item.badge}</span>}
                            </div>
                            <div className="mega-menu-desc">{item.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Global Bloomberg Intelligence Marquee ─────────────────────────────────────
function SentimentMarquee({ onNav }) {
    const [headlines, setHeadlines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [overallLabel, setOverallLabel] = useState('neutral');
    const [overallScore, setOverallScore] = useState(0);
    const [lastFetch, setLastFetch] = useState(null);
    const [apiOnline, setApiOnline] = useState(false);
    const trackRef = useRef();
    const posRef = useRef(0);
    const rafRef = useRef();
    const pausedRef = useRef(false);
    const POLL_MS = 30_000;

    const fetchFeed = useCallback(async () => {
        try {
            const r = await fetch(`${API}/api/newsfeed`);
            const d = await r.json();
            setHeadlines(d.headlines || []);
            setAlerts(d.alerts || []);
            setOverallLabel(d.overall_label || 'neutral');
            setOverallScore(d.overall_score || 0);
            setLastFetch(new Date());
            setApiOnline(true);
        } catch {
            setApiOnline(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();
        const t = setInterval(fetchFeed, POLL_MS);
        return () => clearInterval(t);
    }, [fetchFeed]);

    // Smooth scroll animation
    useEffect(() => {
        if (!trackRef.current || !headlines.length) return;
        const el = trackRef.current;
        posRef.current = 0;

        const step = () => {
            if (!pausedRef.current) {
                posRef.current -= 0.55;
                const halfWidth = el.scrollWidth / 2;
                if (Math.abs(posRef.current) >= halfWidth) posRef.current = 0;
                el.style.transform = `translateX(${posRef.current}px)`;
            }
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [headlines]);

    const hasAlerts = alerts.length > 0;
    const alertFlash = hasAlerts;

    const overallCol = overallLabel === 'bullish' ? '#10b981' : overallLabel === 'bearish' ? '#ef4444' : '#94a3b8';
    const overallIcon = overallLabel === 'bullish' ? '🐂' : overallLabel === 'bearish' ? '🐻' : '⚖️';

    // Doubled for seamless loop
    const doubled = [...headlines, ...headlines];

    return (
        <div
            style={{
                height: 36,
                overflow: 'hidden',
                background: alertFlash
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(15,23,42,0.9)',
                borderBottom: `1px solid ${alertFlash ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.5s ease, border-color 0.5s ease',
                cursor: 'pointer',
                flexShrink: 0,
            }}
            onClick={() => onNav('terminal')}
            title="Click to open Intelligence Terminal"
        >
            {/* LIVE pill */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0 0.85rem',
                borderRight: `1px solid ${alertFlash ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                height: '100%', flexShrink: 0,
                background: alertFlash ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
            }}>
                <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: alertFlash ? '#ef4444' : '#10b981',
                    boxShadow: `0 0 6px ${alertFlash ? '#ef4444' : '#10b981'}`,
                    animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: alertFlash ? '#ef4444' : '#10b981', whiteSpace: 'nowrap' }}>
                    {alertFlash ? `⚠ ${alerts.length} ALERT${alerts.length > 1 ? 'S' : ''}` : '● LIVE'}
                </span>
            </div>

            {/* FinBERT label */}
            <div style={{
                padding: '0 0.75rem',
                fontSize: '0.62rem', color: 'rgba(148,163,184,0.7)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                whiteSpace: 'nowrap', flexShrink: 0,
                height: '100%', display: 'flex', alignItems: 'center',
            }}>
                FinBERT
            </div>

            {/* Scrolling ticker */}
            <div
                style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => { pausedRef.current = true; }}
                onMouseLeave={() => { pausedRef.current = false; }}
            >
                {headlines.length === 0 ? (
                    <span style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.5)', padding: '0 1rem' }}>
                        {apiOnline ? 'Loading news feed…' : 'API offline — start chatbot_api.py on port 5500'}
                    </span>
                ) : (
                    <div
                        ref={trackRef}
                        style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', willChange: 'transform' }}
                    >
                        {doubled.map((h, i) => {
                            const isAlert = h.portfolio_alert;
                            const isPos = h.label === 'positive';
                            const isNeg = h.label === 'negative';
                            const col = isAlert ? '#ef4444' : isPos ? '#10b981' : isNeg ? '#ef4444' : '#94a3b8';
                            const text = h.headline?.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#038;/g, '&');
                            return (
                                <span
                                    key={i}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0 1.5rem',
                                        borderRight: '1px solid rgba(255,255,255,0.05)',
                                        fontSize: '0.72rem',
                                    }}
                                >
                                    {isAlert && (
                                        <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.04em' }}>⚠ ALERT</span>
                                    )}
                                    <span style={{ color: 'rgba(148,163,184,0.55)', fontSize: '0.62rem' }}>{h.source}</span>
                                    <span style={{ color: col }}>{text?.slice(0, 90)}{text?.length > 90 ? '…' : ''}</span>
                                    <span style={{
                                        background: col + '22', color: col, padding: '0.05rem 0.35rem',
                                        borderRadius: 3, fontSize: '0.58rem', fontWeight: 700,
                                    }}>
                                        {isPos ? '▲' : isNeg ? '▼' : '—'} {h.label?.toUpperCase()}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Overall sentiment + score — right side */}
            <div style={{
                padding: '0 0.85rem',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
                <span style={{ fontSize: '0.9rem' }}>{overallIcon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span style={{ fontSize: '0.6rem', color: overallCol, fontWeight: 800 }}>{overallLabel.toUpperCase()}</span>
                    <span style={{ fontSize: '0.58rem', color: 'rgba(148,163,184,0.55)', fontFamily: 'monospace' }}>
                        {overallScore > 0 ? '+' : ''}{overallScore?.toFixed(4) || '—'}
                    </span>
                </div>
            </div>

            {/* Last refresh time */}
            {lastFetch && (
                <div style={{
                    padding: '0 0.7rem',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center',
                    fontSize: '0.58rem', color: 'rgba(148,163,184,0.4)',
                }}>
                    {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
}

// ── Top Navigation Bar ────────────────────────────────────────────────────────
export function TopNav({ activePage, onNav }) {
    const [openMenu, setOpenMenu] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifs, setNotifs] = useState([]);
    const [unread, setUnread] = useState(0);
    const [apiOnline, setApiOnline] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const navRef = useRef(null);
    const isAdmin = user?.role === 'ADMIN';
    const [lensMode, setLensMode] = useState('admin'); // admin sees admin by default

    useEffect(() => {
        const checkStatus = () => {
            fetch('http://localhost:5500/api/status')
                .then(r => r.json())
                .then(d => { setApiOnline(d.status === 'ready'); })
                .catch(() => setApiOnline(false));
        };
        const fetchNotifs = () => {
            fetch('http://localhost:5500/api/notifications')
                .then(r => r.json())
                .then(d => { setNotifs(d.notifications || []); setUnread(d.unread || 0); })
                .catch(() => { });
        };
        // Run immediately
        checkStatus();
        fetchNotifs();
        // Then poll every 10 seconds so it picks up the API coming online
        const statusTimer = setInterval(checkStatus, 10_000);
        return () => clearInterval(statusTimer);
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (!navRef.current?.contains(e.target)) {
                setOpenMenu(null); setNotifOpen(false); setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNav = (id) => { onNav(id); navigate(`/${id}`); setMobileOpen(false); setOpenMenu(null); };
    const toggleMenu = (id) => setOpenMenu(prev => prev === id ? null : id);

    return (
        <header className="top-nav" ref={navRef}>
            {/* Logo */}
            <div className="top-nav-logo" onClick={() => handleNav('home')}>
                <img src="/logo.svg" alt="IntelliStake" className="nav-logo-img" />
                <div className="nav-logo-text">
                    <span className="nav-logo-name">IntelliStake</span>
                    <span className="nav-logo-tag">v3 · AI · Finance · Blockchain</span>
                </div>
            </div>

            {/* Primary Nav Links */}
            <nav className="top-nav-links">
                {NAV.filter(g => !g.adminOnly || isAdmin).map(group => (
                    group.single ? (
                        <button
                            key={group.id}
                            className={`top-nav-link${activePage === group.id ? ' active' : ''}`}
                            onClick={() => handleNav(group.id)}
                        >
                            {group.icon} {group.label}
                        </button>
                    ) : (
                        <div
                            key={group.id}
                            className={`top-nav-group${openMenu === group.id ? ' menu-open' : ''}`}
                        >
                            <button
                                className={`top-nav-link${group.items?.some(i => i.id === activePage) ? ' active' : ''}`}
                                onClick={() => toggleMenu(group.id)}
                            >
                                {group.icon} {group.label}
                                <span className="nav-chevron">▾</span>
                            </button>
                            {openMenu === group.id && (
                                <MegaMenu
                                    group={group}
                                    onNav={handleNav}
                                    onClose={() => setOpenMenu(null)}
                                />
                            )}
                        </div>
                    )
                ))}
            </nav>

            {/* Right side actions */}
            <div className="top-nav-actions">
                {/* LensToggle — admin only */}
                {isAdmin && (
                    <LensToggle mode={lensMode} onChange={setLensMode} />
                )}

                {/* ⌘K search */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-cmd-palette'))}
                    title="Command Palette (Cmd+K)"
                    style={{
                        padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                >
                    <span>🔍</span>
                    <kbd style={{ fontSize: 9, color: '#334155', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>⌘K</kbd>
                </button>

                {/* API Status */}
                <div className={`api-status-pill${apiOnline ? '' : ' api-offline'}`}>
                    <span className="status-dot" />
                    <span>{apiOnline ? 'API Live' : 'API Offline'}</span>
                </div>

                {/* KYC badge */}
                <span className={`badge ${user?.kyc === 'INSTITUTIONAL' ? 'badge-amber' : user?.kyc === 'ACCREDITED' ? 'badge-purple' : 'badge-blue'}`}>
                    {user?.kyc || 'RETAIL'}
                </span>

                {/* Notifications */}
                <div style={{ position: 'relative' }}>
                    <button className="nav-icon-btn" onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}>
                        🔔
                        {unread > 0 && <span className="notif-badge">{unread}</span>}
                    </button>
                    {notifOpen && (
                        <div className="nav-dropdown" style={{ width: 300, right: 0 }}>
                            <div className="nav-dropdown-header">
                                <span>Notifications</span>
                                {unread > 0 && <span className="badge badge-red">{unread} new</span>}
                            </div>
                            {notifs.length === 0
                                ? <div className="nav-dropdown-empty">No notifications</div>
                                : notifs.map((n, i) => (
                                    <div key={i} className={`nav-dropdown-item${n.severity === 'high' ? ' high' : ''}`}>
                                        <span>{n.icon}</span>
                                        <div>
                                            <div className="notif-title">{n.title}</div>
                                            <div className="notif-body">{n.body}</div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* Profile */}
                <div style={{ position: 'relative' }}>
                    <button className="nav-avatar" onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}>
                        <span>{user?.avatar || '👤'}</span>
                    </button>
                    {profileOpen && (
                        <div className="nav-dropdown" style={{ width: 220, right: 0 }}>
                            <div className="nav-dropdown-header">
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{user?.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.64rem', color: 'var(--green)', marginTop: '0.3rem' }}>
                                        {user?.wallet?.slice(0, 18)}…
                                    </div>
                                </div>
                            </div>
                            {[
                                { icon: '👤', label: 'My Profile', action: () => { handleNav('profile'); setProfileOpen(false); } },
                                { icon: '🗺️', label: 'Roadmap', action: () => { handleNav('roadmap'); setProfileOpen(false); } },
                            ].map(item => (
                                <button key={item.label} className="nav-dropdown-btn" onClick={item.action}>
                                    {item.icon} {item.label}
                                </button>
                            ))}
                            <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }} onClick={logout}>
                                    🚪 Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button className="nav-hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
                    {mobileOpen ? '✕' : '☰'}
                </button>
            </div>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="mobile-nav">
                    {NAV.map(group => (
                        <div key={group.id} className="mobile-nav-group">
                            <div className="mobile-nav-label">{group.icon} {group.label}</div>
                            {group.single
                                ? <button className="mobile-nav-item" onClick={() => handleNav(group.id)}>{group.label}</button>
                                : (group.items || []).map(item => (
                                    <button key={item.id} className="mobile-nav-item" onClick={() => handleNav(item.id)}>
                                        {item.icon} {item.label}
                                    </button>
                                ))
                            }
                        </div>
                    ))}
                </div>
            )}
        </header>
    );
}

// ── Page Sub-header (Breadcrumb + Title) ──────────────────────────────────────
export function PageHeader({ activePage }) {
    const page = ALL_PAGES[activePage] || { label: 'Dashboard', group: 'Overview' };
    return (
        <div className="page-header-bar">
            <div className="page-breadcrumb">
                <span>IntelliStake</span>
                <span className="bc-sep">›</span>
                <span>{page.group}</span>
                <span className="bc-sep">›</span>
                <span className="bc-current">{page.label}</span>
            </div>
            <h1 className="page-header-title">{page.label}</h1>
        </div>
    );
}

// ── Floating AI Copilot Chat Widget ──────────────────────────────────────────
const STARTER_PROMPTS = [
    'Should I invest in Zepto?',
    'What is Razorpay\'s trust score?',
    'Compare Meesho vs Flipkart',
    'Which startups are overvalued?',
    'Explain SHAP trust scores',
    'Top 5 startups by valuation',
    'What is the portfolio CAGR?',
    'Show hype anomalies',
];

function FloatingChatbot({ onNav }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([{
        role: 'ai',
        text: '👋 Hi! I\'m your IntelliStake AI Copilot.\n\nAsk me anything — startup valuations, risk analysis, portfolio performance, or whether to invest in a company.',
    }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages, open]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const send = async (q) => {
        const query = q || input.trim();
        if (!query || loading) return;
        setInput('');
        setMessages(p => [...p, { role: 'user', text: query }]);
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const d = await r.json();
            setMessages(p => [...p, { role: 'ai', text: d.answer || 'No response', sources: d.sources }]);
        } catch {
            setMessages(p => [...p, { role: 'ai', text: '⚠️ API offline – start chatbot_api.py on port 5500' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating bubble */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                    border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', transition: 'transform 0.2s',
                    animation: open ? 'none' : 'pulse-chat 2.5s infinite',
                }}
                title="Ask AI Copilot"
            >
                {open ? '✕' : '💬'}
            </button>

            {/* Chat panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: 92, right: 24, zIndex: 9998,
                    width: 380, height: 520,
                    background: 'rgba(10,14,26,0.97)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(24px)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'slideUp 0.2s ease',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
                        background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(59,130,246,0.1))',
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                    }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🤖</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#e2e8f0' }}>AI Investment Copilot</div>
                            <div style={{ fontSize: '0.65rem', color: '#10b981' }}>● Live · 74K startups · Real-time data</div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: m.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                                    background: m.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                }}>
                                    {m.text}
                                    {m.sources?.length > 0 && (
                                        <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                            {m.sources.map(s => <span key={s} style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', padding: '0.1rem 0.35rem', borderRadius: 4 }}>📎 {s}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🤖</div>
                                Thinking… ●●●
                            </div>
                        )}
                    </div>

                    {/* Starter prompts (show only at start) */}
                    {messages.length <= 1 && (
                        <div style={{ padding: '0 0.75rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {STARTER_PROMPTS.slice(0, 4).map(p => (
                                <button key={p} onClick={() => send(p)} style={{
                                    fontSize: '0.68rem', padding: '0.3rem 0.6rem', borderRadius: 20,
                                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                                    color: '#a5b4fc', cursor: 'pointer', whiteSpace: 'nowrap',
                                }}>{p}</button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div style={{ padding: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '0.4rem' }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder='Ask "Should I invest in Zepto?"'
                            disabled={loading}
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0',
                                fontSize: '0.82rem', outline: 'none',
                            }}
                        />
                        <button
                            onClick={() => send()}
                            disabled={loading || !input.trim()}
                            style={{
                                background: 'linear-gradient(135deg,#6366f1,#3b82f6)', border: 'none',
                                borderRadius: 8, padding: '0.5rem 0.9rem', color: 'white',
                                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                opacity: loading || !input.trim() ? 0.5 : 1, fontSize: '0.88rem', fontWeight: 700,
                            }}
                        >↑</button>
                    </div>
                </div>
            )}
        </>
    );
}

// ── AppShell ──────────────────────────────────────────────────────────────────
export default function AppShell({ page, onNav, children }) {
    const [cmdOpen, setCmdOpen] = useState(false);

    // Global Cmd+K / Ctrl+K handler
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
        };
        const customHandler = () => setCmdOpen(o => !o);
        document.addEventListener('keydown', handler);
        window.addEventListener('open-cmd-palette', customHandler);
        return () => { document.removeEventListener('keydown', handler); window.removeEventListener('open-cmd-palette', customHandler); };
    }, []);

    return (
        <div className="app-shell-v2">
            <TopNav activePage={page} onNav={onNav} />
            <SentimentMarquee onNav={onNav} />
            <main className="app-main-v2">
                <PageHeader activePage={page} />
                <div className="page-content-v2">
                    {children}
                </div>
            </main>
            {/* Floating AI Copilot — visible on every page */}
            <FloatingChatbot onNav={onNav} />
            {/* Cmd+K Command Palette */}
            <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
        </div>
    );
}
