"""
IntelliStake — Master CLI Launcher
=====================================
The single entry point for all IntelliStake operations.

Usage:
    python start_intellistake.py              # interactive menu
    python start_intellistake.py --global     # Run full 50,000-row simulation
    python start_intellistake.py --live       # Interactive live deep-dive
    python start_intellistake.py --live --startup "Zepto" --repo "zeptonow/android"
    python start_intellistake.py --status     # Show data lake status
"""

import sys
import argparse
import subprocess
from pathlib import Path
from datetime import datetime

FINAL_DIR = Path(__file__).resolve().parent

BANNER = """
╔══════════════════════════════════════════════════════════════╗
║          IntelliStake — AI-Governed Investment Platform        ║
║          R.A.I.S.E. Framework  |  NMIMS Capstone 2025–26      ║
╚══════════════════════════════════════════════════════════════╝

  Domains: AI/ML · Finance · Blockchain · Cybersecurity
  Data   : 3.2M data points | 684k records | 403 MB data lake
"""

MENU = """
  ┌─────────────────────────────────────────────────────────┐
  │                     SELECT MODE                          │
  │                                                          │
  │  [1]  Run Global Audit          (50,000-row simulation)  │
  │  [2]  Run Live Deep-Dive        (real startup OSINT)     │
  │  [3]  Data Lake Status          (file & null report)     │
  │  [4]  View Last Pipeline Output                          │
  │  [Q]  Quit                                               │
  └─────────────────────────────────────────────────────────┘
"""


def run_global_audit():
    """Option 1 — execute the full run_full_pipeline.py simulation."""
    print("\n  ▶  Starting Global Audit — 50,000-row simulation…\n")
    script = FINAL_DIR / "run_full_pipeline.py"
    if not script.exists():
        print(f"  ❌  run_full_pipeline.py not found at {script}"); return
    result = subprocess.run([sys.executable, str(script)], cwd=str(FINAL_DIR))
    if result.returncode == 0:
        print("\n  ✅  Global Audit complete. Results in unified_data/outputs/")
    else:
        print("\n  ❌  Pipeline exited with errors.")


def run_live_deepdive(startup: str = None, repo: str = None, verbose: bool = False):
    """Option 2 — call the live_audit_agent for a real startup."""
    agent = FINAL_DIR / "engine" / "live_audit_agent.py"
    if not agent.exists():
        print(f"  ❌  live_audit_agent.py not found."); return

    cmd = [sys.executable, str(agent)]
    if startup:
        cmd += ["--startup", startup]
    if repo:
        cmd += ["--repo", repo]
    if verbose:
        cmd.append("--verbose")

    print("\n  ▶  Launching Live Deep-Dive OSINT Audit…\n")
    subprocess.run(cmd, cwd=str(FINAL_DIR))


def show_data_status():
    """Option 3 — show a quick data lake status report."""
    import json, math

    UNIFIED = FINAL_DIR / "unified_data"
    print(f"\n{'═'*60}")
    print(f"  IntelliStake — Data Lake Status")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═'*60}")

    def _size(p: Path) -> str:
        b = p.stat().st_size
        for u in ("B","KB","MB","GB"):
            if b < 1024: return f"{b:.1f}{u}"
            b /= 1024
        return f"{b:.1f}GB"

    total_files = total_size = 0
    for subdir in ["raw", "cleaned", "knowledge_graph", "enriched", "production", "outputs"]:
        d = UNIFIED / subdir
        if not d.exists():
            continue
        files = [f for f in d.iterdir() if f.is_file()]
        dir_size = sum(f.stat().st_size for f in files)
        total_files += len(files)
        total_size  += dir_size
        print(f"\n  📂 {subdir}/  ({len(files)} files)")
        for f in sorted(files):
            print(f"     {f.name:<50} {_size(f):>8}")
    print(f"\n{'─'*60}")
    size_mb = total_size / 1024 / 1024
    print(f"  TOTAL: {total_files} files  |  {size_mb:.1f} MB")
    print(f"{'═'*60}\n")


def show_last_output():
    """Option 4 — print summary of the last pipeline run."""
    import json

    weights = FINAL_DIR / "unified_data" / "outputs" / "pipeline_portfolio_weights.json"
    oracle  = FINAL_DIR / "unified_data" / "outputs" / "pipeline_oracle_tx_log.json"

    if weights.exists():
        with open(weights) as f:
            data = json.load(f)
        s = data.get("portfolio_summary", {})
        print(f"\n  📈 Last Portfolio Run ({data.get('generated_at','?')[:19]})")
        print(f"     Return  : {s.get('expected_annual_return_pct','?')}%")
        print(f"     Vol     : {s.get('expected_annual_volatility_pct','?')}%")
        print(f"     Sharpe  : {s.get('sharpe_ratio','?')}")
        print(f"\n  Top 5 Allocations:")
        for a in data.get("allocations", [])[:5]:
            frozen = " 🔒FROZEN" if a.get("oracle_freeze") else ""
            print(f"     {a['startup_name'][:28]:<28}  {a['allocation_pct']:>6.2f}%{frozen}")

    if oracle.exists():
        with open(oracle) as f:
            tx = json.load(f)
        print(f"\n  🔒 Last Oracle Run ({tx.get('run_at','?')[:19]})")
        print(f"     Frozen startups : {tx.get('total_frozen', 0)}")
        print(f"     Mode            : {tx.get('mode','?')}")

    if not weights.exists() and not oracle.exists():
        print("\n  No pipeline output found. Run Option [1] first.")

    print()


def main():
    parser = argparse.ArgumentParser(description="IntelliStake Master Launcher")
    parser.add_argument("--global",   dest="run_global", action="store_true",
                        help="Run full 50,000-row global simulation")
    parser.add_argument("--live",     action="store_true",
                        help="Run live deep-dive for a real startup")
    parser.add_argument("--status",   action="store_true",
                        help="Show data lake status")
    parser.add_argument("--startup",  type=str, help="Startup name for live mode")
    parser.add_argument("--repo",     type=str, help="GitHub repo for live mode")
    parser.add_argument("--verbose",  action="store_true", help="Verbose output")
    args = parser.parse_args()

    print(BANNER)

    # Non-interactive flags
    if args.run_global:
        run_global_audit(); return
    if args.live:
        run_live_deepdive(args.startup, args.repo, args.verbose); return
    if args.status:
        show_data_status(); return

    # Interactive menu loop
    while True:
        print(MENU)
        choice = input("  Enter choice: ").strip().upper()

        if choice == "1":
            run_global_audit()
        elif choice == "2":
            startup = input("\n  Startup name (e.g. Zepto, CRED, Razorpay): ").strip()
            repo    = input(f"  GitHub repo for {startup} (e.g. razorpay/razorpay-python): ").strip()
            verbose = input("  Verbose output? (y/N): ").strip().lower() == "y"
            run_live_deepdive(startup or None, repo or None, verbose)
        elif choice == "3":
            show_data_status()
        elif choice == "4":
            show_last_output()
        elif choice in ("Q", "QUIT", "EXIT"):
            print("\n  Exiting IntelliStake. Goodbye!\n"); break
        else:
            print("  Invalid choice. Enter 1, 2, 3, 4, or Q.")


if __name__ == "__main__":
    main()
