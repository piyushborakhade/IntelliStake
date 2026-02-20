# IntelliStake — Final Submission Repository

> **AI-Vetted Crowd-Venture Platform — NMIMS MCA Capstone 2025–26**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![Solidity 0.8.x](https://img.shields.io/badge/solidity-0.8.x-363636.svg)](https://soliditylang.org)
[![React + Vite](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb.svg)](https://vitejs.dev)
[![ERC-3643](https://img.shields.io/badge/token-ERC--3643-orange.svg)](https://eips.ethereum.org/EIPS/eip-3643)

---

## 🧠 What is IntelliStake?

IntelliStake is a permission-controlled, AI-governed, decentralised investment platform that enables crowd-funded investing in Indian tech startups through a **4-domain R.A.I.S.E. framework**:

| Domain | Module | Technology |
|---|---|---|
| **AI / ML** | Startup Valuation Engine (XGBoost) | `engine/valuation_engine.py` |
| **Finance** | Black-Litterman Portfolio Optimizer | `engine/portfolio_optimizer.py` |
| **Cybersecurity** | R.A.I.S.E. Risk Auditor | `engine/risk_auditor.py` |
| **Blockchain** | ERC-3643 Token + Oracle Bridge | `blockchain/contracts/` |

---

## 📂 Data Lake Architecture

```
IntelliStake_Final/
│
├── 📂 unified_data/                  ← 403 MB structured data lake
│   ├── raw/                          ← Original high-volume raw files
│   │   ├── github_repositories.json      (150k repos)
│   │   ├── intellistake_risk_signals.json (200k signals)
│   │   ├── intellistake_startups.json     (50k startups, raw)
│   │   └── startup_valuation_*.json/csv   (XGBoost training data)
│   │
│   ├── cleaned/                      ← De-duped, schema-validated datasets
│   │   ├── intellistake_startups_clean.json  (50,000 × 28 fields)
│   │   ├── intellistake_risk_signals_clean.json (71,740 signals)
│   │   ├── github_repositories_clean.json    (4,081 repos)
│   │   └── real_funding_data.json            (46,809 funding rounds)
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
│   ├── valuation_engine.py           XGBoost valuation predictor
│   ├── portfolio_optimizer.py        Black-Litterman optimizer (demo)
│   └── risk_auditor.py               Unified R.A.I.S.E. risk audit engine
│
├── 📂 blockchain/                    ← Execution: Smart Contracts + Oracle
│   ├── contracts/
│   │   ├── IntelliStakeToken.sol     ERC-3643 permissioned investment token
│   │   ├── ComplianceRules.sol       KYC/AML compliance enforcement
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
├── 📂 dashboard/                     ← React + Vite frontend
│   └── src/components/               Hero, Finance, Blockchain, Oracle tabs
│
├── 📂 docs/                          ← All project documentation
│   ├── IntelliStake_Walkthrough_Documentation.docx
│   ├── IntelliStake_Progress_Report.docx
│   ├── Integrated_Data_Schema.md
│   └── IntelliStake.pptx
│
├── organize_data_lake.py             ← Refactoring / re-organizer script
├── data_lake_manifest.json           ← Auto-generated file inventory
└── run_full_pipeline.py              ← 🚀 ONE COMMAND end-to-end demo
```

---

## 🚀 Quick Start — Full Demo Loop

```bash
cd IntelliStake_Final

# Option A: Full end-to-end pipeline (recommended for demo)
python run_full_pipeline.py

# Option B: Step-by-step
python engine/risk_auditor.py --top-n 500
python engine/portfolio_optimizer.py
python blockchain/oracle_bridge.py --dry-run
```

### Prerequisites

```bash
pip install pandas numpy scipy pyarrow vaderSentiment
# Optional for live oracle:
pip install web3
```

---

## 📊 Data Scale Summary

| Dataset | Rows | Size |
|---|---|---|
| Raw GitHub Repositories | 150,000 | 57 MB |
| Raw Risk Signals | 200,000 | 110 MB |
| Raw Startups | 50,000 | 62 MB |
| Cleaned Startups | 50,000 | 52 MB |
| Cleaned Risk Signals | 71,740 | 26 MB |
| **Master Knowledge Graph** | **50,000 × 64 features** | **= 3.2M data points** |
| Sentiment Mentions | 5,000 | 2 MB |
| MCA Audit Results | 199 | 25 KB |
| **TOTAL** | **~430,000 records** | **~403 MB** |

---

## 🔗 End-to-End Demo Loop

```
📊 intellistake_master_graph.parquet  (3.2M data points)
          │
          ▼
🔍 engine/risk_auditor.py             (GitHub + Sentiment + Pedigree → Trust Score)
          │
          ▼  LOW TRUST / HIGH RISK detected
          │
🔒 blockchain/oracle_bridge.py        (freezeMilestoneFunding → ERC-3643)
          │
          ▼
📈 engine/portfolio_optimizer.py      (Black-Litterman → optimal allocation)
          │
          ▼
📄 unified_data/outputs/              (portfolio JSON, oracle TX log)
```

---

## 🛡️ Risk Framework (R.A.I.S.E.)

| Signal | Weight | Source |
|---|---|---|
| Technical Velocity (GitHub) | 55% | `github_velocity_signals.parquet` |
| Founder Pedigree (KYC/Accreditation) | 25% | `intellistake_startups_clean.json` |
| Market Traction (Sentiment + Traffic) | 20% | `sentiment_scores.parquet` |

**Freeze trigger:** `trust_score < 0.35` OR `risk_severity == HIGH` → `freezeMilestoneFunding()` called on-chain.

---

## 🏗️ Smart Contracts

| Contract | Standard | Purpose |
|---|---|---|
| `IntelliStakeToken.sol` | ERC-3643 | Permissioned investment token with KYC gates |
| `ComplianceRules.sol` | ERC-3643 | On-chain AML/KYC rule enforcement |
| `IntelliStakeOracle.js` | Chainlink-style | Off-chain AI signal relay to blockchain |

---

## 👥 Investors (Mock Data)

50 diverse investor profiles across 4 tiers:

| Tier | Count | Examples |
|---|---|---|
| Institutional | 13 | Sequoia India, SoftBank, a16z India, Kalaari |
| Accredited HNI | 12 | Indian / UAE / UK / Egyptian high-net-worth |
| Retail (KYC verified) | 12 | Mumbai, Delhi, Bengaluru, Jaipur residents |
| Non-KYC (Unverified) | 8 | Flagged for AML screening |

---

*NMIMS School of Technology Management & Engineering — MCA Capstone 2025–26*
