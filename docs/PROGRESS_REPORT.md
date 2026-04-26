# IntelliStake - Progress Report
**AI-Governed Crowd-Venture Investment Platform**

**NMIMS MCA Capstone 2025-26**
**Last Updated:** 2026-04-23
**Current Status:** Core platform implemented, refactored, and demo-ready

---

## 1. Project Summary

IntelliStake is a full-stack venture investment platform for Indian startups. It combines artificial intelligence, quantitative finance, blockchain compliance, and a dual-lens web experience into a single capstone-grade system.

The platform is built around the R.A.I.S.E. framework:
- Risk
- AI
- Investment
- Security
- Escrow

The project now includes:
- A large startup data lake with 74,577 records and 64 features per startup
- Production ML models for valuation, trust scoring, anomaly detection, sentiment, and portfolio construction
- A modular Flask backend with more than 33 REST endpoints
- Solidity smart contracts for KYC, compliance, escrow, and oracle integration
- A React + Vite dashboard with admin and investor experiences
- Demo flows for wallet, alerts, notifications, and transaction history

---

## 2. What Was Added Recently

The latest work focused on turning the earlier prototype into a more complete product surface.

### Frontend and UX
- Added a warm retail investor shell at `/u/*` with Portfolio, Discover, Watchlist, Analytics, and Profile tabs.
- Added `ProGate` for premium feature gating with localStorage-based demo override.
- Added `LensToggle` routing between investor and admin experiences.
- Added `TradingAlerts` for AI signal feed with Buy/Sell/Hold recommendations.
- Added `NotificationPanel` behind the top-bar bell icon.
- Added `WalletConnect` for MetaMask / Sepolia demo transactions.
- Expanded `BottomNav` with Simulate, Blockchain, Txns, Wallet, and Alerts actions.
- Added a dark-to-light multi-theme system with persisted user preference.

### Backend and Intelligence Layer
- Added ML-based trust scoring in `engine/trust_score_ml.py`.
- Added anomaly ensemble detection in `engine/anomaly_ensemble.py`.
- Added Hierarchical Risk Parity support in `engine/portfolio_hrp.py`.
- Added a modular ML training pipeline in `engine/ml/model_trainer.py`.
- Added backend auth and encryption utilities in `engine/security/auth.py`.
- Added Redis caching support in `engine/cache/redis_cache.py`.
- Added route-level user endpoints in `engine/routes/user_routes.py`.

### Blockchain and Oracle Flow
- Added `TrustOracle.sol` for signed trust-score push operations.
- Added `MilestoneEscrow.sol` for tranche-based escrow release.
- Added `ComplianceRules.sol` for KYC and compliance enforcement.
- Added `AgentVault.sol` for AI-assisted vault and investment routing.
- Added full transaction demo coverage in `blockchain/scripts/demo_all_transactions.js`.

### Reporting and Documentation
- Updated the project knowledge base.
- Added refactoring and production-improvement summaries.
- Expanded the README and roadmap to match the current system state.

---

## 3. Current Architecture

### Repository Layout

```text
IntelliStake_Final/
├── dashboard/              React 18 + Vite frontend
├── engine/                 Python backend, ML, security, and API routes
├── blockchain/             Hardhat + Solidity contracts and demo scripts
├── data_scaling_engine/    Data ingestion and graph generation utilities
├── unified_data/           Cleaned data lake, knowledge graph, outputs
├── models/                 Persisted model artifacts
├── docs/                   Project documentation and reports
└── tests/                  API smoke and endpoint tests
```

### Main Runtime Surfaces
- Frontend port: 5173
- Backend port: 5500
- Blockchain demo: Hardhat / Sepolia flow

---

## 4. Data and Knowledge Graph

The data layer is one of the main strengths of the project.

### Data Coverage
- 74,577 total startup records
- 64 engineered features per startup in the master graph
- 3.2M+ data points in the knowledge graph
- Multiple source streams merged into one pipeline

### Data Sources
- MCA government filings
- GitHub velocity and repository signals
- Web traffic and growth signals
- News and RSS sentiment feeds
- Founder and investor profile signals
- Blockchain wallet and compliance identity data

### Data Outputs
- Cleaned startup datasets
- Sentiment datasets
- GitHub velocity outputs
- MCA audit results
- Final portfolio and model output files

### Data Flow
1. Raw ingestion
2. Cleaning and deduplication
3. Signal enrichment
4. Knowledge graph synthesis
5. Portfolio and risk outputs

---

## 5. AI and ML Layer

### Valuation Engine
The valuation stack predicts startup valuations using ensemble ML methods.

Current direction:
- XGBoost and LightGBM remain core models
- Stacked ensemble now includes CatBoost and additional learner support in the newer architecture docs
- Production outputs are persisted for reuse and demo stability

### Trust Scoring
The trust system has moved from a simple hand-tuned formula toward a learned scoring approach.

Current components:
- `engine/trust_score_ml.py`
- Calibrated probability-style trust outputs
- Feature-driven interpretation using R.A.I.S.E. inputs
- API exposure for trust score requests

### Sentiment Analysis
Sentiment now exists as a stronger ensemble surface rather than a single-model demo.

Included signals:
- FinBERT
- FinBERT-tone
- Twitter-RoBERTa sentiment
- DeBERTa-based text scoring
- VADER fallback / baseline scoring

### Anomaly Detection
Hype and risk anomaly detection is implemented as a multi-detector ensemble.

Included detectors:
- Isolation Forest
- Local Outlier Factor
- DBSCAN
- Autoencoder-based anomaly detection

### Portfolio Construction
The finance layer now supports both classical and alternative portfolio approaches.

Implemented methods:
- Black-Litterman portfolio optimization
- Hierarchical Risk Parity (`/api/portfolio/hrp`)
- Monte Carlo simulation for scenario analysis
- Risk-adjusted output metrics such as Sharpe, Sortino, volatility, and drawdown

### Live Audit Agent
The live audit agent combines signals from multiple sources and pushes trust status into the blockchain flow.

Current behavior includes:
- Real-time audit orchestration
- Trust score computation
- Oracle push preparation
- Integration with blockchain freeze logic

---

## 6. Backend and API Surface

The backend is still centered on `engine/chatbot_api.py`, but the project now includes modular route and service layers.

### Backend Improvements
- Flask app with many JSON endpoints
- Rate limiting and request metrics
- Structured API response behavior
- Auth helpers for protected routes
- Redis-backed cache support where available
- Blueprint-style route expansion for user-facing features

### Notable Endpoints
- `/api/status`
- `/api/metrics`
- `/api/slo`
- `/api/portfolio`
- `/api/portfolio/hrp`
- `/api/trust-score`
- `/api/sentiment/ensemble`
- `/api/montecarlo`
- `/api/escrow`
- `/api/oracle`
- `/api/blockchain/transactions`
- `/api/supabase/transactions`
- `/api/shap`
- `/api/health`

### User Routes
`engine/routes/user_routes.py` provides user-facing endpoints for:
- Profile
- Personalized feed
- Portfolio view
- Watchlist management
- HRP portfolio output

---

## 7. Blockchain and Oracle Layer

The blockchain layer handles compliant tokenization, escrow, and oracle flows.

### Smart Contracts
- `IdentityRegistry.sol` for KYC registry behavior
- `IntelliStakeToken.sol` for ERC-3643 token behavior
- `MilestoneEscrow.sol` for tranche-based fund release
- `TrustOracle.sol` for signed trust-score pushes
- `ComplianceRules.sol` for compliance validation
- `AgentVault.sol` for demo investment routing

### Oracle Flow
1. Off-chain audit produces trust score
2. Oracle signs payload
3. Payload is pushed on-chain
4. Escrow uses the trust signal for freeze or release logic
5. Compliance rules enforce permitted transfer behavior

### Demo Coverage
- Sepolia-oriented wallet flow
- Ethers.js contract interaction path
- Contract transaction demo script
- Oracle event logging and freeze scenarios

---

## 8. Dashboard and UI

The dashboard now supports two distinct user experiences.

### Admin War Room
Designed for the institutional / analyst view.

Core components:
- `TopBar`
- `CommandCenter`
- `TrustRadar`
- `OracleFeed`
- `BottomNav`
- `NotificationPanel`
- `TradingAlerts`
- `WalletConnect`

### Investor User Shell
Designed for the retail investor experience.

Core components:
- `UserShell.jsx`
- `ProGate.jsx`
- `LensToggle.jsx`
- Portfolio tab
- Discover tab
- Watchlist tab
- Analytics tab
- Profile tab

### UX Features
- Warm white and indigo retail visual language
- Dark institutional analytics mode
- Theme switching with persistence
- Metric cards and startup cards
- SHAP and trust explanations
- AI signal cards and simulated approvals

---

## 9. Testing and Verification

Testing is now present, but the suite is still smaller than the final target.

### Existing Tests
- `tests/test_api_smoke.py`
- `tests/test_ai_endpoints.py`

### What These Cover
- Health and status endpoints
- Request validation behavior
- Rate limit behavior
- Metrics and SLO surface checks
- Endpoint smoke coverage for AI and platform routes

### Current Gap
- Coverage is still below the long-term 80% target
- More unit and integration tests are needed for the newer ML, UI, and blockchain surfaces

---

## 10. Key Metrics Snapshot

| Area | Value |
|---|---|
| Startup records | 74,577 |
| Features per startup | 64 |
| Knowledge graph size | 3.2M+ data points |
| Frontend pages | 31 |
| API endpoints | 33+ |
| ML model families | 5+ active model surfaces |
| Blockchain contracts | 5+ core contracts |
| Dashboard ports | 5173 frontend, 5500 backend |
| Demo wallets | Admin, PM, Analyst roles |

### Representative Model Metrics
- Valuation model performance remains in the high-accuracy range described in the model docs
- Portfolio optimization includes both BL and HRP outputs
- Risk outputs include trust score, anomaly flags, and sentiment overlays

### Representative Business Metrics
- Demo portfolio support for multiple startup holdings
- Escrow release tied to oracle and milestone logic
- Wallet demo flow for Sepolia-based transactions

---

## 11. Current Delivery Status

### Completed
- Data ingestion and knowledge graph pipeline
- Valuation, sentiment, trust, anomaly, and portfolio layers
- Modular backend and route expansion
- Smart contract and oracle architecture
- Admin dashboard and investor shell
- Demo transaction and wallet surfaces
- Documentation refresh and refactor summaries

### In Progress or Still to Expand
- Broader test coverage
- More complete frontend end-to-end automation
- Additional production hardening for deployment
- Further cleanup of duplicated legacy surfaces
- Public-facing deployment packaging

---

## 12. How to Run the Project

### Backend
```bash
cd IntelliStake_Final
python3 engine/chatbot_api.py
```

### Frontend
```bash
cd IntelliStake_Final/dashboard
npm run dev
```

### Blockchain Demo
```bash
cd IntelliStake_Final/blockchain
npx hardhat run scripts/demo_all_transactions.js --network sepolia
```

### End-to-End Demo
- Start backend
- Start frontend
- Open the dashboard
- Use the War Room for analyst flows
- Use `/u/*` for investor flows
- Use the wallet and alerts panels for demo interactions

---

## 13. Conclusion

IntelliStake is now a multi-domain capstone platform that goes beyond a prototype. It combines a real data pipeline, modern ML systems, investment optimization, compliance-aware blockchain execution, and a dual-lens dashboard experience.

The most recent work moved the project closer to a presentable product by adding:
- A real investor-facing UI
- Premium feature gating
- Wallet and notification flows
- Better trust, anomaly, and portfolio support
- A modular backend and cleaner documentation trail

The project is now in a strong state for final capstone review and further production hardening.

---

**Project:** IntelliStake
**Institution:** NMIMS MCA Capstone 2025-26
**Last Updated:** 2026-04-23
**Status:** Demo-ready, heavily implemented, and actively refined

---

## 14. Full End-to-End Story

This section explains the project from start to finish in practical order.

### Why This Project Exists
The project was built to solve a specific capstone problem: startup investing is usually noisy, opaque, slow, and difficult to evaluate for non-institutional users. IntelliStake tries to make that process structured by combining:
- data collection and enrichment,
- machine learning valuation and trust scoring,
- financial portfolio construction,
- blockchain-based compliance and milestone control,
- and a user interface that can explain the system to both technical and non-technical reviewers.

### What the Platform Does
At a high level, the platform:
1. collects and normalizes startup data,
2. computes a knowledge graph and feature set,
3. scores startups with valuation, sentiment, anomaly, and trust models,
4. constructs portfolios with Black-Litterman and HRP,
5. sends trust data into blockchain escrow and oracle logic,
6. exposes all of it through a demo-friendly dashboard.

### How the Data Moves
Raw startup records enter the pipeline from multiple sources. Those records are cleaned, deduplicated, enriched, and turned into a master graph. The engine layer consumes that graph to generate trust scores, valuations, portfolio weights, and anomaly flags. The backend then serves those outputs to the dashboard and to blockchain demo flows.

### How a Demo Flow Works
When a reviewer opens the product:
1. they land on the dashboard,
2. the platform loads API-driven metrics,
3. the War Room shows live-style risk and oracle signals,
4. the investor shell shows a friendlier portfolio and discovery experience,
5. the wallet and transaction surfaces simulate blockchain interaction,
6. the escrow and oracle visuals explain how capital would move through the system.

---

## 15. Detailed Module Inventory

### 15.1 Data Engineering Modules
- `data_scaling_engine/master_knowledge_graph.py` builds the graph from multi-source data.
- `data_scaling_engine/github_velocity_aggregator.py` aggregates repository velocity signals.
- `data_scaling_engine/mca_audit_pipeline.py` audits financial integrity and flags anomalies.
- `data_scaling_engine/sentiment_harvester.py` collects RSS and text sentiment signals.
- `engine/data_lake_manager.py` manages the local lake and output artifacts.

### 15.2 AI / ML Modules
- `engine/valuation_engine.py` contains the original valuation ensemble.
- `engine/valuation_stacked.py` contains the upgraded stacked valuation ensemble.
- `engine/trust_score_ml.py` computes ML-based trust scores.
- `engine/anomaly_ensemble.py` performs multi-detector anomaly detection.
- `engine/sentiment_ensemble.py` combines multiple sentiment models.
- `engine/finbert_sentiment.py` and `engine/finbert_live.py` provide the FinBERT surfaces.
- `engine/clip_sector_classifier.py` classifies sectors where needed.
- `engine/survival_analysis.py` supports longevity / survival style analysis.
- `engine/eval_genai.py` supports genAI evaluation-style outputs.

### 15.3 Finance Modules
- `engine/portfolio_optimizer.py` runs Black-Litterman optimization.
- `engine/portfolio_hrp.py` runs HRP optimization and comparison logic.
- `engine/backtest_engine.py` supports historical backtesting.
- `engine/risk_simulator.py` supports scenario-based risk simulation.
- `engine/portfolio_optimizer.py` and related routes emit allocation weights, return estimates, drawdown, and risk metrics.

### 15.4 Blockchain Modules
- `blockchain/contracts/IntelliStakeToken.sol` handles token compliance.
- `blockchain/contracts/MilestoneEscrow.sol` handles tranche release logic.
- `blockchain/contracts/TrustOracle.sol` verifies and stores trust pushes.
- `blockchain/contracts/ComplianceRules.sol` enforces KYC and transfer rules.
- `blockchain/contracts/IdentityRegistry.sol` stores identity and status information.
- `blockchain/contracts/AgentVault.sol` routes demo investment actions.
- `blockchain/scripts/demo_all_transactions.js` demonstrates the full contract lifecycle.
- `blockchain/oracle_bridge.py` and `blockchain/oracle_bridge_full.py` provide the off-chain bridge.

### 15.5 Backend and API Modules
- `engine/chatbot_api.py` remains the primary Flask surface.
- `engine/routes/user_routes.py` provides user-centric endpoints.
- `engine/security/auth.py` handles demo auth and encryption helpers.
- `engine/cache/redis_cache.py` provides caching where available.
- `engine/ml/model_trainer.py` supports training and monitoring.
- `engine/services/lens_service.py` handles lens translation.
- `engine/services/portfolio_service.py` and related service modules encapsulate business logic.

### 15.6 Dashboard Modules
- `dashboard/src/pages/Landing.jsx` is the public landing experience.
- `dashboard/src/pages/WarRoom.jsx` is the analyst console.
- `dashboard/src/pages/UserShell.jsx` is the investor shell.
- `dashboard/src/components/WarRoom/BottomNav.jsx` contains module shortcuts and modal surfaces.
- `dashboard/src/components/WarRoom/TradingAlerts.jsx` provides AI signal actions.
- `dashboard/src/components/WarRoom/NotificationPanel.jsx` handles notifications.
- `dashboard/src/components/WarRoom/WalletConnect.jsx` connects to MetaMask demo flows.
- `dashboard/src/components/shared/ProGate.jsx` protects premium content.
- `dashboard/src/components/shared/LensToggle.jsx` switches between admin and investor views.
- `dashboard/src/styles/themes.css` stores theme variables.

---

## 16. Why Each Major System Exists

### Data Lake
Needed to support realistic startup scoring, portfolio construction, and explainability.

### Valuation Engine
Needed to estimate enterprise value from structured startup features instead of hardcoded assumptions.

### Trust Score Layer
Needed to compress multiple signals into one actionable reliability score.

### Sentiment Ensemble
Needed to avoid depending on one fragile NLP model and to improve robustness across noisy news text.

### Anomaly Detection
Needed to catch hype, manipulation, and outlier-like behavior before it affects investment decisions.

### Portfolio Optimizers
Needed to translate model outputs into actual allocations and to compare classical and alternative portfolio theory.

### Oracle and Escrow
Needed to show how off-chain intelligence can trigger on-chain compliance and milestone release logic.

### Dual Dashboard
Needed to present the same system to two audiences: institutional reviewers and retail-style users.

---

## 17. Important User Journeys

### 17.1 Analyst Journey
An analyst opens the War Room, checks live KPIs, inspects startup trust scores, reviews portfolio metrics, opens the oracle feed, and simulates downstream blockchain actions.

### 17.2 Investor Journey
An investor opens `/u/*`, browses startup cards, reads trust and sentiment summaries, views watchlists, checks HRP vs BL comparisons, and uses the AI signal feed when Pro features are enabled.

### 17.3 Blockchain Journey
A demo user opens the wallet flow, connects MetaMask, switches to Sepolia, and simulates a transaction. That same trust signal can then be shown in the oracle and escrow explanations.

### 17.4 Reviewer Journey
A professor or evaluator can trace the flow from data lake to models to dashboard to blockchain and see that the project is not just a static UI.

---

## 18. Functional Behavior by Domain

### AI and Trust
- Startup trust is based on multiple signals rather than a single number.
- Trust values influence freeze decisions, portfolio rankings, and signal feed recommendations.

### Finance
- The platform compares expected return, volatility, Sharpe, Sortino, and drawdown.
- Black-Litterman is used for posterior allocation logic.
- HRP is used as a more robust alternative comparison.

### Security and Compliance
- Wallets can be verified or locked.
- Transfers are gated by compliance rules and investor status.
- Escrow is milestone-driven and can freeze on weak trust signals.

### UX
- The dashboard is split into a technical admin lens and a warm investor lens.
- Pro features are intentionally gated to simulate tiered access.

---

## 19. Current Files That Matter Most

These are the files that best represent the current state of the platform:
- [README.md](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/README.md)
- [INTELLISTAKE_PROJECT_KNOWLEDGE.md](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/INTELLISTAKE_PROJECT_KNOWLEDGE.md)
- [IMPLEMENTATION_PLAN.md](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/IMPLEMENTATION_PLAN.md)
- [PRODUCTION_IMPROVEMENTS.md](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/PRODUCTION_IMPROVEMENTS.md)
- [REFACTORING_COMPLETE.md](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/REFACTORING_COMPLETE.md)
- [engine/chatbot_api.py](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/engine/chatbot_api.py)
- [engine/routes/user_routes.py](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/engine/routes/user_routes.py)
- [dashboard/src/pages/UserShell.jsx](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/dashboard/src/pages/UserShell.jsx)
- [dashboard/src/components/WarRoom/BottomNav.jsx](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/dashboard/src/components/WarRoom/BottomNav.jsx)
- [blockchain/scripts/demo_all_transactions.js](/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final/blockchain/scripts/demo_all_transactions.js)

---

## 20. Current Known Limitations

The project is broad, but some areas still remain less complete than the rest:
- Full production JWT verification is still partially demo-oriented.
- Some blockchain flows remain Sepolia/testnet demo flows.
- Coverage is still below the long-term testing target.
- Some roadmap items are future work rather than finished production modules.
- The dashboard uses mocked or derived data in several places to keep the demo stable.

---

## 21. Final Status Statement

IntelliStake now covers the full intended capstone arc:
- problem definition,
- data ingestion,
- model creation,
- decision logic,
- portfolio construction,
- blockchain enforcement,
- dashboard presentation,
- and demo delivery.

The project is no longer just a concept write-up. It is a working multi-layer system with substantial implementation across Python, Solidity, JavaScript, React, and data engineering components.
