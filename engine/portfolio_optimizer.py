"""
IntelliStake R.A.I.S.E. Framework — Black-Litterman Portfolio Optimizer v2
===========================================================================
Key improvements over v1:
  - Selects top-30 startups by trust_score (not arbitrary first-10)
  - Proper BL posterior: τ=0.05, P/Q/Ω matrices, covariance-scaled uncertainty
  - Reports Sharpe Ratio, Sortino Ratio, Max Drawdown simulation
  - Sector cap (35%) + country cap (60%) diversification constraints
  - Fixed file paths → unified_data/cleaned/ and unified_data/outputs/

Usage:
    python engine/portfolio_optimizer.py
"""

import json
import math
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

# ── Paths ─────────────────────────────────────────────────────────────────────
ENGINE_DIR  = Path(__file__).resolve().parent
FINAL_DIR   = ENGINE_DIR.parent
UNIFIED_DIR = FINAL_DIR / "unified_data"
CLEANED_DIR = UNIFIED_DIR / "cleaned"
OUT_DIR     = UNIFIED_DIR / "outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DATA_FILE   = CLEANED_DIR / "intellistake_startups_clean.json"
OUTPUT_FILE = OUT_DIR / "pipeline_portfolio_weights.json"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | portfolio_optimizer | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("portfolio_optimizer")

# ── BL Parameters ─────────────────────────────────────────────────────────────
TAU             = 0.05        # scaling factor for prior uncertainty
RISK_FREE_RATE  = 0.065       # 6.5% — Nifty 50 long-run return
SECTOR_CAP      = 0.35        # max allocation to any single sector
COUNTRY_CAP     = 0.60        # max allocation to any single country
NUM_CANDIDATES  = 30          # pre-select top-N by trust score
NUM_PORTFOLIO   = 10          # final portfolio size


def load_startups() -> list[dict]:
    if not DATA_FILE.exists():
        log.error(f"Data file not found: {DATA_FILE}")
        return []
    with open(DATA_FILE) as f:
        data = json.load(f)
    log.info(f"Loaded {len(data):,} startups")
    return data


def select_candidates(startups: list[dict]) -> list[dict]:
    """
    Select top NUM_CANDIDATES startups by trust_score with valid funding + valuation.
    This ensures the BL portfolio is seeded with the best-vetted opportunities.
    """
    valid = [
        s for s in startups
        if s.get("funding_amount_usd", 0) > 0
        and s.get("trust_score", 0) > 0
        and s.get("estimated_valuation_usd", 0) > 0
    ]
    # Sort by trust_score descending
    valid.sort(key=lambda s: s.get("trust_score", 0), reverse=True)
    candidates = valid[:NUM_CANDIDATES]
    log.info(f"Selected {len(candidates)} candidates (top by trust_score)")
    return candidates


def apply_diversification_cap(weights: np.ndarray, startups: list[dict]) -> np.ndarray:
    """
    Iteratively enforce sector cap (35%) and country cap (60%).
    Excess weight is redistributed proportionally to uncapped assets.
    """
    w = weights.copy()
    for _ in range(20):  # iterate until convergence
        changed = False

        # Sector cap
        sectors = {}
        for i, s in enumerate(startups):
            sec = s.get("sector", "Unknown")
            sectors.setdefault(sec, []).append(i)
        for sec_idxs in sectors.values():
            sec_total = sum(w[i] for i in sec_idxs)
            if sec_total > SECTOR_CAP:
                scale = SECTOR_CAP / sec_total
                for i in sec_idxs:
                    w[i] *= scale
                changed = True

        # Country cap
        countries = {}
        for i, s in enumerate(startups):
            ctry = s.get("country", "Unknown")
            countries.setdefault(ctry, []).append(i)
        for ctry_idxs in countries.values():
            ctry_total = sum(w[i] for i in ctry_idxs)
            if ctry_total > COUNTRY_CAP:
                scale = COUNTRY_CAP / ctry_total
                for i in ctry_idxs:
                    w[i] *= scale
                changed = True

        # Renormalise
        total = w.sum()
        if total > 0:
            w /= total

        if not changed:
            break

    return w


def black_litterman_posterior(
    prior_weights: np.ndarray,
    sigma: np.ndarray,
    P: np.ndarray,
    Q: np.ndarray,
    omega: np.ndarray,
) -> np.ndarray:
    """
    Proper Black-Litterman posterior weight computation.

    Formula:
        BL_return = [(τΣ)⁻¹ + PᵀΩ⁻¹P]⁻¹ × [(τΣ)⁻¹π + PᵀΩ⁻¹Q]
        where π = implied equilibrium returns = τΣ × prior_weights

    Returns posterior expected returns vector.
    """
    tau_sigma = TAU * sigma
    pi_eq = tau_sigma @ prior_weights              # implied equilibrium returns

    tau_sigma_inv = np.linalg.pinv(tau_sigma)
    omega_inv     = np.linalg.pinv(omega)

    # Posterior mean
    A = tau_sigma_inv + P.T @ omega_inv @ P
    b = tau_sigma_inv @ pi_eq + P.T @ omega_inv @ Q
    mu_bl = np.linalg.solve(A, b)

    # Convert posterior returns to weights (mean-variance tangency)
    sigma_inv = np.linalg.pinv(sigma)
    raw_weights = sigma_inv @ mu_bl
    raw_weights = np.clip(raw_weights, 0, None)
    total = raw_weights.sum()
    return raw_weights / total if total > 0 else prior_weights


def compute_portfolio_metrics(
    weights: np.ndarray,
    views: np.ndarray,
    trust_scores: np.ndarray,
) -> dict:
    """
    Compute Sharpe Ratio, Sortino Ratio, and simulated Max Drawdown.

    - Portfolio return = weighted sum of BL upside views
    - Portfolio std = approximated from trust-weighted dispersion
    - Downside std = std of only the negative-view components
    - Max drawdown = simulated from 10k random paths over 1-year horizon
    """
    port_return = float(np.dot(weights, views))

    # Trust-adjusted variance proxy — low trust startups inflate variance
    variances = (1 - trust_scores) ** 2 * 0.4    # sector vol proxy
    port_var  = float(weights @ (np.diag(variances) @ weights))
    port_std  = math.sqrt(max(port_var, 1e-9))

    # Sharpe
    sharpe = (port_return - RISK_FREE_RATE) / port_std if port_std > 0 else 0.0

    # Sortino (downside std only)
    neg_views = np.where(views < 0, views, 0)
    downside_var = float(weights @ (np.outer(neg_views, neg_views) @ weights))
    downside_std = math.sqrt(max(downside_var, 1e-9))
    sortino = (port_return - RISK_FREE_RATE) / downside_std if downside_std > 0 else 0.0

    # Monte Carlo max drawdown (10k paths, 252 daily steps)
    np.random.seed(42)
    daily_ret = port_return / 252
    daily_vol = port_std / math.sqrt(252)
    paths = np.random.normal(daily_ret, daily_vol, size=(10_000, 252))
    cumulative = np.cumprod(1 + paths, axis=1)
    running_max = np.maximum.accumulate(cumulative, axis=1)
    drawdowns = (cumulative - running_max) / running_max
    max_drawdown = float(drawdowns.min())   # worst (most negative) across all paths

    return {
        "portfolio_expected_return_pct": round(port_return * 100, 2),
        "portfolio_volatility_pct":       round(port_std * 100, 2),
        "sharpe_ratio":                   round(sharpe, 4),
        "sortino_ratio":                  round(sortino, 4),
        "simulated_max_drawdown_pct":     round(max_drawdown * 100, 2),
    }


def run_black_litterman_simulation():
    log.info("=" * 58)
    log.info("IntelliStake BL Portfolio Optimizer v2")
    log.info("Proper BL posterior | Sector/Country caps | Sharpe + Sortino")
    log.info("=" * 58)

    # ── Load + Select ─────────────────────────────────────────────────────────
    all_startups = load_startups()
    if not all_startups:
        return

    candidates = select_candidates(all_startups)
    if len(candidates) < 2:
        log.error("Not enough valid startups for optimization.")
        return

    n = len(candidates)

    # ── BL Inputs ─────────────────────────────────────────────────────────────
    prior_weights = np.array([1 / n] * n)
    trust_scores  = np.array([max(0.01, s["trust_score"]) for s in candidates])

    # Q: AI view returns (capped upside/downside)
    views = np.array([
        max(-0.80, min(
            5.0,
            (s["estimated_valuation_usd"] - s["funding_amount_usd"]) / s["funding_amount_usd"]
        ))
        for s in candidates
    ])

    # P: identity (one view per asset — absolute views)
    P = np.eye(n)

    # Ω: diagonal uncertainty — inversely proportional to trust, scaled by τΣ
    # High trust (0.9) → small omega → strong view
    sigma_diag  = (1 - trust_scores) * 0.30 + 0.05   # asset volatility proxy
    sigma       = np.diag(sigma_diag ** 2)
    omega_diag  = TAU * np.diag(P @ sigma @ P.T) * (1 / trust_scores)
    omega       = np.diag(omega_diag)

    # ── BL Posterior ──────────────────────────────────────────────────────────
    bl_weights = black_litterman_posterior(prior_weights, sigma, P, views, omega)

    # ── Diversification caps ──────────────────────────────────────────────────
    bl_weights = apply_diversification_cap(bl_weights, candidates)

    # ── Select final portfolio: top NUM_PORTFOLIO by BL weight ────────────────
    top_idx = np.argsort(bl_weights)[::-1][:NUM_PORTFOLIO]
    final_weights = np.zeros(n)
    final_weights[top_idx] = bl_weights[top_idx]
    total = final_weights.sum()
    final_weights /= total  # renormalise final slice

    # ── Risk Metrics ──────────────────────────────────────────────────────────
    f_idx = final_weights > 0
    metrics = compute_portfolio_metrics(
        final_weights[f_idx],
        views[f_idx],
        trust_scores[f_idx],
    )

    # ── Build Output ──────────────────────────────────────────────────────────
    recommendations = []
    for i, s in enumerate(candidates):
        if final_weights[i] == 0:
            continue
        recommendations.append({
            "startup_name":            s["startup_name"],
            "sector":                  s.get("sector", "N/A"),
            "country":                 s.get("country", "N/A"),
            "ai_trust_score":          round(s["trust_score"], 4),
            "trust_label":             s.get("trust_label", "N/A"),
            "estimated_valuation_usd": s["estimated_valuation_usd"],
            "funding_amount_usd":      s["funding_amount_usd"],
            "bl_view_upside_pct":      round(views[i] * 100, 2),
            "bl_omega":                round(omega_diag[i], 6),
            "recommended_allocation":  f"{final_weights[i] * 100:.2f}%",
            "action":                  s.get("portfolio_action", "INVEST"),
            "risk_flag_active":        s.get("risk_flag_active", False),
            "risk_severity":           s.get("risk_severity", "NONE"),
        })

    recommendations.sort(
        key=lambda x: float(x["recommended_allocation"].strip("%")), reverse=True
    )

    # ── Save ─────────────────────────────────────────────────────────────────
    output = {
        "generated_at":    datetime.now(tz=timezone.utc).isoformat(),
        "portfolio_metrics": metrics,
        "portfolio":         recommendations,
    }
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=4)
    log.info(f"Portfolio saved → {OUTPUT_FILE.relative_to(FINAL_DIR)}")

    # ── Print ─────────────────────────────────────────────────────────────────
    print(f"\n{'=' * 65}")
    print(f"  Black-Litterman Portfolio  (v2 — proper BL posterior)")
    print(f"{'=' * 65}")
    print(f"  {'Startup':<28} {'Alloc%':>7}  {'Trust':>6}  {'Action'}")
    print(f"  {'-'*28} {'-'*7}  {'-'*6}  {'-'*18}")
    for r in recommendations:
        flag = " 🔴" if r["risk_flag_active"] else ""
        print(f"  {r['startup_name'][:28]:<28} {r['recommended_allocation']:>7}  "
              f"{r['ai_trust_score']:>6.3f}  {r['action']}{flag}")
    print(f"{'=' * 65}")
    print(f"\n  📊 Portfolio Metrics:")
    print(f"  Expected Return : {metrics['portfolio_expected_return_pct']:>8.2f}%")
    print(f"  Volatility      : {metrics['portfolio_volatility_pct']:>8.2f}%")
    print(f"  Sharpe Ratio    : {metrics['sharpe_ratio']:>8.4f}")
    print(f"  Sortino Ratio   : {metrics['sortino_ratio']:>8.4f}")
    print(f"  Max Drawdown    : {metrics['simulated_max_drawdown_pct']:>8.2f}%  (10k MC paths)")
    print(f"{'=' * 65}\n")


if __name__ == "__main__":
    run_black_litterman_simulation()
