# IntelliStake — Complete Project Knowledge Base
**NMIMS MCA Capstone 2025–26 · Piyush Borakhade · pborakhade7@gmail.com**

---

## What This Project Is

IntelliStake is a full-stack AI-governed venture capital investment platform for Indian startups. It implements the **R.A.I.S.E. framework** (Risk · AI · Investment · Security · Escrow) and is built as a capstone demonstrating how institutional-grade VC tooling can be made accessible to retail investors via a dual-lens UI (admin War Room + warm investor shell).

It is NOT a simple CRUD app. It is a production-architecture platform with:
- 74,577+ startup records with 64 features each
- 5 ML models in production ensemble
- Live Solidity smart contracts on Sepolia testnet
- Blockchain-verified escrow and KYC compliance
- Dual user interface: admin terminal + retail investor app

---

## Repository Structure

```
IntelliStake_Final/
├── dashboard/              React 18 + Vite frontend (port 5173)
│   └── src/
│       ├── pages/          31 pages (WarRoom, UserShell, Landing, Login, ...)
│       ├── components/
│       │   ├── WarRoom/    TopBar, CommandCenter, TrustRadar, OracleFeed, BottomNav, ...
│       │   ├── shared/     ProGate, LensToggle, TrustBar, CommandPalette, ...
│       │   └── landing/    ObservatoryCanvas (Three.js star map)
│       ├── context/        AuthContext, LensContext, AppContext
│       ├── hooks/          useTheme, useWatchlist, ...
│       └── styles/         tokens.css, themes.css, globals.css
│
├── engine/                 Python/Flask backend (port 5500)
│   ├── chatbot_api.py      Main monolith — 33+ REST endpoints
│   ├── routes/             Blueprint routes (user_routes.py, ...)
│   ├── services/           lens_service.py, ...
│   ├── valuation_stacked.py    XGB+LGBM+CatBoost+MLP → BayesianRidge
│   ├── sentiment_ensemble.py   5-model FinBERT+RoBERTa+DeBERTa+VADER
│   ├── trust_score_ml.py       XGBoost + CalibratedClassifierCV
│   ├── anomaly_ensemble.py     IsolationForest+LOF+DBSCAN+Autoencoder
│   ├── portfolio_hrp.py        HRP via PyPortfolioOpt + GARCH(1,1)
│   └── live_audit_agent.py     Real-time trust score computation
│
├── blockchain/             Hardhat + Solidity 0.8.x
│   ├── contracts/
│   │   ├── IdentityRegistry.sol    ERC-3643 KYC registry
│   │   ├── IntelliStakeToken.sol   ISTK ERC-3643 token with milestone freeze
│   │   ├── MilestoneEscrow.sol     Milestone-gated escrow vault
│   │   ├── TrustOracle.sol         ECDSA-verified oracle (CREATED April 2026)
│   │   ├── ComplianceRules.sol     Transfer compliance with oracle role
│   │   └── AgentVault.sol          AI agent-controlled vault
│   └── scripts/
│       └── demo_all_transactions.js   Full demo run (creates record)
│
└── unified_data/           3.2M data points, 50k startups
    ├── knowledge_graph/    intellistake_master_graph.parquet
    ├── cleaned/            intellistake_startups_clean.json
    └── outputs/            hrp_portfolio_weights.json, pipeline_portfolio_weights.json
```

---

## How to Run

```bash
# Backend
cd IntelliStake_Final
python3 engine/chatbot_api.py
# → starts Flask on http://localhost:5500

# Frontend
cd IntelliStake_Final/dashboard
npm run dev
# → starts Vite on http://localhost:5173

# Blockchain demo
cd IntelliStake_Final/blockchain
npx hardhat run scripts/demo_all_transactions.js --network sepolia
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6, inline styles (no Tailwind) |
| Backend | Python 3.11, Flask 3.x, Blueprint routes |
| ML | XGBoost, LightGBM, CatBoost, PyTorch (MLP), scikit-learn, PyPortfolioOpt |
| NLP | FinBERT, FinBERT-tone, Twitter-RoBERTa, DeBERTa-v3, VADER |
| Blockchain | Solidity 0.8.x, Hardhat, ethers.js v6, ERC-3643 |
| Database | Supabase (PostgreSQL) |
| Data | Parquet, 74,577 startups, 64 features |

---

## Authentication & Roles

- `AuthContext.jsx` — PBKDF2 blockchain-based auth, roles: ADMIN / PORTFOLIO_MANAGER / ANALYST
- `isPro` — ADMIN or PORTFOLIO_MANAGER = true; ANALYST = false; override: `intellistake_pro=1` in localStorage
- `isAdmin` — role === 'ADMIN'
- `useLens()` — LensContext, `lens: 'admin' | 'investor'`, persisted to `intellistake_lens` localStorage
- After login: ANALYST → `/u/portfolio` (UserShell); others → `/boot` → `/warroom`

---

## Routing Architecture

```
/                    → Landing.jsx (public, dark Observatory theme)
/login               → Login.jsx
/boot                → BootSequence.jsx (loading animation)
/warroom             → WarRoom.jsx (full-screen, no AppShell)
/register/startup    → StartupRegisterPage.jsx
/onboarding          → OnboardingWizard.jsx (standalone, no AppShell)
/u/*                 → UserShell.jsx (standalone, no AppShell)
  /u/portfolio       → Portfolio tab
  /u/discover        → Discover tab
  /u/watchlist       → Watchlist tab
  /u/analytics       → Analytics tab (Pro-gated)
  /u/profile         → Profile tab
/* (authed)          → AppShell + PAGE_ROUTES (31 inner pages)
```

STANDALONE_ROUTES = `/onboarding` + `/u/*` — rendered without AppShell sidebar chrome.

---

## Key Components

### War Room
- `WarRoom.jsx` — 3-row grid: TopBar (48px) / center panel (1fr) / BottomNav (56px)
- `TopBar.jsx` — Live KPIs, 4-theme switcher (Void/Aurora/Slate/Light), notification bell
- `CommandCenter.jsx` — Live AUM (from `/api/portfolio`), GBM Monte Carlo chart
- `TrustRadar.jsx` — Left panel, filterable startup trust scores
- `OracleFeed.jsx` — Right panel, oracle events feed
- `BottomNav.jsx` — Simulate/Blockchain/Txns/Wallet/Alerts + 6 module shortcuts (Pro-gated for ANALYST)
- `TradingAlerts.jsx` — AI Signal Feed with Approve/Dismiss (writes to `is_sim_holdings` localStorage)

### User Shell (Investor UI)
- `UserShell.jsx` — Warm white/indigo Groww-like UI, standalone at `/u/*`
- Tabs: Portfolio / Discover / Watchlist / Analytics (Pro) / Profile
- PortfolioTab: KPI cards, AI Trade Signals (Pro), HRP vs BL comparison (Pro), Holdings table
- DiscoverTab: Filtered startup cards, sentiment badge per card (Pro), Simulate Investment modal
- AnalyticsTab: SHAP feature importance bars, Risk Auditor per startup, Sentiment table

### Shared
- `ProGate.jsx` — Blur overlay + lock icon for non-Pro users, "Upgrade to Pro" button sets `intellistake_pro=1`
- `LensToggle.jsx` — Switches lens + navigates (investor → `/u/portfolio`, admin → `/warroom`)
- `CommandPalette.jsx` — Cmd+K palette

---

## Theme System

Themes are CSS variables set on `document.documentElement` via `data-theme` attribute.

**File:** `dashboard/src/styles/themes.css`

| Theme ID | Label | Colors |
|----------|-------|--------|
| `void` | ● Void | Deep black `#0A0A0F` + blue accent |
| `aurora` | ● Aurora | Dark green `#080F0C` + green `#1DB972` |
| `slate` | ● Slate | Dark blue `#0F1117` + violet `#7C5CFC` |
| `pure` | ○ Light | White `#FAFAFA` + indigo `#4F46E5` |

TopBar switches theme and persists to `intellistake-theme` localStorage key.

All WarRoom components use `var(--bg-primary)`, `var(--text-primary)` etc. — they respond to theme changes automatically.

---

## API Endpoints (port 5500)

```
GET  /api/status
GET  /api/warroom/summary        — Live KPIs: R², Sharpe, return, vol, drawdown
GET  /api/risk?startup=NAME
GET  /api/search?q=QUERY
GET  /api/portfolio              — BL portfolio holdings + metrics
GET  /api/portfolio/hrp          — HRP portfolio + BL comparison
GET  /api/montecarlo
GET  /api/oracle
GET  /api/escrow
GET  /api/notifications
GET  /api/network
GET  /api/sentiment
GET  /api/blockchain/status
GET  /api/blockchain/transactions
GET  /api/supabase/transactions
GET  /api/supabase/oracle_events
GET  /api/shap?startup=NAME
GET  /api/kyc?wallet=ADDR
POST /api/chat                   — { message, history }
POST /api/research               — { query }
POST /api/valuation/predict      — { startup data }
POST /api/investment/simulate    — { amount_inr }
POST /api/investment/memo        — { startup, amount }
POST /api/score-startup          — { startup registration data }
POST /api/trust-score            — { startup features dict }
POST /api/sentiment/ensemble     — { texts } or { startup_name, headlines }
```

**Frontend API util:** `dashboard/src/utils/api.js` — all calls via `apiFetch()` to `http://localhost:5500`

---

## ML Models (Phase 2 AI Upgrades)

### 2A — Valuation Ensemble v4
**File:** `engine/valuation_stacked.py`
- 4 base models: XGBoost + LightGBM + CatBoost + TabMLP
- Meta-learner: BayesianRidge (upgraded from Ridge)
- R² = 0.9738
- Output: `unified_data/outputs/pipeline_portfolio_weights.json`

### 2B — 5-Model Sentiment Ensemble
**File:** `engine/sentiment_ensemble.py`
- FinBERT 30% + FinBERT-tone 25% + Twitter-RoBERTa 20% + DeBERTa-v3 15% + VADER 10%
- MD5 cache with 24h TTL
- Endpoint: `POST /api/sentiment/ensemble`

### 2C — ML Trust Scoring
**File:** `engine/trust_score_ml.py`
- XGBoost base → CalibratedClassifierCV (isotonic, 5-fold)
- 10 R.A.I.S.E. features, 5000+ training rows
- Graceful fallback to 55/25/20 formula
- Endpoint: `POST /api/trust-score`

### 2D — 4-Model Anomaly Ensemble
**File:** `engine/anomaly_ensemble.py`
- IsolationForest + LOF (k=20) + DBSCAN (eps auto-tuned) + Autoencoder (PyTorch/PCA fallback)
- Flag if ≥3/4 models agree
- Output: `unified_data/4_production/hype_anomaly_flags.json`

### 2E — HRP Portfolio Optimizer
**File:** `engine/portfolio_hrp.py`
- PyPortfolioOpt HRPOpt + GARCH(1,1) via `arch` library
- Side-by-side BL comparison, winner field
- Endpoint: `GET /api/portfolio/hrp`
- Output: `unified_data/outputs/hrp_portfolio_weights.json`

---

## Blockchain — Contract Status (as of April 2026)

All contracts deployed on Sepolia testnet:
- `IdentityRegistry`: `0x3427a20B61033e8D5A5bac25aff3EB1C7569689F`
- `IntelliStakeToken (ISTK)`: `0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb`
- `IntelliStakeInvestment`: `0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7`

### Bugs Fixed (April 2026)
1. **TrustOracle.sol** — CREATED from scratch (was referenced but missing); ECDSA sig verification + nonce protection + rate limiting
2. **AgentVault.sol** — Fixed wrong interface call (`fundStartup` → `depositFunds`)
3. **IntelliStakeToken.sol** — Added `freezeMilestoneFunding`, fixed ECDSA verify, fixed ICompliance 4-arg interface, added oracle state var
4. **ComplianceRules.sol** — Added `authorisedOracles` mapping + `onlyOracleOrOwner` modifier so TrustOracle can call compliance functions
5. **oracle_bridge_full.py** — Fixed SHA3-256 → Keccak-256 for Ethereum function selector
6. **IntelliStakeOracle.js** — Fixed BigInt precision loss in `floatToSolidityInt()`

---

## Frontend Features — Phase Completion

### Phase 1 (Done)
- War Room TopBar: removed Globe + Network buttons; 3-pill theme switcher → 4 themes
- UserShell: standalone warm investor UI at `/u/*`
- CommandCenter: live AUM from API (not hardcoded)
- WalletConnect: MetaMask demo guard (no crash if no MetaMask)
- LensToggle: navigates to correct route on lens switch
- Login: ANALYST → `/u/portfolio`, others → `/boot`

### Phase 2 AI (Done)
All ML upgrades implemented as Python modules, wired to Flask endpoints, connected to frontend via `api.js`.

### Phase 3 (Done)
- **3A:** Landing page pricing section (Free ₹0 vs Pro ₹999/mo) with feature lists
- **3B:** BottomNav PRO gating — ANALYST users see 🔒 + "Pro only" on risk/escrow/shap/sentiment/chatbot; clicking flashes red underline
- **3C:** TradingAlerts upgraded to AI Signal Feed — approve → writes ₹50,000 position to `is_sim_holdings` localStorage; dismiss removes from feed

### UserShell Pro Features (Done)
- Analytics tab: SHAP importance bars, Risk Auditor multi-factor, sentiment breakdown table
- Portfolio tab: AI Trade Signals (BUY/HOLD/SELL with confidence), HRP vs BL comparison with per-holding weight chart
- Discover tab: sentiment badge on each startup card when isPro
- Profile tab: Pro plan feature checklist

### Phase 4 (Pending)
- 4A: Backend pytest tests (minimum 20)
- 4B: Frontend Playwright E2E tests (minimum 10 scenarios)

---

## Key localStorage Keys

| Key | Purpose |
|-----|---------|
| `intellistake_lens` | `'admin'` or `'investor'` |
| `intellistake_pro` | `'1'` = Pro override (demo) |
| `intellistake-theme` | `'void'` / `'aurora'` / `'slate'` / `'pure'` |
| `intellistake_investor_profile` | JSON from OnboardingWizard (investor DNA) |
| `is_sim_holdings` | JSON array of simulated investment positions |
| `intellistake_watchlist` | JSON array of starred startups |

---

## Important Patterns & Conventions

1. **No Tailwind** — all styles are inline React `style={{}}` objects
2. **No TypeScript** — pure `.jsx` / `.py`
3. **Proxy** — all API calls go to `http://localhost:5500` via `api.js`; no `.env` needed for local dev
4. **ProGate** — wrap any Pro feature: `<ProGate isPro={isPro} label="Feature Name">...</ProGate>`
5. **Lens** — admin vs investor view controlled by LensContext; never use role directly for UI toggling
6. **Indian number format** — use `inr(n)` helper: `₹X Cr` / `₹X L` / `₹X`
7. **Trust colors** — ≥0.7 green `#10b981`, ≥0.5 amber `#f59e0b`, below red `#ef4444`
8. **Standalone routes** — add to `STANDALONE_ROUTES` in `App.jsx` if a page should render without AppShell sidebar

---

## What Is NOT Yet Built

- Real JWT verification (currently mock — returns hardcoded `role: 'ANALYST'`)
- Real Supabase user auth (using blockchain PBKDF2 demo)
- Real-time WebSocket for oracle events (currently polling)
- Phase 4 tests (pytest + Playwright)
- ComplianceRules + MilestoneEscrow not re-deployed after fixes (need `npx hardhat deploy`)
- No max supply cap on ISTK token

---

## Capstone Evaluation Context

This is being evaluated for NMIMS MCA 2025-26. The evaluators will look at:
- Architecture sophistication (multi-domain: ML + blockchain + finance + UX)
- Code quality and engineering decisions
- Live demo on Sepolia testnet
- R.A.I.S.E. framework implementation

The platform is a **demo/simulation environment** — all investments are simulated, all blockchain interactions are on Sepolia testnet (not mainnet), and Pro plan is freely unlockable for demo purposes.
