import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Brain, TrendingUp, Shield, Link2, Network } from 'lucide-react';
import { useState } from 'react';
import './Navigation.css';

function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/phase1', label: 'AI Valuation', icon: Brain },
        { path: '/phase2-finance', label: 'Portfolio', icon: TrendingUp },
        { path: '/phase2-blockchain', label: 'Blockchain', icon: Shield },
        { path: '/phase2-oracle', label: 'Oracle', icon: Link2 },
        { path: '/architecture', label: 'Architecture', icon: Network },
    ];

    return (
        <nav className="navbar">
            <div className="container nav-container">
                <Link to="/" className="nav-logo">
                    <span className="logo-text">IntelliStake</span>
                    <span className="logo-badge">v2.0</span>
                </Link>

                <button className="nav-toggle" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                <ul className={`nav-menu ${isOpen ? 'active' : ''}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}

export default Navigation;
