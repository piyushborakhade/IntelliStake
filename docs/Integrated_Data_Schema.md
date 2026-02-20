# Integrated Data Schema
## IntelliStake R.A.I.S.E. Intelligence Engine — Phase 2 Data Integration

**Institution**: NMIMS University — MBA (Tech) Capstone, February 2026  
**Authors**: IntelliStake Development Team  
**Status**: Complete ✅

---

## 1. Overview: The R.A.I.S.E. Data Architecture

The IntelliStake R.A.I.S.E. (Risk-Adjusted, AI-Scored, Execution-Verified) framework augments the Phase 1 XGBoost valuation engine with three streams of qualitative intelligence. This document maps each new data point to its downstream impact on the **Black-Litterman portfolio model** and explains why **Execution Data (Data Point 1)** functions as the "Truth Anchor" of the entire system.

```
                     R.A.I.S.E. INTELLIGENCE STACK
 ┌──────────────────────────────────────────────────────────────────┐
 │  Data Point 1 (Truth Anchor)      Data Point 3        Data Point 4│
 │  Execution Signals                Market Traction    Compliance   │
 │  execution_auditor.py             traction_tracker.py  ComplianceRules.sol│
 │  GitHub + LinkedIn                SimilarWeb + NLP   ERC-3643 KYC │
 │       │                                │                  │       │
 │       ▼                                ▼                  ▼       │
 │  Trust_Score [0-1]            Risk Flag (T/F)      KYC Gate (T/F)│
 │  Valuation Multiplier         Ω Adjustment         Transfer Block │
 │       │                                │                  │       │
 │       └────────────────────────────────┘                  │       │
 │                        ▼                                  │       │
 │             XGBoost Adjusted Valuation                    │       │
 │                        │                                  │       │
 │                        ▼                                  │       │
 │             Black-Litterman Model (Q, Ω, w*)              │       │
 │                        │                                  │       │
 │                        ▼                                  │       │
 │             Portfolio Optimizer Output ──────────────────▶│       │
 │                        │                                  │       │
 │                        ▼                                  ▼       │
 │             Chainlink Oracle ──────────────────▶ Smart Contract  │
 │                                                (Token Minting)   │
 └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Data Point → Black-Litterman Mapping

The Black-Litterman formula combines a market equilibrium prior (Π) with investor views (Q) weighted by uncertainty (Ω):

```
E[R] = [(τΣ)⁻¹ + P'Ω⁻¹P]⁻¹ × [(τΣ)⁻¹Π + P'Ω⁻¹Q]
```

The table below shows exactly how each new Phase 2 data point updates the BL parameters.

| Data Point | Source Script | Raw Signal | BL Parameter Affected | Update Mechanism | Effect on Allocation |
|---|---|---|---|---|---|
| **GitHub Commits (90d)** | `execution_auditor.py` | Integer (0–400+) | **Q** (View vector) | High commits → higher growth rate view | ↑ Allocation |
| **Repo Age (months)** | `execution_auditor.py` | Integer (0–72+) | **Ω** (Uncertainty) | Older, stable repo → lower Ω diagonal | ↑ Confidence → ↑ Allocation |
| **Language Diversity** | `execution_auditor.py` | Integer (1–9) | **Q** | Broader stack → higher technical maturity view | ↑ Allocation |
| **Stars / Forks** | `execution_auditor.py` | Integer | **Q** | Proxy for community validation & market pull | ↑ Allocation |
| **Contributors Count** | `execution_auditor.py` | Integer | **Ω** | More contributors → more sustainable team → lower uncertainty | ↑ Allocation |
| **Years of Experience** | `execution_auditor.py` | Integer (0–20+) | **Q** | Deep domain expertise → higher growth view | ↑ Allocation |
| **Previous Exits** | `execution_auditor.py` | Integer (0–5+) | **Ω** | Proven exits → high execution certainty → low Ω | ↑ Confidence → ↑ Allocation |
| **Top Institution** | `execution_auditor.py` | Boolean | **Q** | Elite network signal → higher growth expectation | ↑ Allocation |
| **Prior VC-Backed** | `execution_auditor.py` | Boolean | **Ω** | Institutional validation → reduced perceived risk | ↓ Ω → ↑ Allocation |
| **Trust_Score** | `execution_auditor.py` | Float [0–1] | **Valuation Multiplier** | `Adj_Val = XGBoost × (0.5 + 0.5×Trust)` | Scales base Q views |
| **Monthly Web Visits** | `traction_tracker.py` | Integer | **Q** | High traffic = product-market fit signal | ↑ Allocation |
| **MoM Traffic Change %** | `traction_tracker.py` | Float | **Q + Ω** | Negative growth → lower Q view; also ↑ Ω | ↓ Allocation |
| **Bounce Rate %** | `traction_tracker.py` | Float | **Ω** | High bounce = low stickiness = ↑ Ω | ↓ Allocation |
| **Avg Session Duration** | `traction_tracker.py` | Seconds | **Q** | Longer sessions = deeper engagement | ↑ Allocation |
| **Sentiment Polarity** | `traction_tracker.py` | Float [-1, +1] | **Q** | Positive → higher growth view | ↑ Allocation |
| **Risk Flag (active)** | `traction_tracker.py` | Boolean | **Ω multiplier** | Flag active → Ω × 1.4 to 3.5 | ↓ Allocation |
| **Risk Flag Severity** | `traction_tracker.py` | LOW/MEDIUM/HIGH | **Ω multiplier** | HIGH → Ω × 3.5 freeze | ↓↓ Allocation |
| **KYC_Verified** | `ComplianceRules.sol` | Boolean (on-chain) | **Eligibility Gate** | False → wallet excluded from pool | 0% Allocation |
| **isAccredited** | `ComplianceRules.sol` | Boolean (on-chain) | **Eligibility Gate** | False → wallet excluded from pool | 0% Allocation |
| **Compliance Score** | `ComplianceRules.sol` | uint8 [0–100] | **Ω multiplier** | Score < 30 → transfers frozen + Ω × ∞ | 0% Allocation |
| **Transfer Freeze** | `ComplianceRules.sol` | Boolean (on-chain) | **Hard Gate** | Frozen → startup entirely removed from pool | 0% Allocation |

> **Key BL Parameters**:  
> **Q** = View vector (expected returns from investor perspective)  
> **Ω** = View uncertainty matrix (diagonal; higher = less confident = lower allocation weight)  
> **P** = Pick matrix (which startup each view refers to)  
> **Π** = Market equilibrium prior (CAPM-based)

---

## 3. Why Execution Data (Data Point 1) is the "Truth Anchor"

### 3.1 The Problem with Reported Financials

Phase 1 of the IntelliStake Valuation Engine trains on hard financial data — revenue, headcount, funding rounds. However, startup financials are:

- **Self-reported** (no mandatory audit for early-stage companies in India)
- **Lagging indicators** (reflect months-old performance, not current trajectory)
- **Gameable** (founders can inflate ARR projections, round sizes, or hire contractors to inflate headcount)

A startup that secures a ₹10 Cr seed round can "look excellent" on Phase 1's XGBoost model while having zero engineering output, no real product, and a solo founder with no track record. This is the core failure mode of pure-quant VC models.

### 3.2 Why GitHub + LinkedIn Cannot Be Faked at Scale

Execution Data from `execution_auditor.py` circumvents these weaknesses because:

| Property | Why It Is Trust-Anchoring |
|---|---|
| **GitHub commit history is immutable** | Blockchain-like append-only ledger; each commit is cryptographically signed by the contributor's GPG key. You cannot backdate 300 commits. |
| **Repository age is server-stamped** | GitHub's API returns `created_at` from its own servers — a founder cannot claim a 48-month-old repo that was created last week. |
| **Language diversity is objectively measured** | GitHub's linguist library scans actual file content; claiming Python expertise requires actual `.py` files with real function definitions. |
| **LinkedIn endorsements require human network action** | While not perfect, 150+ endorsements from real identifiable professionals cannot be manufactured overnight without triggering LinkedIn's fraud detection. |
| **Previous exits are verifiable via Crunchbase + MCA** | Founder exit history can be cross-referenced against Ministry of Corporate Affairs (MCA) filings and Crunchbase. |

### 3.3 Trust_Score as the Multiplicative Truth Gate

The Trust_Score acts as a **multiplicative gate** on every XGBoost valuation:

```
Adjusted_Valuation = XGBoost_Valuation × (0.5 + 0.5 × Trust_Score)
```

This formula has a critical property:

| Trust_Score | Multiplier | Interpretation |
|---|---|---|
| 1.00 (maximum trust) | 1.00 | Full XGBoost valuation passes through |
| 0.70 (high trust) | 0.85 | Valuation discounted 15% for uncertainty |
| 0.45 (medium trust) | 0.725 | Valuation discounted ~27.5% |
| 0.00 (zero trust) | 0.50 | Valuation halved — minimum floor |

> **The floor of 0.50 is deliberate**: Even a zero-trust startup is not entirely excluded from the BL view — that would require KYC failure (Data Point 4). The Trust_Score is a *softening* signal; only the compliance layer provides a *hard gate*.

This design ensures that the **XGBoost model never allocates at full confidence to a team with no verifiable execution track record**, regardless of how impressive their financial self-reporting appears. This is exactly what institutional VC due diligence achieves — but operationalized in real-time using open-source API data.

### 3.4 Execution Data as the "Single Source of Truth" for Founder Risk

In the R.A.I.S.E. framework:

- **Market Traction (Data Pt 3)** can be influenced by PR spend and can lag product quality
- **Compliance (Data Pt 4)** is binary (in/out) and reveals regulatory status, not capability
- **Financials (Phase 1)** are self-reported and lagging

Only **Execution Data (Data Pt 1)** provides a **continuous, real-time, independently verifiable measure of team capability**. This is why it is designated the "Truth Anchor":

> *"A team that ships daily, maintains a mature multi-language codebase, and has founders with proven exits will succeed across almost any market condition. That signal is more durable than any revenue figure a 12-month-old startup can generate."*

---

## 4. How Risk Flags Modify the Black-Litterman Ω Matrix

When `traction_tracker.py` raises a Risk Flag, the flag's severity directly scales the **diagonal element of the Ω matrix** for that startup:

```python
# Pseudocode: Portfolio Optimizer integration
for startup in portfolio:
    base_omega = 1 / confidence_score  # higher confidence = lower Ω
    
    if risk_flag["severity"] == "HIGH":
        omega[startup] = base_omega * 3.5  # uncertainty tripled
    elif risk_flag["severity"] == "MEDIUM":
        omega[startup] = base_omega * 2.0
    elif risk_flag["severity"] == "LOW":
        omega[startup] = base_omega * 1.4
    else:
        omega[startup] = base_omega        # no change

# In BL formula, higher Ω → view has less weight → allocation falls toward prior
```

The mathematical consequence: startups with active Risk Flags retain their base market-equilibrium allocation (Π) rather than the bullish AI view (Q). This is the portfolio optimizer's equivalent of a "wait and see" stance — reduce conviction, reduce position size, preserve capital.

---

## 5. KYC as the On-Chain Operationalisation of Risk Flags

Risk Flags generated in Python are purely off-chain signals. The `ComplianceRules.sol` contract bridges these into binding on-chain outcomes:

```
Off-Chain Pipeline                     On-Chain Enforcement
─────────────────────                  ────────────────────
traction_tracker.py                    ComplianceRules.sol
  → risk_flags.json                       → transfersEnabled[token]
       │                                       │
       │  Chainlink Oracle                     │
       └─────────────────────────────────────▶ setTransferEnabled()
       
execution_auditor.py                   ComplianceRules.sol
  → trust_scores.json                     → complianceScore[token]
       │                                       │
       │  Chainlink Oracle                     │
       └─────────────────────────────────────▶ updateComplianceScore()
```

This three-layer enforcement creates a **defence-in-depth** architecture:

| Layer | Mechanism | Can Be Bypassed By |
|---|---|---|
| L1 — Quantitative Discount | Trust_Score multiplier on XGBoost | Only by genuine engineering output |
| L2 — Allocation Reduction | Ω scaling from Risk Flags | Only by improving actual market traction |
| L3 — Hard Gate | KYC/accreditation on-chain | Cannot be bypassed — requires legal identity verification |

A "bad actor" must defeat **all three layers simultaneously** — an economically and legally impractical attack surface.

---

## 6. Summary: End-to-End Data Flow

```
Phase_2_Data/
├── execution_auditor.py  ──→  trust_scores.json + .csv
│         Trust_Score                ↓
│         (multiplier)        XGBoost_Adjusted_Valuation
│                                    ↓ (feeds Q matrix)
├── traction_tracker.py   ──→  risk_flags.json + .csv
│         Risk Flags                 ↓
│         (Ω modifier)         Black-Litterman Posterior
│                                    ↓ (portfolio weights w*)
├── portfolio_optimizer.py ──→  investment_recommendations.csv
│         Allocations               ↓
│                            Chainlink Oracle encodes
│                                    ↓
└── ComplianceRules.sol    ──→  On-Chain Transfer Gate
          KYC + Score             Token Minting
                                 (ERC-3643 compliant)
```

---

*Document prepared for NMIMS University MBA (Tech) Capstone — February 2026*  
*IntelliStake Development Team*
