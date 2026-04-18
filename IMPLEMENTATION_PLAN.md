# IntelliStake — Revised Master Implementation Plan
**Last Updated:** 2026-04-17
**Audit Status:** 8 real bugs confirmed, 9 already working, 3 unclear

---

## AUDIT FINDINGS (Confirmed Real Issues)

### CONFIRMED REAL — must fix
| # | Area | Issue | File |
|---|------|-------|------|
| R1 | Frontend | ethers.js never imported/used — no on-chain calls from UI | dashboard/src/pages/*.jsx |
| R2 | Frontend | CommandCenter AUM hardcoded ₹1,00,00,000 | CommandCenter.jsx:92 |
| R3 | Testing  | Zero test files in entire codebase | — |
| R4 | ML/AI    | CatBoost in requirements, never wired into ensemble | engine/valuation_stacked.py |
| R5 | ML/AI    | Trust score hand-tuned 55/25/20 formula, not ML-based | engine/ |
| R6 | ML/AI    | Sentiment is 2 models (FinBERT + VADER), not ensemble | engine/finbert_sentiment.py |

### CONFIRMED FIXED — not real problems
- Oracle bridge, AgentVault, MilestoneEscrow, ComplianceRules — all interfaces correct
- Dual Flask conflict — server.py properly routes; no conflict
- Redis — graceful fallback in redis_cache.py
- JWT auth — @require_auth() decorator with role enforcement exists
- Globe overlay — Three.js scene fully implemented
- Theme switcher — already updated to 3 labeled pills
- Bottom nav buttons — all wired
- FinBERT + VADER sentiment — both present and working

### UNCLEAR — needs observation
- Investor Network graph — renders but data quality unknown
- Landing page — dark aesthetic may be intentional; warm redesign still planned

---

## PHASE 1 — Frontend Completion (Current Session)
**Goal:** Complete the warm investor UI and fix the hardcoded AUM

### 1A. TopBar.jsx ✅ DONE
- Removed Globe + Network buttons
- 3 labeled theme pills (Dark / Warm / Pure Light) replacing dots

### 1B. AuthContext isPro ✅ DONE
- isPro: ADMIN/PM = true, ANALYST = false
- Override: localStorage `intellistake_pro=1`

### 1C. ProGate component ✅ DONE
- Lock overlay for premium features
- Upgrade button (demo: sets localStorage override + reload)

### 1D. UserShell — full warm investor UI
- Standalone route `/u/*` (Portfolio / Discover / Watchlist / Profile)
- White cards, indigo #4F46E5 accent, Groww-like warm tone
- Portfolio tab: greeting, 3 metric cards, upgrade banner
- Discover tab: startup cards + simulate investment
- Watchlist tab: saved startups list
- Profile tab: investor DNA from onboarding
- Status: TODO

### 1E. App.jsx routing
- Add `/u/portfolio`, `/u/discover`, `/u/watchlist`, `/u/profile` as STANDALONE_ROUTES
- ANALYST role redirects to `/u/portfolio` after login
- Status: TODO

### 1F. LensToggle navigation
- investor lens → navigate to `/u/portfolio`
- admin lens → navigate to `/warroom`
- Status: TODO

### 1G. CommandCenter AUM fix (R2)
- Fetch from `/api/portfolio/summary` or derive from holdings
- Indian number format: ₹1,00,00,000 style
- Fix "30 holdings" hardcode
- Status: TODO

### 1H. ethers.js Escrow fix (R1)
- Guard `window.ethereum` with null check
- Show "MetaMask not installed" helpful message
- Demo mode fallback with simulated tx hash
- Status: TODO

---

## PHASE 2 — AI Model Upgrades (7 of 12)
**Goal:** Upgrade the ML engine with 7 targeted improvements

### 2A. Valuation Ensemble → Add CatBoost (R4)
**What:** Wire CatBoost (already in requirements) into the stacked ensemble
- Add `catboost.CatBoostRegressor` to `valuation_stacked.py` alongside XGB + LGBM
- 3-model base: XGB + LGBM + CatBoost → meta-learner: BayesianRidge
- Retrain, evaluate R² improvement
- Target: R² > 0.96 (currently 0.9645)
- **Files:** `engine/valuation_stacked.py`, `engine/train_stacked.py`

### 2B. Valuation Ensemble → Add pytorch-tabnet
**What:** Add TabNet as 4th base model
- `pip install pytorch-tabnet`
- TabNetRegressor with GPU-optional config
- 4-model ensemble: XGB + LGBM + CatBoost + TabNet
- **Files:** `engine/valuation_stacked.py`

### 2C. 5-Model Stacked Ensemble (2A + 2B combined)
**What:** Full 5-model ensemble when FT-Transformer is feasible
- Add FT-Transformer (via pytorch-frame or rtdl library)
- Meta-learner: BayesianRidge instead of Ridge
- Final target: R² > 0.97
- **Files:** `engine/valuation_stacked.py`, `engine/models/ft_transformer.py` (new)
- **Note:** FT-Transformer is heavy — implement 2A+2B first, add this if time permits

### 2D. Sentiment → 5-Model Ensemble (R6)
**What:** Expand from 2-model to 5-model weighted ensemble
- Add: `yiyanghkust/finbert-tone` (FinBERT-tone)
- Add: `cardiffnlp/twitter-roberta-base-sentiment` (Twitter-RoBERTa)
- Add: `microsoft/deberta-v3-small` fine-tuned on financial text
- Weighted average: FinBERT 30% + FinBERT-tone 25% + Twitter-RoBERTa 20% + DeBERTa 15% + VADER 10%
- Cache per startup per 24h
- **Files:** `engine/finbert_sentiment.py` (extend), `engine/sentiment_ensemble.py` (new)

### 2E. Trust Score → ML-Based (R5)
**What:** Replace hand-tuned 55/25/20 formula with a calibrated XGBoost classifier
- Train XGBoost binary classifier on success/failure labels (use synthetic labels from trust threshold)
- Wrap with `CalibratedClassifierCV` → output calibrated probability as trust score (0–1)
- Add MC Dropout uncertainty estimate for confidence interval
- Keep R.A.I.S.E. factor names as input features (interpretable)
- **Files:** `engine/trust_score_ml.py` (new), `engine/train_trust.py` (new)
- **API:** `/api/trust-score` returns `{score, confidence_interval, feature_importance}`

### 2F. Anomaly Detection → 4-Model Ensemble
**What:** Add LOF + Autoencoder + DBSCAN alongside existing Isolation Forest
- Flag hype anomaly only if ≥ 3/4 detectors agree (reduces false positives)
- Ensemble vote exposed in API response
- **Files:** `engine/anomaly_ensemble.py` (new, extends existing hype detector)
- **API:** `/api/hype-detection` adds `ensemble_votes` field

### 2G. Portfolio → Hierarchical Risk Parity (HRP)
**What:** Add HRP as alternative to Black-Litterman
- `pip install PyPortfolioOpt`
- HRP via `HRPOpt` from PyPortfolioOpt
- `arch` library for GARCH(1,1) volatility forecasting
- Compare: BL vs HRP results side by side in Portfolio page
- **Files:** `engine/portfolio_hrp.py` (new), `engine/portfolio_optimizer.py` (extend)
- **API:** `/api/portfolio/hrp` returns HRP weights + expected return + vol

---

## PHASE 3 — Landing Page + Toolbar Gating
**Goal:** Warm retail landing page and PRO feature gating on toolbar

### 3A. Landing Page Redesign
- Warm indigo/white aesthetic (Groww/Zerodha inspired)
- Hero with value proposition ("Invest in India's next unicorn")
- Features grid: AI scoring, portfolio optimizer, trust engine, escrow
- Pricing section: Free (ANALYST) vs Pro (PM/Admin) feature comparison table
- Testimonials (3 mock investor quotes)
- Footer with links
- **File:** `dashboard/src/pages/Landing.jsx` (full rewrite)

### 3B. Bottom Toolbar PRO Gating
- For user lens: wrap Risk Auditor, SHAP, Sentiment, Escrow, AI Analyst with ProGate
- Lock icon + "Upgrade to Pro" on click
- Admin: all unlocked
- **File:** `dashboard/src/components/AppShell.jsx` or Sidebar.jsx

### 3C. Transaction Simulation
- AI signal feed: "AI recommends BUY 2% Razorpay — trust score +0.04"
- User can approve / dismiss signals
- Portfolio holdings update in localStorage on approval
- Signal cards: BUY/SELL/HOLD with confidence + 1-line reasoning
- **File:** `dashboard/src/components/UserShell/SignalFeed.jsx` (new)

---

## PHASE 4 — Testing Foundation (R3)
**Goal:** Add minimum viable test coverage to unblock the F grade

### 4A. Backend Tests
- `engine/tests/test_trust_score.py` — unit tests for trust score ML model
- `engine/tests/test_valuation.py` — ensemble prediction shape + range tests
- `engine/tests/test_sentiment.py` — ensemble output format tests
- `engine/tests/test_api_routes.py` — Flask route smoke tests (login, score-startup, portfolio)
- Target: 20 tests minimum, covering all Phase 2 model upgrades

### 4B. Frontend Tests
- Playwright E2E: login flow, onboarding wizard, discover page filter
- Jest unit: ProGate rendering, AuthContext isPro logic
- Target: 10 E2E scenarios

---

## PHASE 5 — Bloomberg Signals + Escrow Visualization
**Goal:** Make the platform feel live and institutional (advanced features)

### 5A. Bloomberg-Style Signal Feed
- Real company signals where data exists, simulated elsewhere
- Famous investor signals: mock Rakesh Jhunjhunwala, Sequoia, Softbank
- Signal cards: BUY/SELL/HOLD + confidence + reasoning + source
- User can act on signals from the feed

### 5B. Escrow Per-Company / Per-User Visualization
- Each startup shows its own tranche history (T1/T2/T3 release timeline)
- Each user sees their own investment milestones
- Animated tranche release visualization
- Real Sepolia tx hash lookup per milestone

### 5C. SHAP Fix — All Startups
- Show all 74,577 startups (not just top 20)
- Paginated search by name or sector (50 per page)
- **File:** `dashboard/src/pages/ShapExplainer.jsx`

---

## PHASE 6 — iOS App Prep (Later)
- API standardization: `/api/v1/` prefix, consistent JSON schema
- OpenAPI/Swagger docs
- React Native / Expo foundation
- Auth flow (JWT)
- Portfolio + Discover tabs

---

## Execution Order for Next Sessions

### NOW (current session): Complete Phase 1
1. UserShell warm investor UI (`/u/*` routes)
2. App.jsx routing update
3. LensToggle navigation
4. CommandCenter AUM fix
5. ethers.js / MetaMask guard in Escrow

### NEXT SESSION: Phase 2 AI upgrades
Start with: 2A (CatBoost) → 2B (TabNet) → 2D (Sentiment ensemble) → 2E (Trust score ML) → 2F (Anomaly ensemble) → 2G (HRP)

### AFTER THAT: Phase 3 (Landing + gating) → Phase 4 (Tests) → Phase 5 (Bloomberg)

---

## Reference

### Demo Accounts
```
admin@intellistake.ai     / Admin@2024!      (ADMIN — isPro=true)
pm@intellistake.ai        / Invest@2024!     (PORTFOLIO_MANAGER — isPro=true)
analyst@intellistake.ai   / Analyse@2024!    (ANALYST — isPro=false)
```

### Key localStorage Keys
```
intellistake_lens          — 'admin' | 'investor'
intellistake_investor_profile — full 15-field DNA JSON
intellistake_pro           — '1' to override isPro for demo
intellistake-theme         — 'aurora' | 'void' | 'pure'
is_credential_chain        — blockchain auth log
is_session                 — JWT-like session token
```

### API Base
```
Flask engine: http://localhost:5500
Key endpoints: /api/warroom, /api/portfolio/summary, /api/trust-score,
               /api/shap-explainer, /api/score-startup, /api/sentiment
```
