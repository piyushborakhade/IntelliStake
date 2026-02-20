import json
import time
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE      = Path(__file__).parent
DATA_FILE = BASE / "Phase_2_Data" / "intellistake_startups_clean.json"


def simulate_oracle_audit():
    print("=" * 50)
    print("  [ORACLE BRIDGE STARTING]")
    print("  IntelliStake → IntelliStakeToken.sol")
    print("=" * 50)

    # Load Master AI Data
    print(f"\nLoading AI data from: {DATA_FILE.name}")
    with open(DATA_FILE, "r") as f:
        startups = json.load(f)

    # Filter for HIGH RISK startups that need fund-freezing
    flagged_startups = [
        s for s in startups
        if s.get("risk_flag_active") and str(s.get("risk_severity", "")).upper() == "HIGH"
    ]

    print(f"Total startups scanned:  {len(startups):,}")
    print(f"HIGH RISK flags found:   {len(flagged_startups):,}")
    print(f"\nProcessing top 10 for demo…\n")

    for s in flagged_startups[:10]:
        print(f"[ALERT] Risk detected for: {s['startup_name']}")
        print(f"        Trust Label  : {s.get('trust_label', 'N/A')}")
        print(f"        Trust Score  : {s.get('trust_score', 'N/A')}")
        print(f"        BL-Omega x   : {s.get('bl_omega_multiplier', 'N/A')}")
        print(f"        Risk Severity: {s.get('risk_severity', 'N/A')}")
        print()
        print(f"  --- Calling IntelliStakeToken.sol ---")
        print(f"  Executing: releaseTranche(")
        print(f"    startup_id = \"{s['startup_id']}\",")
        print(f"    status     = BLOCKED")
        print(f"  )")
        print(f"  Status: ✅ FUNDS FROZEN ON-CHAIN via ERC-3643 Protocol")
        print(f"  {'─' * 46}")
        time.sleep(0.5)    # brief pause to simulate tx submission

    print(f"\n{'=' * 50}")
    print(f"  [AUDIT COMPLETE]")
    print(f"  {len(flagged_startups[:10])} startup(s) had milestone funding frozen.")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    simulate_oracle_audit()
