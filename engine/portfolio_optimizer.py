import pandas as pd
import numpy as np
import json
from pathlib import Path

# ── Path to master dataset ─────────────────────────────────────────────────────
BASE = Path(__file__).parent
DATA_FILE = BASE / "Phase_2_Data" / "intellistake_startups_clean.json"
OUTPUT_FILE = BASE / "final_portfolio_recommendations.json"


def run_black_litterman_simulation():
    # 1. Load master AI-vetted data
    print("Loading AI-vetted startup data…")
    with open(DATA_FILE, "r") as f:
        all_startups = json.load(f)

    # Pick 10 startups that have valid funding and trust data
    startups = []
    for s in all_startups:
        if (
            s.get("funding_amount_usd", 0) > 0
            and s.get("trust_score", 0) > 0
            and s.get("estimated_valuation_usd", 0) > 0
        ):
            startups.append(s)
        if len(startups) == 10:
            break

    print(f"Selected {len(startups)} startups for simulation.")

    # 2. Portfolio Optimization Inputs
    num_assets = len(startups)
    prior_weights = np.array([1 / num_assets] * num_assets)

    # AI Views (Q) — Based on Predicted Upside
    views = []
    confidence_levels = []

    for s in startups:
        funding = s["funding_amount_usd"]
        valuation = s["estimated_valuation_usd"]

        # Upside = (AI Valuation - Funded Amount) / Funded Amount
        upside = (valuation - funding) / funding
        # Cap extreme upside/downside to ±5x for stability
        upside = max(-5.0, min(5.0, upside))
        views.append(upside)

        # Confidence (Omega) inversely proportional to AI Trust Score
        # High Trust (0.9) → Low Omega (low uncertainty)
        # Low Trust  (0.4) → High Omega (high uncertainty)
        trust = max(0.01, s["trust_score"])   # avoid div/0
        confidence_levels.append(1 / trust)

    # 3. Black-Litterman posterior weight calculation
    views = np.array(views)
    omegas = np.array(confidence_levels)

    # Weight = Prior × (1 + view / omega)  — higher confidence + higher upside → higher weight
    raw_weights = prior_weights * (1 + (views / omegas))
    # Ensure non-negative (BL can produce negatives for long-only portfolios)
    raw_weights = np.clip(raw_weights, 0.001, None)
    final_weights = raw_weights / np.sum(raw_weights)

    # 4. Generate Final Recommendation
    recommendations = []
    for i, s in enumerate(startups):
        recommendations.append({
            "startup_name":           s["startup_name"],
            "sector":                 s.get("sector", "N/A"),
            "country":                s.get("country", "N/A"),
            "ai_trust_score":         s["trust_score"],
            "trust_label":            s.get("trust_label", "N/A"),
            "estimated_valuation_usd": s["estimated_valuation_usd"],
            "funding_amount_usd":     s["funding_amount_usd"],
            "bl_view_upside_pct":     round(views[i] * 100, 2),
            "recommended_allocation": f"{final_weights[i] * 100:.2f}%",
            "action":                 s.get("portfolio_action", "HOLD"),
            "risk_flag_active":       s.get("risk_flag_active", False),
            "risk_severity":          s.get("risk_severity", "NONE"),
        })

    # Sort by allocation descending
    recommendations.sort(key=lambda x: float(x["recommended_allocation"].strip("%")), reverse=True)

    # 5. Save results
    with open(OUTPUT_FILE, "w") as f:
        json.dump(recommendations, f, indent=4)

    print("\n" + "=" * 58)
    print("  Black-Litterman Portfolio Optimization — Results")
    print("=" * 58)
    print(f"  {'Startup':<28} {'Alloc%':>7}  {'Action'}")
    print(f"  {'-'*28} {'-'*7}  {'-'*20}")
    for r in recommendations:
        flag = " 🔴" if r["risk_flag_active"] else ""
        print(f"  {r['startup_name'][:28]:<28} {r['recommended_allocation']:>7}  {r['action']}{flag}")
    print("=" * 58)
    print(f"\n✅ Portfolio Optimization Complete.")
    print(f"   Results saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    run_black_litterman_simulation()
