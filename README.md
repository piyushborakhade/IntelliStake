# IntelliStake

**AI-Governed Crowd-Venture Investment Platform for Indian Startups**

> NMIMS MCA Capstone 2025–26 · Final Submission

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![React + Vite](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb.svg)](https://vitejs.dev)
[![Solidity 0.8.x](https://img.shields.io/badge/solidity-0.8.x-363636.svg)](https://soliditylang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Overview

IntelliStake is a full-stack investment platform that combines AI/ML valuation, portfolio optimisation, on-chain compliance, and a real-time investor dashboard. It is built around the **R.A.I.S.E. framework** (Risk · AI · Investment · Security · Escrow) and targets the Indian startup ecosystem.

The platform handles the full investment lifecycle:

1. **Data ingestion** — 50,000+ startup records from MCA filings, GitHub, SimilarWeb, news feeds, LinkedIn, and blockchain registries
2. **AI due diligence** — stacked ensemble valuation + SHAP explainability + survival analysis
3. **Portfolio construction** — Black-Litterman + Hierarchical Risk Parity allocation
4. **On-chain execution** — ERC-3643 permissioned token, KYC registry, milestone escrow, oracle bridge
5. **Live monitoring** — real-time anomaly detection, NLP sentiment, compliance tracker, war-room alerts

---

## Repository Structure

```
IntelliStake_Final/
│
├── engine/                     # Python backend (FastAPI + all AI modules)
│   ├── server.py               # FastAPI app — start here
│   ├── routes/                 # Admin, user, public REST routes
│   ├── services/               # Business logic (lens, simulation)
│   ├── api/                    # Internal API wrappers
│   ├── ml/                     # Model trainer utilities
│   ├── security/               # JWT auth + compliance checks
│   ├── valuation_engine.py     # XGB + LGB + CatBoost base models
│   ├── valuation_stacked.py    # AutoGluon meta-stacker
│   ├── trust_score_ml.py       # R.A.I.S.E. composite trust score
│   ├── risk_auditor.py         # Full risk audit pipeline
│   ├── survival_analysis.py    # CoxPH runway estimation
│   ├── portfolio_optimizer.py  # Black-Litterman allocation
│   ├── portfolio_hrp.py        # Hierarchical Risk Parity
│   ├── chatbot_api.py          # RAG chatbot (GPT-4 + vector store)
│   ├── finbert_sentiment.py    # FinBERT news sentiment
│   ├── hype_detector.py        # IsolationForest anomaly detection
│   ├── investor_network.py     # Graph-based co-investor analysis
│   ├── memo_generator.py       # AI investment memo generation
│   └── ...                     # 20+ additional AI modules
│
├── dashboard/                  # React 18 + Vite frontend
│   └── src/
│       ├── pages/              # 40+ page components
│       ├── components/         # Reusable UI (AppShell, WarRoom, etc.)
│       ├── hooks/              # useApi, useTheme, useWatchlist, etc.
│       ├── context/            # Auth, App, Lens contexts
│       ├── utils/              # Supabase client, contract helpers
│       └── styles/             # CSS tokens, themes, animations
│
├── blockchain/                 # Solidity smart contracts + oracle
│   ├── contracts/
│   │   ├── IntelliStakeToken.sol       # ERC-3643 security token
│   │   ├── IntelliStakeInvestment.sol  # Investment intake + issuance
│   │   ├── MilestoneEscrow.sol         # Milestone-gated fund release
│   │   ├── IdentityRegistry.sol        # KYC/AML whitelist
│   │   ├── ComplianceRules.sol         # Transfer restrictions
│   │   └── TrustOracle.sol             # On-chain AI trust score feed
│   ├── scripts/
│   │   ├── deploy.js           # Deploy all contracts
│   │   ├── seed_deals.js       # Seed demo investment deals
│   │   └── demo_all_transactions.js
│   ├── oracle_bridge.py        # Push AI scores → TrustOracle.sol
│   └── hardhat.config.js
│
├── data_scaling_engine/        # 4-module data ingestion pipeline
│   ├── mca_audit_pipeline.py          # MCA government filing scraper
│   ├── github_velocity_aggregator.py  # GitHub commit velocity signals
│   ├── sentiment_harvester.py         # News + social OSINT harvester
│   └── master_knowledge_graph.py      # 3.2M-point knowledge graph builder
│
├── models/                     # Trained ML model artifacts
│   ├── xgb_valuation.pkl
│   ├── lgb_valuation.pkl
│   ├── catboost_valuation.cbm
│   ├── meta_stacker_v5.pkl
│   ├── mlp_stacker.pkl
│   ├── isolation_forest_hype.pkl
│   ├── features_v5.pkl
│   └── autogluon/              # AutoGluon predictor artifacts
│
├── unified_data/               # Processed pipeline data
│   ├── raw/                    # Raw scraped data (large files gitignored)
│   ├── cleaned/                # Cleaned startup datasets
│   ├── enriched/               # Parquet enrichment outputs
│   ├── 4_production/           # Live AI scores, model outputs, signals
│   ├── external_data/          # India unicorns, enrichment summaries
│   ├── identities/             # Mock investor identities
│   ├── knowledge_graph/        # Master graph (CSV + Parquet)
│   ├── outputs/                # Final portfolio weights + recommendations
│   └── real/                   # Real Indian startup data
│
├── scripts/                    # Utility and enrichment scripts
│   ├── enrich_*.py             # Data enrichment pipeline scripts
│   ├── import_datapool_to_supabase.py
│   ├── benchmark_comparison.py
│   ├── bootstrap_auc_ci.py
│   └── wire_nlp_to_trust.py
│
├── supabase/
│   ├── schema.sql              # Full PostgreSQL schema
│   └── README.md               # Supabase setup guide
│
├── tests/
│   ├── test_api_smoke.py       # API endpoint smoke tests
│   └── test_ai_endpoints.py    # AI model endpoint tests
│
├── docs/                       # Project documentation
│   ├── IntelliStake.pptx                    # Presentation deck
│   ├── IntelliStake_IEEE_Report.docx        # IEEE-format paper
│   ├── IntelliStake_Project_Documentation.docx
│   ├── IntelliStake_Walkthrough_Documentation.docx
│   ├── Integrated_Data_Schema.md
│   ├── Technical_Roadmap.md
│   ├── PROGRESS_REPORT.md
│   └── feature_importance.png
│
├── start_intellistake.py       # Main launcher (backend + checks)
├── run_full_pipeline.py        # Run complete data + AI pipeline
├── run_pipeline.py             # Run individual pipeline phase
├── requirements.txt
├── .env.example                # Environment variable template
├── Dockerfile
├── docker-compose.yml
└── DEMO_SCRIPT.md              # Step-by-step demo walkthrough
```

---

## AI / ML Models

### Valuation Ensemble

| Model | Type | Purpose |
|---|---|---|
| XGBoost | Gradient-boosted trees | Base valuation learner |
| LightGBM | Histogram GBDT | Base valuation learner |
| CatBoost | Categorical-aware GBDT | Base valuation learner |
| AutoGluon | Meta-learner | Stacks base models |
| MLP Stacker | Neural blender | Final ensemble output |

All models are trained on 64 startup features including: revenue, founder pedigree, GitHub velocity, sentiment score, sector growth, MCA compliance, and 58 others.

### Risk & Signal Models

| Model | Purpose |
|---|---|
| IsolationForest | Hype anomaly detection |
| CoxPH Survival | Runway / time-to-failure estimation |
| FinBERT | News and social sentiment scoring |
| VADER | Real-time OSINT sentiment |
| CLIP (ViT-B/32) | Zero-shot sector classification |
| Black-Litterman | VC-views portfolio optimisation |
| HRP | Hierarchical Risk Parity allocation |

### Evaluation (Honest Held-Out Metrics)

| Metric | Value |
|---|---|
| Valuation MAE | ~$2.4M |
| Valuation MAPE | ~14.2% |
| AUC (risk classification) | 0.87 |
| Trust Score Precision | 0.83 |

> **Why MAPE?** Startup valuations span several orders of magnitude ($500K to $50B+). MAPE is scale-invariant, so 14.2% means the same thing whether the startup is valued at $1M or $1B. MAPE (not MAE alone) is the primary headline metric for this reason.

---

## Blockchain Contracts

| Contract | Function |
|---|---|
| `IntelliStakeToken.sol` | ERC-3643 permissioned security token |
| `IntelliStakeInvestment.sol` | Investment intake and token issuance |
| `MilestoneEscrow.sol` | Milestone-gated fund release |
| `IdentityRegistry.sol` | KYC/AML identity whitelist |
| `ComplianceRules.sol` | Transfer restriction enforcement |
| `TrustOracle.sol` | On-chain trust score feed |

The **Oracle Bridge** (`blockchain/oracle_bridge.py`) reads the AI trust scores after each pipeline run and pushes them to `TrustOracle.sol` on-chain, closing the loop between the AI engine and the smart contracts.

Deployment addresses are stored in `blockchain/deployment.json`.

---

## Dashboard Pages

| Page | What it does |
|---|---|
| Login / Onboarding | Auth + KYC onboarding wizard |
| Discover | Browse and filter 50,000 startup cards |
| Startup Profile | Full AI scorecard, survival curve, team |
| Risk Assessment | R.A.I.S.E. audit report with breakdown |
| Invest | One-click blockchain investment modal |
| Holdings | Portfolio tracker with live P&L |
| Portfolio Monitor | Black-Litterman weights + HRP chart |
| War Room | Live oracle feed, anomaly alerts |
| Benchmark | Model accuracy comparison |
| RAG Chatbot | AI Q&A over the startup knowledge base |
| Data Explorer | Raw data table with filters |
| Model Hub | Switch active valuation model |
| SHAP Explainer | Interactive feature importance |
| Hype Detector | Anomaly flag dashboard |
| Sentiment Terminal | Live NLP sentiment feed |
| Backtest | Historical performance simulation |
| Admin | User management + compliance flags |

---

## Quick Start

### Requirements
- Python 3.11+
- Node.js 18+
- Supabase project (or local Docker)

### 1. Clone and set up Python

```bash
git clone https://github.com/piyushborakhade/IntelliStake.git
cd IntelliStake
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your keys (see table below)
```

### 3. Start the backend

```bash
python start_intellistake.py
# FastAPI docs at http://localhost:8000/docs
```

### 4. Start the dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:5173
```

### 5. (Optional) Local blockchain

```bash
cd blockchain
npm install
npx hardhat node                              # local chain on port 8545
npx hardhat run scripts/deploy.js --network localhost
python oracle_bridge.py                       # push AI scores on-chain
```

### 6. Docker (all-in-one)

```bash
docker-compose up --build
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (backend only) |
| `OPENAI_API_KEY` | GPT-4 for RAG chatbot and memo generation |
| `GITHUB_TOKEN` | GitHub API for velocity enrichment |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint |
| `PRIVATE_KEY` | Deployer wallet private key |

See `.env.example` for the full list with descriptions.

---

## Running the Data Pipeline

```bash
# Full pipeline (all 5 phases)
python run_full_pipeline.py

# Individual phase
python run_pipeline.py --phase 1   # MCA ingestion
python run_pipeline.py --phase 2   # GitHub velocity
python run_pipeline.py --phase 3   # NLP sentiment
python run_pipeline.py --phase 4   # Knowledge graph
python run_pipeline.py --phase 5   # AI scoring
```

Pipeline outputs land in `unified_data/4_production/`.

---

## Running Tests

```bash
pytest tests/ -v
```

---

## Project Info

**NMIMS University Mumbai — MBA Tech AI Department**
Capstone Project 2025–26

**License:** MIT
