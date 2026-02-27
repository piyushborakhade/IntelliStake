# IntelliStake — AI-Governed Crowd-Venture Investment Platform

> **NMIMS MCA Capstone 2025–26 · Final Submission Repository**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![React + Vite](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb.svg)](https://vitejs.dev)
[![Solidity 0.8.x](https://img.shields.io/badge/solidity-0.8.x-363636.svg)](https://soliditylang.org)
[![ERC-3643](https://img.shields.io/badge/token-ERC--3643-orange.svg)](https://eips.ethereum.org/EIPS/eip-3643)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🧠 What is IntelliStake?

**IntelliStake** is a permission-controlled, AI-governed, decentralised investment platform that enables crowd-funded investing in Indian tech startups. It integrates four engineering disciplines under a unified **R.A.I.S.E. framework** (Risk-AI-Investment-Security-Escrow):

| Domain | Module | Core Technology |
|---|---|---|
| **AI / ML** | Startup Valuation Engine | XGBoost + LightGBM Ensemble |
| **Finance** | Portfolio Optimizer | Black-Litterman Posterior |
| **Cybersecurity / Risk** | R.A.I.S.E. Risk Auditor | VADER OSINT + GitHub Velocity |
| **Blockchain** | ERC-3643 Token + Oracle Bridge | Solidity + Chainlink-style Oracle |

The platform handles the full investment lifecycle: from AI-driven due diligence and valuation, through fund allocation and portfolio construction, to on-chain permissioned tokenised securities and milestone-gated escrow releases.

---

## 🗺️ Project Phases — Completed Work

### ✅ Phase 1 — AI & Data Engineering

The first phase built the data foundation and AI intelligence layer.

**Data Scraping & Ingestion:**
- Scraped **50,000 Indian startup records** across 6 data sources: MCA government filings, GitHub API (commit velocity, stars, contributors), SimilarWeb (web traffic and MoM growth), news RSS feeds (Inc42, YourStory, TechCrunch, ET, VCCircle), LinkedIn pedigree scores, and blockchain wallet registries.
- Built a 5-layer data pipeline: raw ingest → cleaning → enrichment → knowledge graph → output artifacts.

**Knowledge Graph (3.2 Million Data Points):**
- Synthesised all sources into a **master graph** stored in Parquet format: `intellistake_master_graph.parquet`
- Each of the 50,000 startup nodes carries **64 features** spanning financial ratios, technical velocity, sentiment signals, and founder pedigree.
- Assembled using Dask for multi-core parallelism and `fuzzywuzzy` entity resolution (threshold: 88) to deduplicate cross-source company names.

**Valuation Engine v1:**
- XGBoost + LightGBM ensemble trained on 6 features with 5-fold cross-validation.
- Log-normal targets to handle right-skewed startup valuations.

**Risk Auditor v1:**
- Composite trust score = 55% GitHub Velocity + 25% Founder Pedigree + 20% Market Traction.
- Triggers `freezeMilestoneFunding()` when `trust_score < 0.35` or `risk_severity == HIGH`.

**Sentiment OSINT:**
- VADER sentiment analysis on 5,000 scraped news mentions across 8 RSS feeds.
- Produced `sentiment_scores.parquet` covering Market Confidence Index (MCI) for 103 startups.

**Fraud Detection:**
- Isolation Forest anomaly detection to flag suspicious financial patterns in startup records.

---

### ✅ Phase 2A — Finance Domain

**Black-Litterman Portfolio Optimizer (`engine/portfolio_optimizer.py`):**

Implemented the correct mathematical form of the Black-Litterman model:

```
μ_BL = [(τΣ)⁻¹ + PᵀΩ⁻¹P]⁻¹ · [(τΣ)⁻¹π + PᵀΩ⁻¹Q]
```

- **π** = equilibrium returns derived from market-cap priors
- **Q** = AI-generated views (trust score → expected return uplift)
- **Ω** = uncertainty matrix based on R.A.I.S.E. trust score confidence
- **P/Q matrices** properly constructed from the top-30 startups by trust rank

Portfolio constraints:
- Sector cap: **35%** max allocation to any single sector
- Country cap: **60%** max allocation to any single geography
- Candidate pool: top-30 trust-ranked startups from the knowledge graph

Financial risk metrics computed:
- **Sharpe Ratio**: 0.9351 (BL Portfolio v2)
- **Sortino Ratio**: 1.24 (downside-adjusted)
- **Max Drawdown**: −7.44% (from 10,000 Monte Carlo stress paths)
- **Expected Annual Return**: 22.4% | **Portfolio Volatility**: 18.7%

Output artefacts: `unified_data/outputs/final_portfolio_weights.json`, `final_portfolio_recommendations.json`, `investment_recommendations.csv`

---

### ✅ Phase 2B — Blockchain Domain

Three Solidity smart contracts deployed under `blockchain/contracts/`:

| Contract | Standard | Role |
|---|---|---|
| `IntelliStakeToken.sol` | ERC-3643 (T-REX) | Permissioned investment security token with KYC whitelist and transfer restriction enforcement |
| `ComplianceRules.sol` | ERC-3643 | On-chain AML/KYC rule engine — blocks transfers to non-registered or non-accredited wallets |
| `MilestoneEscrow.sol` | Custom | 4-tranche milestone escrow — releases USDC only after oracle confirms trust score ≥ 0.50 |
| `TrustOracle.sol` | Chainlink-style | Off-chain R.A.I.S.E trust score → on-chain push every 90 days, signed by IntelliStake authority |
| `IntelliStakeOracle.js` | Node.js | Oracle node script (Chainlink-inspired); signs `(startup_id, trust_score, timestamp)` with private key |

**Oracle Architecture (4-step flow):**
1. R.A.I.S.E Audit: Risk Auditor computes composite trust score across all startups (16 parallel workers).
2. Authority Sign: IntelliStake backend signs payload with private key.
3. On-Chain Push: Signed payload submitted to `TrustOracle.sol` via `ethers.js`. EIP-1559 gas optimised.
4. Escrow Verify: `MilestoneEscrow.sol` verifies `signer == ORACLE_AUTHORITY` before releasing tranche.

**KYC Identity Registry:**
- 1,247 registered wallets · 1,189 KYC verified · 934 accredited investors · 58 restricted/locked.
- `oracle_bridge.py` (dry-run, no node needed) and `oracle_bridge_full.py` (full web3.py flow with Hardhat/Anvil) both provided.
- Hardhat test suite: **10 test cases** covering token minting, transfer restrictions, escrow tranche release, and oracle freeze scenarios.

---

### ✅ Phase 2C — Performance Optimization v2

All engine modules were refactored for production-level performance:

**Valuation Engine v2 (`engine/valuation_engine.py`):**
- `log1p` target transform to handle valuation skew.
- **8+ features** added (vs 6 in v1): `trust_score`, `sentiment_compound`, `web_monthly_visits`.
- Early stopping on XGBoost (best iteration tracked and persisted).
- 5-fold stratified cross-validation.
- Model persistence: trained models saved to disk to avoid retraining.
- **R² improved**: XGBoost 0.9156 · LightGBM 0.9089 · **Ensemble 0.9212**

**Risk Auditor v2 (`engine/risk_auditor.py`):**
- VADER SentimentIntensityAnalyzer instantiated at module level (singleton) → per-call overhead reduced from ~3ms to ~0.001ms.
- Parallelised across **16 worker threads** using `ThreadPoolExecutor`.
- GitHub live fetch bug fixed (API auth header corrected).
- Daily cache added to avoid redundant audits within same pipeline run.

**Portfolio Optimizer v2 (`engine/portfolio_optimizer.py`):**
- Corrected BL posterior formula (prior versions used simplified approximation).
- Sector and country diversification caps enforced at solving time.

**Live Audit Agent v2 (`engine/live_audit_agent.py`):**
- **Parallel RSS fetching** via `ThreadPoolExecutor` with 6 workers — all feeds fetched simultaneously (~5× faster than serial).
- `urllib3.Retry` with 3 attempts and 2/4/8s exponential backoff on HTTP 429/503/504.
- `requests.Session` with `HTTPAdapter(pool_maxsize=20)` — TCP connection reuse.
- Finance-specific VADER keyword expansion: **33 positive / 31 negative** terms (e.g., insolvency, oversubscribed, NCLT, delisted).

**Data Scaling Engine (`data_scaling_engine/`):**
- `sentiment_harvester.py` — RSS + Reddit VADER sentiment (8 feeds).
- `mca_audit_pipeline.py` — MCA/Tofler API financial integrity audit (199 audits, 140 anomalies flagged).
- `github_velocity_aggregator.py` — Async GitHub commit velocity (aiohttp).
- `master_knowledge_graph.py` — Dask multi-source graph synthesizer.

---

## 📊 Data Lake Summary

```
IntelliStake_Final/
│
├── 📂 unified_data/                  ← 403 MB structured data lake
│   ├── raw/                          ← Original high-volume raw files
│   │   ├── github_repositories.json      (150k repos · 57 MB)
│   │   ├── intellistake_risk_signals.json (200k signals · 110 MB)
│   │   ├── intellistake_startups.json     (50k startups · 62 MB)
│   │   └── startup_valuation_*.json/csv   (XGBoost training data)
│   │
│   ├── cleaned/                      ← De-duped, schema-validated datasets
│   │   ├── intellistake_startups_clean.json      (50,000 × 28 fields · 52 MB)
│   │   ├── intellistake_risk_signals_clean.json  (71,740 signals · 26 MB)
│   │   ├── github_repositories_clean.json        (4,081 repos)
│   │   └── real_funding_data.json               (46,809 funding rounds)
│   │
│   ├── knowledge_graph/              ← 3.2 Million data point master graph
│   │   ├── intellistake_master_graph.parquet  (50k × 64 features)
│   │   └── intellistake_master_graph.csv
│   │
│   ├── enriched/                     ← Derived signal streams (Parquet)
│   │   ├── sentiment_mentions_raw.parquet  (5,000 scraped mentions)
│   │   ├── sentiment_scores.parquet        (MCI for 103 startups)
│   │   ├── mca_audit_results.parquet       (199 MCA audits, 140 anomalies)
│   │   └── github_velocity_signals.parquet (50 repos, velocity tiers)
│   │
│   ├── identities/                   ← Investor & oracle identity data
│   │   ├── mock_investors.json       (50 investors: Institutional/Retail/HNI)
│   │   └── oracle_tx_log.json        (Freeze TX simulation log)
│   │
│   └── outputs/                      ← Generated artefacts from pipeline runs
│       ├── final_portfolio_weights.json
│       ├── final_portfolio_recommendations.json
│       └── investment_recommendations.csv
│
├── 📂 engine/                        ← Brain: AI + Finance + Risk
│   ├── valuation_engine.py           XGBoost + LightGBM ensemble (v2)
│   ├── portfolio_optimizer.py        Black-Litterman optimizer (BL v2)
│   ├── risk_auditor.py               Unified R.A.I.S.E. risk audit engine (v2)
│   └── live_audit_agent.py           Parallel RSS + live GitHub audit agent
│
├── 📂 blockchain/                    ← Execution: Smart Contracts + Oracle
│   ├── contracts/
│   │   ├── IntelliStakeToken.sol     ERC-3643 permissioned investment token
│   │   ├── ComplianceRules.sol       KYC/AML compliance enforcement
│   │   ├── MilestoneEscrow.sol       4-tranche milestone escrow contract
│   │   ├── TrustOracle.sol           On-chain oracle receiver contract
│   │   └── IntelliStakeOracle.js     Chainlink-style oracle node
│   ├── oracle_bridge.py              Demo oracle (dry-run, no node needed)
│   └── oracle_bridge_full.py         Full oracle (web3.py + Hardhat/Anvil)
│
├── 📂 data_scaling_engine/           ← 4-module 3.2M-point data pipeline
│   ├── sentiment_harvester.py        RSS + Reddit VADER sentiment (8 feeds)
│   ├── mca_audit_pipeline.py         MCA/Tofler API financial integrity audit
│   ├── github_velocity_aggregator.py Async GitHub commit velocity (aiohttp)
│   └── master_knowledge_graph.py     Dask multi-source graph synthesizer
│
├── 📂 dashboard/                     ← React + Vite interactive dashboard
│   └── src/
│       ├── pages/                    12 interactive dashboard pages
│       ├── components/               Hero, Sidebar, Phase panels, Architecture
│       └── data/mockData.js          Platform metrics, portfolio, risk samples
│
├── 📂 docs/                          ← All project documentation
│   ├── IntelliStake_Walkthrough_Documentation.docx
│   ├── IntelliStake_Progress_Report.docx
│   ├── Integrated_Data_Schema.md
│   └── IntelliStake.pptx
│
├── run_full_pipeline.py              ← 🚀 ONE COMMAND end-to-end demo
└── start_intellistake.py             ← Dashboard launcher helper
```

---

## 📈 Key Metrics at a Glance

| Metric | Value |
|---|---|
| Knowledge Graph Data Points | **3,200,000** (50k × 64 features) |
| Ensemble Valuation R² | **0.9212** (XGBoost + LightGBM) |
| BL Portfolio Sharpe Ratio | **0.9351** |
| BL Portfolio Sortino Ratio | **1.24** |
| Max Drawdown (10k Monte Carlo) | **−7.44%** |
| Trust Score Coverage | **98.6%** of startups audited |
| Total Dataset Records | **~430,000** |
| Total Data Lake Size | **~403 MB** |
| Oracle Transactions Simulated | **1,247** |
| Smart Contract Test Cases | **10** (Hardhat) |
| Registered Investor Wallets | **50** mock (Institutional / HNI / Retail / Non-KYC) |

---

## 🖥️ Interactive Dashboard (Live at `localhost:5173`)

The React + Vite dashboard running at **http://localhost:5173** has **12 fully interactive pages**:

### 🏠 Command Center (Home)
The landing page shows a live platform overview:
- **8 platform KPIs**: 3.2M data points, R² 0.9212, Sharpe 0.9351, Sortino 1.24, Max Drawdown −7.44%, Oracle TXs 1,247, Trust Coverage 98.6%, Token standard ERC-3643.
- **Bar chart**: Top-5 Black-Litterman portfolio allocations (interactive).
- **Live trust score bars**: R.A.I.S.E. scores for 5 startups with colour-coded risk levels.
- Domain summary cards for AI, Finance, and Blockchain features.

### � Risk Auditor
Interactive R.A.I.S.E. auditor showing real computed trust scores:
- **Filter by severity**: NONE 🟢 / LOW 🔵 / MEDIUM 🟡 / HIGH 🔴
- **Search bar** across all startups by name.
- **Detail panel**: click any startup row to expand full breakdown — Technical Velocity (55%), Founder Pedigree (25%), Market Traction (20%) — plus BL Omega multiplier and INVEST / Monitor / Oracle Freeze recommendation.
- Parallelised across 50k startups with 16 worker threads.

### 🧠 Valuation Engine
Interactive AI valuation predictor:
- **Live Predictor** — adjust: Industry (8 sectors), Funding Round (Pre-Seed → Pre-IPO), Revenue, Funding Amount, Trust Score, Sentiment, Monthly Web Visits → click **⚡ Predict Valuation** to get XGBoost, LightGBM, and Ensemble predictions in real-time.
- **Model Performance Cards**: Ensemble R² 0.9212, XGBoost R², LightGBM R², MAE, 8+ features, 5-Fold CV.
- **Feature Importance bar chart** (XGBoost gain): `total_funding` → `revenue` → `trust_score` → `web_monthly_visits` → `sentiment_compound` → `employees` → `age_years`.
- v2 improvements noted: log-transform, 3 new features, 6% MAE reduction vs v1.

### 📊 Portfolio Optimizer (Black-Litterman)
Interactive BL portfolio construction:
- **Pie chart**: current allocation across 8 top-ranked startups.
- **BL Parameter Controls**: adjust τ (Tau, 0.01–0.25) and Risk-Free Rate (2%–12%) and click **🔄 Recompute Portfolio** to see updated Sharpe, Sortino, Expected Return, Volatility, Drawdown.
- **BL Formula** displayed: `μ_BL = [(τΣ)⁻¹ + PᵀΩ⁻¹P]⁻¹ · [(τΣ)⁻¹π + PᵀΩ⁻¹Q]`
- **Holdings Table**: Startup, Sector, Trust Score, BL Upside %, Allocation %, Action (INVEST / WATCH), Risk severity.

### 🎲 Monte Carlo Simulation
52-week portfolio stress testing:
- Select **3, 5, or 8** simulation paths.
- **Re-run Simulation** generates new random growth paths driven by trust-weighted return parameters from the BL posterior each time.
- **Line chart**: all paths plotted over 52 weeks (starting capital configurable: ₹1L–₹100L).
- Metrics per run: Best Path, Mean Path, Worst Path, Max Drawdown.
- Formula: `daily_return ~ N(μ_BL / 252, σ_trust / √252)`.

### 📡 Sentiment OSINT
Live VADER news sentiment analysis:
- **Indexed Headlines** table: headlines from Inc42, YourStory, TechCrunch, ET — with source, compound score, POSITIVE / NEGATIVE / NEUTRAL label. Filter by keyword.
- **Live VADER Analyzer**: paste any headline text → get real-time sentiment score with positive/negative signal extraction.
- **OSINT Engine v2 improvements** listed: VADER Singleton (~0.001ms/call), Parallel RSS (6 workers, 5× faster), Retry + Backoff (3 attempts, 2/4/8s), Session Pooling (pool_maxsize=20), Finance Keywords (33 pos / 31 neg).
- Aggregate stats: headlines indexed, positive count, negative count, average compound score.

### 🪪 KYC / Identity Registry
ERC-3643 on-chain identity management:
- **Wallet Lookup**: enter any Ethereum wallet address → shows KYC status (VERIFIED / PENDING / NOT_FOUND), Accredited Investor status, IST holdings, and wallet status (ACTIVE / RESTRICTED / LOCKED).
- Quick-fill buttons for sample wallets.
- **Registry Table**: all registered wallets with address, entity name, KYC badge, holdings, and status.
- Stats: 1,247 registered wallets · 1,189 KYC verified · 934 accredited · 58 restricted/locked.

### ⛓️ Oracle Bridge
Off-chain → on-chain trust score relay:
- **Oracle Push Simulator**: choose a startup, set trust score (slider 0.1–1.0) → click **📡 Push Trust Score On-Chain** → generates a real-looking TX hash and appends to the event log. Shows RELEASE ELIGIBLE (≥ 0.50) or ORACLE FREEZE (< 0.50) outcome.
- **Architecture steps** displayed: R.A.I.S.E. Audit → Authority Sign → On-Chain Push → Escrow Verify.
- **Oracle Event Log** (live feed): timestamp, startup, trust pushed, action (TRANCHE_RELEASED / ORACLE_FREEZE), TX hash.
- Stats: 90-day cadence · 1,247 total Oracle TXs · 1,189 releases · 58 freezes.

### 🔐 Milestone Escrow
4-tranche fund release contract:
- **Tranche Visualiser**: see each of the 4 tranches (T1/T2/T3/T4) for Zepto and Razorpay with RELEASED / PENDING / LOCKED status and on-chain TX hash.
- **Oracle Trigger Simulator**: select startup + set trust score → trigger TRANCHE RELEASED or ORACLE FREEZE with live TX log output.
- **Smart Contract Architecture cards**: IntelliStakeToken.sol (ERC-3643), MilestoneEscrow.sol (custom), TrustOracle.sol (Chainlink-style).
- Trust threshold: **≥ 0.50** to release; auto-freeze below threshold.

### 🗄️ Data Lake Architecture
Full pipeline layer explorer:
- **5 pipeline layers** (Raw → Cleaned → Enriched → Knowledge Graph → Outputs) with file count, record count, size, and status.
- **6 data source cards**: MCA Filings (50,000), GitHub API (47,200 repos), Web Traffic/SimilarWeb (44,800), News Sentiment (9 sources), LinkedIn Pedigree (38,000), Blockchain Registry (12,470 wallets).
- Stats: 50,000 startups · 64 features · 3.2M graph nodes · 98.6% trust coverage · fuzzy match threshold: 88.

### 🏗️ Architecture
System architecture overview:
- Full end-to-end flow: raw data → knowledge graph → AI engine → BL optimizer → blockchain escrow.
- Component diagram: data sources, pipeline layers, engine modules, smart contracts.

### 🗺️ Project Roadmap
Progress tracker across all phases:
- **Phase 1** (AI & Data Engineering) — ✅ Complete
- **Phase 2A** (Finance Domain) — ✅ Complete
- **Phase 2B** (Blockchain Domain) — ✅ Complete
- **Phase 2C** (Performance Optimization v2) — ✅ Complete
- **Phase 3** (Advanced AI & Explainability: SHAP, FinBERT, backtesting, GNN) — ⏳ Upcoming
- **Phase 4** (Production & Deployment: FastAPI, Polygon/Sepolia testnet, CI/CD) — ⏳ Upcoming
- Overall progress bar with completion percentage displayed dynamically.

---

## 🚀 Quick Start

### Run the Dashboard (Frontend)

```bash
cd IntelliStake_Final/dashboard
npm install
npm run dev
# Open: http://localhost:5173
```

### Run the Full AI Pipeline

```bash
cd IntelliStake_Final

# Option A: One-command end-to-end demo
python run_full_pipeline.py

# Option B: Individual modules
python engine/risk_auditor.py --top-n 500
python engine/portfolio_optimizer.py
python blockchain/oracle_bridge.py --dry-run
```

### Prerequisites

```bash
# Python dependencies
pip install pandas numpy scipy pyarrow vaderSentiment xgboost lightgbm scikit-learn dask aiohttp

# Optional — live oracle (requires Hardhat/Anvil node running)
pip install web3

# Node.js / frontend
cd dashboard && npm install
```

---

## 🔗 End-to-End Pipeline Flow

```
📊 intellistake_master_graph.parquet  (3.2M data points)
          │
          ▼
🔍 engine/risk_auditor.py             (GitHub + Sentiment + Pedigree → Trust Score)
          │
          ├──→ trust ≥ 0.50 ──→  📈 engine/portfolio_optimizer.py (BL → allocation weights)
          │                               │
          │                               ▼
          │                      📄 outputs/final_portfolio_weights.json
          │
          └──→ trust < 0.35  ──→ 🔒 blockchain/oracle_bridge.py
                                         │
                                         ▼
                               freezeMilestoneFunding() on-chain (ERC-3643)
```

---

## 🛡️ R.A.I.S.E. Risk Framework

| Signal | Weight | Source Dataset |
|---|---|---|
| Technical Velocity (GitHub commits, stars) | **55%** | `github_velocity_signals.parquet` |
| Founder Pedigree (KYC, prior exits, education) | **25%** | `intellistake_startups_clean.json` |
| Market Traction (Sentiment + Web Traffic) | **20%** | `sentiment_scores.parquet` |

**Trust score interpretation:**

| Trust Score | Severity | Oracle Action |
|---|---|---|
| ≥ 0.70 | NONE 🟢 | Invest — escrow tranche released |
| 0.50–0.70 | LOW 🔵 | Invest with monitoring |
| 0.35–0.50 | MEDIUM 🟡 | Watchlist — no new tranches |
| < 0.35 | HIGH 🔴 | `freezeMilestoneFunding()` called on-chain |

---

## 🏗️ Smart Contract Reference

| Contract | Standard | Purpose |
|---|---|---|
| `IntelliStakeToken.sol` | ERC-3643 (T-REX) | Permissioned security token; KYC whitelist, transfer restriction |
| `ComplianceRules.sol` | ERC-3643 | On-chain AML/KYC rule enforcement |
| `MilestoneEscrow.sol` | Custom | 4-tranche milestone release; verifies oracle signature |
| `TrustOracle.sol` | Chainlink-style | On-chain oracle receiver (signed trust score pushed every 90 days) |
| `IntelliStakeOracle.js` | Node.js | Oracle node — signs `(startup_id, trust_score, timestamp)` |

---

## 👥 Investor Registry (Mock Data)

50 diverse investor profiles across 4 tiers:

| Tier | Count | Examples |
|---|---|---|
| Institutional | 13 | Sequoia India, SoftBank, a16z India, Kalaari Capital |
| Accredited HNI | 12 | Indian / UAE / UK / Egyptian high-net-worth individuals |
| Retail (KYC Verified) | 12 | Mumbai, Delhi, Bengaluru, Jaipur retail investors |
| Non-KYC (Unverified) | 8 | Flagged for AML screening — wallet locked on-chain |

---

## 📅 Roadmap — What's Next

| Phase | Status | Work |
|---|---|---|
| **Phase 3** | ⏳ Upcoming | SHAP explainability, FinBERT, backtesting engine, ReportLab investment memo, GNN co-investor graph |
| **Phase 4** | ⏳ Upcoming | FastAPI REST backend, Polygon / Ethereum Sepolia testnet deployment, GitHub Actions CI/CD, SEBI compliance docs |

---

## 📚 Documentation

| Document | Description |
|---|---|
| `docs/IntelliStake_Walkthrough_Documentation.docx` | Full technical walkthrough of all modules |
| `docs/IntelliStake_Progress_Report.docx` | Capstone progress report |
| `docs/Integrated_Data_Schema.md` | Complete schema for all datasets and the knowledge graph |
| `docs/IntelliStake.pptx` | Capstone presentation deck |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| AI / ML | Python 3.11, XGBoost, LightGBM, scikit-learn, VADER, Isolation Forest |
| Data Engineering | Pandas, Dask, PyArrow, aiohttp, fuzzywuzzy, NetworkX |
| Finance | scipy (matrix algebra), NumPy (BL posterior, Monte Carlo) |
| Blockchain | Solidity 0.8.x, OpenZeppelin, Hardhat, ethers.js, web3.py |
| Frontend | React 18, Vite 7, Chart.js (react-chartjs-2), Vanilla CSS |
| Dev Tools | Git, GitHub, VS Code, Python venv |

---

*NMIMS School of Technology Management & Engineering — MCA Capstone 2025–26*
