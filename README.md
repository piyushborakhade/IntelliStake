# IntelliStake — AI-Governed Crowd-Venture Investment Platform

> **NMIMS MCA Capstone 2025–26 · Final Submission**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![React + Vite](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb.svg)](https://vitejs.dev)
[![Solidity 0.8.x](https://img.shields.io/badge/solidity-0.8.x-363636.svg)](https://soliditylang.org)
[![ERC-3643](https://img.shields.io/badge/token-ERC--3643-orange.svg)](https://eips.ethereum.org/EIPS/eip-3643)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## What is IntelliStake?

**IntelliStake** is a permissioned, AI-governed, decentralised investment platform for crowd-funded investing in Indian tech startups. It unifies four engineering disciplines under the **R.A.I.S.E. framework** (Risk · AI · Investment · Security · Escrow):

| Domain | Module | Technology |
|---|---|---|
| AI / ML | Startup Valuation Engine | XGBoost + LightGBM + CatBoost Ensemble |
| Finance | Portfolio Optimizer | Black-Litterman + HRP |
| Cybersecurity / Risk | R.A.I.S.E. Risk Auditor | VADER OSINT + GitHub Velocity + CoxPH Survival |
| Blockchain | ERC-3643 Token + Oracle Bridge | Solidity 0.8.x + Chainlink-style Oracle |
| Frontend | Investor Dashboard | React 18 + Vite + TailwindCSS |

---

## Repository Structure

```
IntelliStake_Final/
├── engine/                     # Core AI/ML/Risk Python modules
│   ├── server.py               # FastAPI application entry point
│   ├── api/                    # REST route handlers
│   ├── services/               # Business logic layer
│   ├── ml/                     # Valuation models + stacking
│   ├── routes/                 # Feature-specific API routes
│   └── security/               # Auth + compliance checks
├── dashboard/                  # React frontend
│   ├── src/
│   │   ├── pages/              # Full-page views (20+ pages)
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── utils/              # Supabase client + helpers
│   └── public/                 # Static assets
├── blockchain/                 # Solidity smart contracts + oracle
│   ├── contracts/              # 6 smart contracts
│   ├── scripts/                # Deploy + seed + demo scripts
│   └── hardhat.config.js
├── models/                     # Trained ML model artifacts
├── unified_data/               # Processed data pipeline outputs
│   ├── cleaned/                # Clean startup datasets
│   ├── 4_production/           # Live AI scores + model outputs
│   ├── outputs/                # Portfolio weights + recommendations
│   └── external_data/          # Enriched third-party data
├── data_scaling_engine/        # 4-module data ingestion pipeline
├── scripts/                    # Utility + enrichment scripts
├── supabase/                   # Database schema (PostgreSQL)
├── tests/                      # Pytest test suite
├── docs/                       # Technical documentation
├── .github/workflows/          # GitHub Actions CI
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Architecture Overview

```
Data Sources → Data Scaling Engine → Knowledge Graph (3.2M points)
                                              ↓
                          AI Valuation Engine (XGB + LGB + CatBoost + AutoGluon)
                                              ↓
              ┌───────────────────────────────────────────────────┐
              │              FastAPI Backend (engine/)             │
              │  Risk Auditor · Portfolio Optimizer · RAG Chatbot  │
              │  SHAP Explainer · FinBERT NLP · Survival Analysis  │
              └──────────────────────┬────────────────────────────┘
                                     │
              ┌──────────────────────▼────────────────────────────┐
              │              React Dashboard                        │
              │  Discover · Profile · Invest · Holdings · WarRoom  │
              └──────────────────────┬────────────────────────────┘
                                     │
              ┌──────────────────────▼────────────────────────────┐
              │         Blockchain Layer (Hardhat + Ethers.js)     │
              │  IntelliStakeToken (ERC-3643) · MilestoneEscrow    │
              │  IdentityRegistry · ComplianceRules · TrustOracle  │
              └───────────────────────────────────────────────────┘
```

---

## AI/ML Models

### Valuation Stack (Stacked Ensemble)
| Model | Role | Features |
|---|---|---|
| XGBoost | Base learner — gradient-boosted trees | 64 startup features |
| LightGBM | Base learner — fast histogram GBDT | 64 startup features |
| CatBoost | Base learner — categorical-aware GBDT | 64 startup features |
| AutoGluon | Meta-learner orchestrator | Stacks XGB + LGB + CB |
| MLP Stacker | Final blender | Out-of-fold predictions |

### Risk & Signal Models
| Model | Purpose |
|---|---|
| **IsolationForest** | Hype anomaly detection (valuation vs traction mismatch) |
| **CoxPH Survival** | Time-to-failure / runway estimation |
| **FinBERT NLP** | News + social sentiment scoring |
| **CLIP (ViT-B/32)** | Zero-shot sector classification from logos/descriptions |
| **VADER** | Real-time OSINT sentiment on startup mentions |
| **Black-Litterman** | Portfolio weight optimisation (VC views overlay) |
| **Hierarchical Risk Parity (HRP)** | Diversification-aware allocation |

### Key Metrics (Honest Eval on Held-Out Set)
| Metric | Value |
|---|---|
| Valuation MAE | ~$2.4M |
| Valuation MAPE | ~14.2% |
| AUC (risk classification) | 0.87 |
| Trust Score Precision | 0.83 |

> MAPE (not MAPE) is used because valuations span several orders of magnitude; MAPE is scale-invariant and directly interpretable as percentage error.

---

## Blockchain Contracts

| Contract | Purpose |
|---|---|
| `IntelliStakeToken.sol` | ERC-3643 permissioned security token |
| `IntelliStakeInvestment.sol` | Investment intake + token issuance |
| `MilestoneEscrow.sol` | Milestone-gated fund releases |
| `IdentityRegistry.sol` | KYC/AML identity whitelisting |
| `ComplianceRules.sol` | Transfer restriction enforcement |
| `TrustOracle.sol` | On-chain trust score feed from AI engine |

The **Oracle Bridge** (`blockchain/oracle_bridge.py`) pushes AI-computed trust scores to `TrustOracle.sol` after each pipeline run, closing the loop between off-chain AI and on-chain enforcement.

---

## Dashboard Pages

| Page | Role |
|---|---|
| Discover | Browse + filter 50,000 startup cards |
| Startup Profile | Full AI scorecard, SHAP explanations, survival curve |
| Risk Assessment | R.A.I.S.E. audit report per startup |
| Invest / InvestModal | One-click blockchain investment flow |
| Holdings | Portfolio tracker with live P&L |
| Portfolio Monitor | Black-Litterman weights + HRP visualisation |
| War Room | Live oracle feed + anomaly alerts |
| Benchmark | Model accuracy comparison dashboard |
| RAG Chatbot | AI Q&A over startup knowledge base |
| Data Explorer | Raw data table + filter |
| Model Hub | Switch active valuation model |
| SHAP Explainer | Interactive feature importance |
| Admin | User management + compliance flags |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account (or local Docker)
- `.env` file from `.env.example`

### 1. Clone & install Python dependencies
```bash
git clone https://github.com/piyushborakhade/IntelliStake.git
cd IntelliStake
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
```

### 3. Start the backend API
```bash
python start_intellistake.py
# FastAPI available at http://localhost:8000
```

### 4. Start the React dashboard
```bash
cd dashboard
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 5. (Optional) Start blockchain node
```bash
cd blockchain
npm install
npx hardhat node          # local chain on port 8545
npx hardhat run scripts/deploy.js --network localhost
```

### 6. Docker (all-in-one)
```bash
docker-compose up --build
```

---

## Data Pipeline

The data pipeline runs in 5 sequential phases via `run_full_pipeline.py`:

```
Phase 1 — Data Ingestion      data_scaling_engine/mca_audit_pipeline.py
Phase 2 — GitHub Enrichment   data_scaling_engine/github_velocity_aggregator.py
Phase 3 — NLP Sentiment       data_scaling_engine/sentiment_harvester.py
Phase 4 — Knowledge Graph     data_scaling_engine/master_knowledge_graph.py
Phase 5 — AI Scoring          engine/valuation_engine.py + trust_score_ml.py
```

Run the full pipeline:
```bash
python run_full_pipeline.py
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Smoke test (API endpoints)
pytest tests/test_api_smoke.py -v

# AI endpoint tests
pytest tests/test_ai_endpoints.py -v
```

---

## Environment Variables

See `.env.example` for all required variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (backend only) |
| `OPENAI_API_KEY` | GPT-4 for RAG chatbot + memo generation |
| `GITHUB_TOKEN` | GitHub API for velocity enrichment |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint |
| `PRIVATE_KEY` | Deployer wallet private key |

---

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Installs Python + Node dependencies
- Runs pytest suite
- Builds the React dashboard

---

## Team

**NMIMS MCA Capstone 2025–26**  
Department of Computer Applications, NMIMS University Mumbai

---

## License

[MIT License](LICENSE)
