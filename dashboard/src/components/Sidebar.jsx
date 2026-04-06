import { useState } from 'react';

const NAV = [
    {
        section: 'Overview',
        items: [
            { id: 'home', label: 'Command Center', icon: '⚡' },
            { id: 'datalake', label: 'Data Lake', icon: '🗄️' },
        ]
    },
    {
        section: 'AI Domain',
        items: [
            { id: 'valuation', label: 'Stacked Valuation', icon: '🧠' },
            { id: 'risk', label: 'Risk Auditor', icon: '🔍' },
            { id: 'sentiment', label: 'Sentiment OSINT', icon: '📡' },
            { id: 'shap', label: 'SHAP Explainer', icon: '📊' },
            { id: 'hype', label: 'Hype Detector', icon: '🚨' },
        ]
    },
    {
        section: 'Finance Domain',
        items: [
            { id: 'portfolio', label: 'BL Portfolio', icon: '💼' },
            { id: 'montecarlo', label: 'Monte Carlo + VaR', icon: '🎲' },
            { id: 'backtest', label: 'Backtest Engine', icon: '📈' },
        ]
    },
    {
        section: 'Blockchain',
        items: [
            { id: 'escrow', label: 'Milestone Escrow', icon: '🔐' },
            { id: 'oracle', label: 'Oracle Bridge', icon: '⛓️' },
            { id: 'kyc', label: 'KYC / Identity', icon: '🪪' },
        ]
    },
    {
        section: 'GenAI',
        items: [
            { id: 'chatbot', label: 'VC Auditor Chatbot', icon: '🤖' },
        ]
    },
    {
        section: 'System',
        items: [
            { id: 'architecture', label: 'Architecture', icon: '🏗️' },
            { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
        ]
    },
];

export default function Sidebar({ active, onNav }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-mark">IntelliStake</div>
                <div className="sidebar-logo-sub">AI · Finance · Blockchain · GenAI</div>
            </div>

            {NAV.map(({ section, items }) => (
                <div className="sidebar-section" key={section}>
                    <div className="sidebar-section-label">{section}</div>
                    {items.map(({ id, label, icon }) => (
                        <button
                            key={id}
                            className={`nav-item${active === id ? ' active' : ''}`}
                            onClick={() => onNav(id)}
                        >
                            <span style={{ fontSize: '1rem' }}>{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            ))}

            <div className="sidebar-status">
                <span className="status-dot" />
                <span className="status-text">Pipeline Active — v3.0 Institutional</span>
            </div>
        </aside>
    );
}
