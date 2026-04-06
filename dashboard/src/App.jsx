import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

// Layout
import AppShell from './components/AppShell';

// Auth & landing
import Landing from './pages/Landing';
import Login from './pages/Login';
import BootSequence from './pages/BootSequence';
import WarRoom from './pages/WarRoom';

// Pages — core set (cleaned)
import Home from './pages/Home';
import Profile from './pages/Profile';
import ValuationEngine from './pages/ValuationEngine';
import RiskAuditor from './pages/RiskAuditor';
import Portfolio from './pages/Portfolio';
import MonteCarlo from './pages/MonteCarlo';
import Escrow from './pages/Escrow';
import OracleBridge from './pages/OracleBridge';
import KYC from './pages/KYC';
import Sentiment from './pages/Sentiment';
import DataLake from './pages/DataLake';
import Architecture from './pages/Architecture';
import Roadmap from './pages/Roadmap';
import ShapExplainer from './pages/ShapExplainer';
import Backtest from './pages/Backtest';
import HypeDetector from './pages/HypeDetector';
import RagChatbot from './pages/RagChatbot';
import CompanyIntelligence from './pages/CompanyIntelligence';
import ModelHub from './pages/ModelHub';
import InvestorNetwork from './pages/InvestorNetwork';
import PortfolioMonitor from './pages/PortfolioMonitor';
import MemoGenerator from './pages/MemoGenerator';
import SectorHeatmap from './pages/SectorHeatmap';
import NewsTerminal from './pages/NewsTerminal';
import CompanyProfile from './pages/CompanyProfile';
import InvestmentCommittee from './pages/InvestmentCommittee';
import ScenarioAnalysis from './pages/ScenarioAnalysis';
import InvestmentAgent from './pages/InvestmentAgent';

// Phase 2 — User App pages
import UserDashboard from './pages/UserDashboard';
import DiscoverPage from './pages/DiscoverPage';
import OnboardingWizard from './pages/OnboardingWizard';
import PortfolioUserView from './pages/PortfolioUserView';

// Phase 3 — Admin Console
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import ModelMonitorPage from './pages/ModelMonitorPage';
import ContractConsolePage from './pages/ContractConsolePage';


// Route → Page component map (28 core pages)
const PAGE_ROUTES = [
  { path: '/home', Component: Home },
  { path: '/profile', Component: Profile },
  { path: '/datalake', Component: DataLake },
  { path: '/valuation', Component: ValuationEngine },
  { path: '/risk', Component: RiskAuditor },
  { path: '/sentiment', Component: Sentiment },
  { path: '/shap', Component: ShapExplainer },
  { path: '/hype', Component: HypeDetector },
  { path: '/portfolio', Component: Portfolio },
  { path: '/montecarlo', Component: MonteCarlo },
  { path: '/backtest', Component: Backtest },
  { path: '/escrow', Component: Escrow },
  { path: '/oracle', Component: OracleBridge },
  { path: '/kyc', Component: KYC },
  { path: '/company', Component: CompanyProfile },
  { path: '/chatbot', Component: RagChatbot },

  { path: '/intelligence', Component: CompanyIntelligence },
  { path: '/models', Component: ModelHub },
  { path: '/network', Component: InvestorNetwork },
  { path: '/monitor', Component: PortfolioMonitor },
  { path: '/architecture', Component: Architecture },
  { path: '/roadmap', Component: Roadmap },
  { path: '/memo', Component: MemoGenerator },
  { path: '/heatmap', Component: SectorHeatmap },
  { path: '/terminal', Component: NewsTerminal },
  { path: '/committee', Component: InvestmentCommittee },
  { path: '/scenario', Component: ScenarioAnalysis },
  { path: '/agent', Component: InvestmentAgent },

  // Phase 2 — User App
  { path: '/dashboard',          Component: UserDashboard    },
  { path: '/discover',           Component: DiscoverPage     },
  { path: '/my-portfolio',       Component: PortfolioUserView },

  // Phase 3 — Admin Console  
  { path: '/admin',              Component: AdminDashboard    },
  { path: '/admin-users',        Component: AdminUsersPage    },
  { path: '/admin-monitor',      Component: ModelMonitorPage  },
  { path: '/admin-contracts',    Component: ContractConsolePage },
];

// Standalone routes (outside AppShell — full screen)
const STANDALONE_ROUTES = [
  { path: '/onboarding', Component: OnboardingWizard },
];


// Converts sidebar page ID → URL path
export const pageToPath = (id) => `/${id}`;
export const pathToPage = (path) => path.replace('/', '') || 'home';

// ── Protected App Shell ──────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pathToPage(location.pathname);

  if (!user) return <Navigate to="/login" replace />;

  const handleNav = (pageId) => navigate(pageToPath(pageId));

  // Standalone full-screen routes (no AppShell chrome)
  const standaloneMatch = STANDALONE_ROUTES.find(r => location.pathname.startsWith(r.path));
  if (standaloneMatch) {
    return (
      <Routes>
        {STANDALONE_ROUTES.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component onNav={handleNav} />} />
        ))}
      </Routes>
    );
  }

  return (
    <AppShell page={currentPage} onNav={handleNav}>
      <Routes>
        {PAGE_ROUTES.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component onNav={handleNav} />} />
        ))}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/app" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AppShell>
  );
}

// ── Public Routes ─────────────────────────────────────────────────────────────
function PublicRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/boot" element={<BootSequence />} />
      <Route path="/warroom" element={<WarRoom />} />
      <Route path="/home" element={
        user
          ? <Navigate to="/home" replace />
          : <Navigate to="/" replace />
      } />
      <Route path="*" element={<AppRoutes />} />
    </Routes>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('IntelliStake ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'var(--bg-base)', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--red)' }}>Page Error</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 420, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred on this page.'}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false, error: null }); window.history.back(); }}
          >
            ← Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthLoader />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

function AuthLoader() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', background: 'var(--bg-base)' }}>
        <img src="/logo.svg" alt="IntelliStake" style={{ width: 72, height: 72, animation: 'float 2s ease-in-out infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>IntelliStake</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verifying credential chain…</div>
        </div>
        <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--grad-primary)', borderRadius: 2, width: '100%', backgroundSize: '200% 100%', animation: 'gradient-shift 1.5s ease infinite' }} />
        </div>
      </div>
    );
  }

  return <PublicRoutes />;
}
