"""
engine/risk_simulator.py
=========================
IntelliStake — Monte Carlo Risk Simulator + Markowitz Efficient Frontier (Domain 3)

Runs 10,000 Monte Carlo paths under 3 shock scenarios to calculate:
  - 95% Value-at-Risk (VaR)
  - Conditional VaR (CVaR / Expected Shortfall)
  - Sharpe, Sortino, Information Ratios
  - Markowitz Efficient Frontier (portfolio vs Nifty 50)

Shock Scenarios:
  - Base Case:   μ = BL posterior returns, σ = trust-weighted volatility
  - Tech Winter: μ reduced 40%, σ increased 50% (2022-style VC drought)
  - Market Crash:μ reduced 60%, σ doubled (COVID-style black swan)

Output:
  unified_data/4_production/risk_simulation_results.json
  unified_data/4_production/efficient_frontier.png

Usage:
  python engine/risk_simulator.py
  python engine/risk_simulator.py --n-sims 1000    # faster dev run
  python engine/risk_simulator.py --no-plots        # JSON only
"""

import os
import sys
import json
import warnings
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

BASE_DIR  = Path(__file__).resolve().parent.parent
UNIFIED   = BASE_DIR / "unified_data"
PROD_DIR  = UNIFIED / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)

# BL posterior from portfolio_optimizer (fallback constants)
NIFTY_CAGR        = 0.138    # Nifty 50 ~13.8% CAGR 2018–2024
NIFTY_VOL         = 0.18     # Nifty 50 annual volatility
RISK_FREE_RATE    = 0.065    # 6.5% RBI repo rate
TRADING_DAYS      = 252

# Scenario definitions: (mu_multiplier, sigma_multiplier, label)
SCENARIOS = {
    "Base Case":    (1.00, 1.00, "Normal market conditions (BL posterior)"),
    "Tech Winter":  (0.60, 1.50, "VC funding drought -40% returns, +50% vol (2022-style)"),
    "Market Crash": (0.40, 2.00, "Black swan event -60% returns, +100% vol (COVID-style)"),
}

# ── Portfolio Loader ──────────────────────────────────────────────────────────

def load_portfolio() -> dict:
    """Load BL portfolio weights and expected returns."""
    port_paths = [
        UNIFIED / "4_production" / "final_portfolio_weights.json",
        UNIFIED / "production"   / "final_portfolio_weights.json",
    ]
    for p in port_paths:
        if p.exists():
            with open(p) as f:
                data = json.load(f)
            summry = data.get("portfolio_summary", {})
            allocs = data.get("allocations", [])
            weights = np.array([a["allocation_pct"] / 100.0 for a in allocs])
            returns = np.array([a["bl_expected_return_pct"] / 100.0 for a in allocs])
            names   = [a.get("startup_name", f"S{i}") for i, a in enumerate(allocs)]
            trust   = np.array([a.get("trust_score", 0.5) for a in allocs])
            print(f"  Portfolio loaded: {len(allocs)} holdings, Sharpe={summry.get('sharpe_ratio','?')}")
            if weights.sum() > 0:
                weights /= weights.sum()
            return {
                "weights": weights,
                "expected_returns": returns,
                "names": names,
                "trust_scores": trust,
                "bl_sharpe": summry.get("sharpe_ratio", 0.9351),
                "bl_return": summry.get("expected_annual_return_pct", 25.4) / 100,
                "bl_vol":    summry.get("expected_annual_volatility_pct", 20.2) / 100,
                "n_assets":  len(allocs),
            }

    # Fallback: synthetic 10-asset portfolio
    n = 10
    np.random.seed(42)
    w = np.random.dirichlet(np.ones(n) * 2)
    r = np.random.uniform(0.18, 0.40, n)
    t = np.random.uniform(0.60, 0.85, n)
    print("  [INFO] Using synthetic portfolio (production/final_portfolio_weights.json not found)")
    return {
        "weights": w, "expected_returns": r, "names": [f"Startup_{i}" for i in range(n)],
        "trust_scores": t, "bl_sharpe": 0.9351, "bl_return": 0.254, "bl_vol": 0.202, "n_assets": n,
    }


# ── Monte Carlo Core ──────────────────────────────────────────────────────────

def run_monte_carlo(
    mu_daily: float,
    sigma_daily: float,
    n_sims: int = 10_000,
    n_days: int = TRADING_DAYS,
    initial_value: float = 1.0,
) -> np.ndarray:
    """
    Run n_sims GBM paths.
    Returns array shape (n_sims, n_days+1) — portfolio value over time.
    """
    np.random.seed(42)
    # Geometric Brownian Motion
    dt    = 1.0 / TRADING_DAYS
    drift = (mu_daily - 0.5 * sigma_daily ** 2) * dt
    diff  = sigma_daily * np.sqrt(dt)

    Z      = np.random.normal(0, 1, (n_sims, n_days))
    log_r  = drift + diff * Z          # (n_sims, n_days)
    paths  = np.exp(np.cumsum(log_r, axis=1))  # cumulative product
    # Prepend initial value = 1.0
    paths  = np.hstack([np.ones((n_sims, 1)), paths]) * initial_value
    return paths


def scenario_metrics(paths: np.ndarray, rf: float = RISK_FREE_RATE) -> dict:
    """Extract risk metrics from a set of simulation paths."""
    final_returns = paths[:, -1] - 1.0          # total return over period
    annual_returns = (paths[:, -1]) ** (1.0 / (paths.shape[1] / TRADING_DAYS)) - 1

    mean_r  = float(np.mean(annual_returns))
    std_r   = float(np.std(annual_returns))
    downside = annual_returns[annual_returns < rf]
    downside_std = float(np.std(downside)) if len(downside) > 0 else std_r

    # VaR and CVaR at 95%
    var_95  = float(np.percentile(final_returns, 5))   # 5th pctile loss
    cvar_95 = float(np.mean(final_returns[final_returns <= var_95]))

    sharpe  = (mean_r - rf) / (std_r + 1e-9)
    sortino = (mean_r - rf) / (downside_std + 1e-9)
    info_r  = (mean_r - NIFTY_CAGR) / (std_r + 1e-9)
    max_dd  = float(np.min(np.min(paths / np.maximum.accumulate(paths, axis=1) - 1, axis=1)))

    return {
        "mean_annual_return_pct":  round(mean_r * 100, 2),
        "volatility_pct":          round(std_r * 100, 2),
        "var_95_pct":              round(var_95 * 100, 2),
        "cvar_95_pct":             round(cvar_95 * 100, 2),
        "sharpe_ratio":            round(sharpe, 4),
        "sortino_ratio":           round(sortino, 4),
        "information_ratio":       round(info_r, 4),
        "max_drawdown_pct":        round(max_dd * 100, 2),
        "best_path_return_pct":    round(float(np.percentile(final_returns, 95)) * 100, 2),
        "median_return_pct":       round(float(np.median(final_returns)) * 100, 2),
        "worst_path_return_pct":   round(float(np.percentile(final_returns, 5)) * 100, 2),
        "probability_profit_pct":  round(float(np.mean(final_returns > 0)) * 100, 1),
    }


# ── Markowitz Efficient Frontier ──────────────────────────────────────────────

def efficient_frontier(port: dict, n_portfolios: int = 1000) -> dict:
    """
    Sweep random portfolios to plot the efficient frontier.
    Returns scatter data + AI portfolio position.
    """
    n = port["n_assets"]
    mu = port["expected_returns"]
    np.random.seed(99)

    # Estimate covariance from expected returns + trust-score-derived vol
    trust = port["trust_scores"]
    vol_per_asset = 0.15 + (1 - trust) * 0.25    # higher trust → lower vol
    corr = np.eye(n) + 0.25 * (np.ones((n, n)) - np.eye(n))  # uniform 25% correlation
    cov = np.outer(vol_per_asset, vol_per_asset) * corr

    # Random portfolios
    rand_w = np.random.dirichlet(np.ones(n), n_portfolios)
    rand_returns = rand_w @ mu
    rand_vols = np.array([np.sqrt(w @ cov @ w) for w in rand_w])
    rand_sharpes = (rand_returns - RISK_FREE_RATE) / (rand_vols + 1e-9)

    # AI-tilted BL portfolio
    ai_w   = port["weights"]
    ai_ret = float(ai_w @ mu)
    ai_vol = float(np.sqrt(ai_w @ cov @ ai_w))
    ai_sharpe = (ai_ret - RISK_FREE_RATE) / (ai_vol + 1e-9)

    return {
        "random_portfolios": {
            "returns_pct":    [round(r * 100, 2) for r in rand_returns.tolist()],
            "volatilities_pct": [round(v * 100, 2) for v in rand_vols.tolist()],
            "sharpe_ratios":  [round(s, 3) for s in rand_sharpes.tolist()],
        },
        "intellistake_portfolio": {
            "return_pct":    round(ai_ret * 100, 2),
            "volatility_pct":round(ai_vol * 100, 2),
            "sharpe_ratio":  round(float(ai_sharpe), 4),
        },
        "nifty50_benchmark": {
            "return_pct":    round(NIFTY_CAGR * 100, 2),
            "volatility_pct":round(NIFTY_VOL * 100, 2),
            "sharpe_ratio":  round((NIFTY_CAGR - RISK_FREE_RATE) / NIFTY_VOL, 4),
        },
    }


# ── Matplotlib Plotting ───────────────────────────────────────────────────────

def plot_frontier(frontier_data: dict, save_path: Path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.cm as cm

        fig, ax = plt.subplots(figsize=(12, 7))
        fig.patch.set_facecolor("#0f1117")
        ax.set_facecolor("#1a1d2e")

        rp = frontier_data["random_portfolios"]
        vols = rp["volatilities_pct"]
        rets = rp["returns_pct"]
        shrps = rp["sharpe_ratios"]

        sc = ax.scatter(vols, rets, c=shrps, cmap="plasma", alpha=0.5, s=8, zorder=2)
        plt.colorbar(sc, ax=ax, label="Sharpe Ratio", pad=0.01)

        # IntelliStake portfolio
        ai = frontier_data["intellistake_portfolio"]
        ax.scatter(ai["volatility_pct"], ai["return_pct"], color="#00ff88", s=200,
                   zorder=5, marker="*", label=f"IntelliStake AI Portfolio\n(Sharpe={ai['sharpe_ratio']:.3f})")

        # Nifty 50
        nf = frontier_data["nifty50_benchmark"]
        ax.scatter(nf["volatility_pct"], nf["return_pct"], color="#ff6b35", s=150,
                   zorder=5, marker="D", label=f"Nifty 50 Benchmark\n(Sharpe={nf['sharpe_ratio']:.3f})")

        ax.set_xlabel("Annual Volatility (%)", color="white", fontsize=12)
        ax.set_ylabel("Expected Annual Return (%)", color="white", fontsize=12)
        ax.set_title("Markowitz Efficient Frontier\nIntelliStake AI Portfolio vs Nifty 50",
                     color="white", fontsize=14, fontweight="bold", pad=15)
        ax.tick_params(colors="white")
        ax.spines[:].set_color("#444")
        ax.legend(facecolor="#1a1d2e", labelcolor="white", fontsize=10, framealpha=0.8)
        ax.grid(True, alpha=0.15, color="white")

        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close()
        print(f"  ✓ Frontier plot saved → {save_path.name}")
        return True
    except Exception as e:
        print(f"  [WARN] Frontier plot failed: {e}. JSON output still written.")
        return False


def plot_mc_paths(all_paths: dict, save_path: Path, n_show: int = 30):
    """Plot a subset of Monte Carlo paths for each scenario."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        COLORS = {"Base Case": "#00ff88", "Tech Winter": "#ffa500", "Market Crash": "#ff4444"}
        fig, axes = plt.subplots(1, 3, figsize=(18, 6), sharey=False)
        fig.patch.set_facecolor("#0f1117")

        for ax, (scenario, paths) in zip(axes, all_paths.items()):
            ax.set_facecolor("#1a1d2e")
            sample = paths[:n_show]
            x = np.arange(paths.shape[1])
            for path in sample:
                ax.plot(x, path * 100, alpha=0.25, linewidth=0.6, color=COLORS.get(scenario, "white"))
            # Median path
            ax.plot(x, np.median(paths, axis=0) * 100, linewidth=2.5, color=COLORS.get(scenario, "white"), label="Median")
            ax.set_title(scenario, color="white", fontsize=12, fontweight="bold")
            ax.set_xlabel("Trading Days", color="white", fontsize=10)
            ax.set_ylabel("Portfolio Value (₹, normalised to 100)", color="white", fontsize=10)
            ax.tick_params(colors="white")
            ax.spines[:].set_color("#444")
            ax.grid(True, alpha=0.15, color="white")
            ax.axhline(100, color="gray", linewidth=1, linestyle="--", alpha=0.5)

        fig.suptitle("Monte Carlo Stress Test — 10,000 Simulation Paths",
                     color="white", fontsize=14, fontweight="bold", y=1.02)
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close()
        print(f"  ✓ Monte Carlo paths plot saved → {save_path.name}")
    except Exception as e:
        print(f"  [WARN] MC paths plot failed: {e}")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(n_sims: int = 10_000, no_plots: bool = False):
    print("\n" + "=" * 60)
    print(f"  IntelliStake — Monte Carlo Risk Simulator ({n_sims:,} sims)")
    print("=" * 60)

    # 1. Load portfolio
    print("\n[1] Loading portfolio …")
    port = load_portfolio()
    mu_annual = port["bl_return"]
    sigma_annual = port["bl_vol"]

    # Convert to daily
    mu_daily    = mu_annual / TRADING_DAYS
    sigma_daily = sigma_annual / np.sqrt(TRADING_DAYS)

    print(f"  μ_annual={mu_annual*100:.2f}% | σ_annual={sigma_annual*100:.2f}%")

    # 2. Run scenarios
    print(f"\n[2] Running {n_sims:,} Monte Carlo paths × 3 scenarios …")
    all_results  = {}
    all_paths    = {}

    for scenario, (mu_mult, sig_mult, desc) in SCENARIOS.items():
        mu_s = mu_daily * mu_mult
        sg_s = sigma_daily * sig_mult
        print(f"\n  Scenario: {scenario}")
        print(f"  Config:   μ×{mu_mult} = {mu_s*TRADING_DAYS*100:.1f}%/yr | σ×{sig_mult} = {sg_s*np.sqrt(TRADING_DAYS)*100:.1f}%/yr")
        paths = run_monte_carlo(mu_s, sg_s, n_sims=n_sims)
        metrics = scenario_metrics(paths)
        all_paths[scenario] = paths
        all_results[scenario] = {
            "description": desc,
            "parameters": {
                "mu_annual_pct":    round(mu_s * TRADING_DAYS * 100, 2),
                "sigma_annual_pct": round(sg_s * np.sqrt(TRADING_DAYS) * 100, 2),
                "mu_multiplier":    mu_mult,
                "sigma_multiplier": sig_mult,
            },
            "metrics": metrics,
        }
        m = metrics
        print(f"  VaR(95%):   {m['var_95_pct']}% | CVaR(95%): {m['cvar_95_pct']}%")
        print(f"  Sharpe:     {m['sharpe_ratio']} | Sortino: {m['sortino_ratio']} | IR: {m['information_ratio']}")
        print(f"  Max DD:     {m['max_drawdown_pct']}% | P(profit): {m['probability_profit_pct']}%")

    # 3. Efficient Frontier
    print("\n[3] Computing Efficient Frontier …")
    frontier = efficient_frontier(port)

    # 4. Plots
    if not no_plots:
        print("\n[4] Generating plots …")
        plot_frontier(frontier, PROD_DIR / "efficient_frontier.png")
        plot_mc_paths(all_paths, PROD_DIR / "monte_carlo_paths.png")

    # 5. Institutional summary table
    base = all_results["Base Case"]["metrics"]
    crash = all_results["Market Crash"]["metrics"]
    print(f"\n  ┌─ Institutional Risk Summary ──────────────────────────┐")
    print(f"  │ Scenario        VaR(95%)  CVaR(95%)  Sharpe  Max DD   │")
    print(f"  ├──────────────────────────────────────────────────────  │")
    for scen, res in all_results.items():
        m = res["metrics"]
        print(f"  │ {scen:<15} {m['var_95_pct']:>7.1f}%  {m['cvar_95_pct']:>8.1f}%  {m['sharpe_ratio']:>6.3f} {m['max_drawdown_pct']:>7.1f}%  │")
    print(f"  └──────────────────────────────────────────────────────  ┘")

    # 6. Write output
    output = {
        "meta": {
            "generated_at":  datetime.now(timezone.utc).isoformat(),
            "n_simulations": n_sims,
            "trading_days":  TRADING_DAYS,
            "risk_free_rate":RISK_FREE_RATE,
            "nifty50_cagr":  NIFTY_CAGR,
        },
        "portfolio_inputs": {
            "bl_expected_return_pct": round(mu_annual * 100, 2),
            "bl_volatility_pct":      round(sigma_annual * 100, 2),
            "bl_sharpe_ratio":        port["bl_sharpe"],
            "holdings":               port["n_assets"],
        },
        "scenarios":         all_results,
        "efficient_frontier":frontier,
        "plots": {
            "efficient_frontier": "efficient_frontier.png" if not no_plots else None,
            "monte_carlo_paths":  "monte_carlo_paths.png"  if not no_plots else None,
        },
    }

    out_path = PROD_DIR / "risk_simulation_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n  ✓ Output written → {out_path}")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliStake Monte Carlo Risk Simulator")
    parser.add_argument("--n-sims",   type=int,  default=10_000, help="Number of Monte Carlo simulations (default: 10,000)")
    parser.add_argument("--no-plots", action="store_true",        help="Skip matplotlib plots, JSON only")
    args = parser.parse_args()
    run(n_sims=args.n_sims, no_plots=args.no_plots)
