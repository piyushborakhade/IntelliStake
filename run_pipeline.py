#!/usr/bin/env python3
"""
run_pipeline.py — IntelliStake AI Model Training Pipeline
==========================================================
Runs all 5 AI model scripts sequentially with live streaming output.
Optimised for Apple M4 Pro (MPS · n_jobs=-1 · all cores).

Usage:
    python run_pipeline.py           # run all 5 steps
    python run_pipeline.py --step 1  # run only Step 1 (valuation)
    python run_pipeline.py --step 3  # run only Step 3 (backtest)
"""

import subprocess, sys, time, argparse, os
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).resolve().parent

STEPS = [
    {
        "num": 1,
        "name": "Stacked Valuation Engine",
        "emoji": "🧠",
        "desc": "XGBoost + LightGBM + TabMLP(MPS) → Ridge  |  50K startups, 5-fold CV",
        "cmd":  ["python", "engine/valuation_stacked.py", "--top-n", "200", "--oof-n", "12000"],
        "out":  "unified_data/4_production/stacked_valuation_summary.json",
    },
    {
        "num": 2,
        "name": "Hype Anomaly Detector",
        "emoji": "🚨",
        "desc": "Isolation Forest (200 trees)  |  flags valuation/velocity disconnect",
        "cmd":  ["python", "engine/hype_detector.py"],
        "out":  "unified_data/4_production/hype_anomaly_flags.json",
    },
    {
        "num": 3,
        "name": "Historical Backtest Engine",
        "emoji": "📈",
        "desc": "2018 cohort from 46K real funding rounds  |  vs Nifty 50 benchmark",
        "cmd":  ["python", "engine/backtest_engine.py", "--cohort-year", "2018"],
        "out":  "unified_data/4_production/backtest_results.json",
    },
    {
        "num": 4,
        "name": "Monte Carlo + VaR Simulator",
        "emoji": "🎲",
        "desc": "10K GBM paths × 3 stress scenarios  |  VaR(95%) + CVaR + Efficient Frontier",
        "cmd":  ["python", "engine/risk_simulator.py", "--n-sims", "10000", "--no-plots"],
        "out":  "unified_data/4_production/risk_simulation_results.json",
    },
    {
        "num": 5,
        "name": "FinBERT Sentiment Pipeline",
        "emoji": "💬",
        "desc": "ProsusAI/finbert transformer  |  real Indian startup news headlines",
        "cmd":  ["python", "engine/finbert_sentiment.py"],
        "out":  "unified_data/4_production/finbert_sentiment_scores.json",
    },
]

BAR   = "━" * 58
SEP   = "─" * 60

def header():
    t = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
    print(f"\n{'═'*60}")
    print(f"  🚀  IntelliStake AI Model Training Pipeline")
    print(f"  ⚡  Apple M4 Pro · MPS · n_jobs=-1 · 24 GB RAM")
    print(f"  🕐  {t}")
    print(f"{'═'*60}\n")

def step_banner(step):
    print(f"\n{SEP}")
    print(f"  {step['emoji']}  STEP {step['num']}/5 — {step['name']}")
    print(f"  ℹ  {step['desc']}")
    print(f"{SEP}\n")

def run_step(step) -> tuple[bool, float]:
    step_banner(step)
    t0 = time.time()
    proc = subprocess.Popen(
        step["cmd"],
        cwd=str(BASE),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,          # line-buffered
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    for line in proc.stdout:
        print(line, end="", flush=True)
    proc.wait()
    elapsed = time.time() - t0

    out_path = BASE / step["out"]
    ok = proc.returncode == 0 and out_path.exists()

    if ok:
        sz = out_path.stat().st_size / 1024
        print(f"\n  ✅  Step {step['num']} complete in {elapsed:.1f}s  →  {step['out']} ({sz:.1f} KB)")
    else:
        print(f"\n  ❌  Step {step['num']} FAILED (exit={proc.returncode}) after {elapsed:.1f}s")
        if not out_path.exists():
            print(f"      Output file missing: {step['out']}")
    return ok, elapsed


def summary(results):
    print(f"\n{'═'*60}")
    print(f"  📊  Pipeline Summary")
    print(f"{'═'*60}")
    total = 0.0
    for step, (ok, elapsed) in zip(STEPS, results):
        icon = "✅" if ok else "❌"
        total += elapsed
        print(f"  {icon}  Step {step['num']} — {step['name']:<30}  {elapsed:6.1f}s")
    print(f"{'─'*60}")
    n_ok = sum(1 for ok, _ in results if ok)
    print(f"  Completed: {n_ok}/{len(STEPS)} steps  |  Total time: {total:.1f}s ({total/60:.1f} min)")
    if n_ok == len(STEPS):
        print(f"\n  🎉  All models trained! Start the API server to serve real data:")
        print(f"      cd engine && python chatbot_api.py")
    print(f"{'═'*60}\n")


def main():
    parser = argparse.ArgumentParser(description="IntelliStake AI Pipeline Runner")
    parser.add_argument("--step", type=int, default=None,
                        help="Run only this step number (1-5). Default: run all.")
    args = parser.parse_args()

    header()

    steps_to_run = [s for s in STEPS if args.step is None or s["num"] == args.step]
    if not steps_to_run:
        print(f"  ❌  Unknown step {args.step}. Choose 1–5."); sys.exit(1)

    results = []
    for step in steps_to_run:
        ok, elapsed = run_step(step)
        results.append((ok, elapsed))
        if not ok:
            print(f"  ⚠️  Continuing despite Step {step['num']} failure …\n")

    summary(results)


if __name__ == "__main__":
    main()
