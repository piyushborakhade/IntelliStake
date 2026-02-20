"""
IntelliStake — Oracle Bridge
===============================
Reads "Low Trust" / HIGH-risk flags from the master knowledge graph
and simulates sending freeze-milestone transactions to IntelliStakeToken.sol.

This is the final link in the demonstration loop:
    Bad Data Signal → AI Audit → Portfolio Rebalance → Blockchain Lock

The bridge operates in two modes:
  --dry-run   (default) Prints a transaction simulation report.
  --live      Sends real transactions to a local Hardhat/Anvil node
              using web3.py. Requires PRIVATE_KEY + RPC_URL env vars.

Usage:
    python oracle_bridge.py                    # dry-run
    python oracle_bridge.py --dry-run          # explicit dry-run
    python oracle_bridge.py --live             # live (requires local node)
    python oracle_bridge.py --top-n 20         # expand trigger set

Dependencies (dry-run only needs pandas + web3 for import):
    pip install web3 pandas pyarrow
"""

import os
import sys
import json
import logging
import argparse
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent
GRAPH_CSV   = ROOT / "Data_Scaling_Engine" / "outputs" / "intellistake_master_graph.csv"
WEIGHTS_JSON = ROOT / "Phase_2_Dev" / "final_portfolio_weights.json"
OUTPUTS_DIR = ROOT / "Phase_2_Dev"
TX_LOG_JSON = OUTPUTS_DIR / "oracle_tx_log.json"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | oracle_bridge | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("oracle_bridge")

# ── Mock ABI (only the functions we call) ─────────────────────────────────────
INTELLISTAKE_TOKEN_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "startup", "type": "address"},
            {"internalType": "string",  "name": "reason",  "type": "string"},
        ],
        "name": "freezeMilestoneFunding",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "startup", "type": "address"},
        ],
        "name": "getMilestoneStatus",
        "outputs": [{"internalType": "bool", "name": "frozen", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "startup", "type": "address"},
            {"internalType": "uint256", "name": "amount",  "type": "uint256"},
        ],
        "name": "allocateMilestoneFunding",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# Deterministic mock contract address (for demo only — set real address for live)
MOCK_CONTRACT_ADDRESS = "0xDeadBeefDeAdBeEf0000000000000000001Stake"


def deterministic_wallet(startup_id: str) -> str:
    """Generate a deterministic mock Ethereum wallet address from startup_id."""
    h = hashlib.sha256(startup_id.encode()).hexdigest()
    return "0x" + h[:40].upper()


def load_triggers(csv_path: Path, top_n: int = 50) -> list[dict]:
    """
    Identify startups that require an oracle-triggered freeze:
      - trust_score < 0.35  (Low Trust)
      - OR risk_severity in (HIGH, SEVERE)
      - OR audit_flag == ANOMALY
      - OR valuation_anomaly == True and revenue_delta_pct > 40
    """
    df = pd.read_csv(csv_path, low_memory=False)
    log.info(f"Loaded {len(df):,} records from master graph")

    for col in ["trust_score", "bl_omega_multiplier", "revenue_delta_pct",
                "intellistake_score", "estimated_valuation_usd"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Build trigger mask
    mask = pd.Series(False, index=df.index)

    if "trust_score" in df.columns:
        low_trust = df["trust_score"].fillna(1.0) < 0.35
        mask |= low_trust
        log.info(f"  Low Trust (< 0.35):      {low_trust.sum():>5}")

    if "risk_severity" in df.columns:
        high_risk = df["risk_severity"].astype(str).str.upper().isin(["HIGH", "SEVERE"])
        mask |= high_risk
        log.info(f"  High/Severe Risk:        {high_risk.sum():>5}")

    if "audit_flag" in df.columns:
        anomaly_flag = df["audit_flag"].astype(str) == "ANOMALY"
        mask |= anomaly_flag
        log.info(f"  MCA Anomaly:             {anomaly_flag.sum():>5}")

    if "valuation_anomaly" in df.columns and "revenue_delta_pct" in df.columns:
        val_anom = (
            df["valuation_anomaly"].astype(str).str.lower().isin(["true", "1"])
            & (df["revenue_delta_pct"].fillna(0) > 40)
        )
        mask |= val_anom
        log.info(f"  Valuation+Delta Anomaly: {val_anom.sum():>5}")

    triggers = df[mask].copy()
    log.info(f"  TOTAL triggers:          {len(triggers):>5} | Capping at {top_n}")
    triggers = triggers.head(top_n)
    return triggers.to_dict(orient="records")


def build_reason(record: dict) -> str:
    """Compose a human-readable reason code for the freeze transaction."""
    parts = []
    trust = record.get("trust_score")
    if isinstance(trust, (int, float)) and trust < 0.35:
        parts.append(f"LOW_TRUST({trust:.2f})")
    sev = str(record.get("risk_severity", "")).upper()
    if sev in ("HIGH", "SEVERE"):
        parts.append(f"RISK_{sev}")
    audit = str(record.get("audit_flag", ""))
    if audit == "ANOMALY":
        delta = record.get("revenue_delta_pct")
        parts.append(f"MCA_ANOMALY({'Δ' + str(round(delta,1)) + '%' if delta else ''})")
    return " | ".join(parts) if parts else "ORACLE_FLAG"


def simulate_tx(record: dict, wallet: str, reason: str, idx: int) -> dict:
    """Build a mock transaction object (dry-run mode)."""
    now = datetime.now(tz=timezone.utc).isoformat()
    startup_id = record.get("startup_id", f"S{idx}")
    name       = record.get("startup_name", startup_id)

    # Encode function selector: keccak256("freezeMilestoneFunding(address,string)")[:4]
    func_sig   = "freezeMilestoneFunding(address,string)"
    selector   = "0x" + hashlib.sha3_256(func_sig.encode()).hexdigest()[:8]
    tx_hash    = "0x" + hashlib.sha256(f"{startup_id}{now}{idx}".encode()).hexdigest()

    return {
        "tx_index":        idx,
        "tx_hash":         tx_hash,
        "status":          "SIMULATED",
        "timestamp":       now,
        "contract":        MOCK_CONTRACT_ADDRESS,
        "function":        "freezeMilestoneFunding",
        "function_selector": selector,
        "from_oracle":     "0xIntelliStakeOracleNode0000000000000001",
        "startup_wallet":  wallet,
        "startup_id":      startup_id,
        "startup_name":    name,
        "sector":          record.get("sector", "Unknown"),
        "trust_score":     record.get("trust_score"),
        "risk_severity":   record.get("risk_severity"),
        "audit_flag":      record.get("audit_flag"),
        "reason":          reason,
        "freeze_action":   "MILESTONE_FUNDING_FROZEN",
        "gas_estimate":    46000 + (len(reason) * 68),   # 68 gas per byte for string
        "block_number":    None,   # null in dry-run
    }


def send_live_tx(record: dict, wallet: str, reason: str, w3, contract, oracle_acct) -> dict:
    """Send a real freeze transaction to a local node (live mode)."""
    now = datetime.now(tz=timezone.utc).isoformat()
    startup_id = record.get("startup_id", "?")
    name       = record.get("startup_name", startup_id)

    # Pad wallet address to valid checksum (mock wallets are uppercase hex — pad remaining)
    padded = "0x" + wallet[2:].ljust(40, "0")[:40]
    try:
        cs_addr = w3.to_checksum_address(padded)
    except Exception:
        cs_addr = padded

    try:
        tx = contract.functions.freezeMilestoneFunding(cs_addr, reason).build_transaction({
            "from":  oracle_acct.address,
            "nonce": w3.eth.get_transaction_count(oracle_acct.address),
            "gas":   200000,
            "gasPrice": w3.to_wei("10", "gwei"),
        })
        signed = w3.eth.account.sign_transaction(tx, private_key=oracle_acct.key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        status  = "SUCCESS" if receipt.status == 1 else "REVERTED"
        return {
            "tx_hash":      tx_hash.hex(),
            "status":       status,
            "timestamp":    now,
            "startup_id":   startup_id,
            "startup_name": name,
            "reason":       reason,
            "gas_used":     receipt.gasUsed,
            "block_number": receipt.blockNumber,
            "freeze_action": "MILESTONE_FUNDING_FROZEN",
        }
    except Exception as e:
        log.warning(f"  TX failed for {name}: {e}")
        return {"tx_hash": None, "status": "FAILED", "error": str(e),
                "startup_id": startup_id, "startup_name": name, "reason": reason}


def run_dry(triggers: list[dict]) -> list[dict]:
    log.info("DRY-RUN mode — simulating freeze transactions (no blockchain interaction)")
    txs = []
    for i, rec in enumerate(triggers, 1):
        wallet = deterministic_wallet(rec.get("startup_id", str(i)))
        reason = build_reason(rec)
        tx     = simulate_tx(rec, wallet, reason, i)
        txs.append(tx)
        log.info(f"  [{i:>3}] SIMULATED | {tx['startup_name'][:30]:<30} | {reason}")
    return txs


def run_live(triggers: list[dict]) -> list[dict]:
    try:
        from web3 import Web3
    except ImportError:
        log.error("web3 not installed. Run: pip install web3")
        sys.exit(1)

    rpc_url     = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
    private_key = os.environ.get("PRIVATE_KEY")
    contract_addr = os.environ.get("CONTRACT_ADDRESS", MOCK_CONTRACT_ADDRESS)

    if not private_key:
        log.error("PRIVATE_KEY env var not set. Export it before running --live.")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        log.error(f"Cannot connect to node at {rpc_url}. Start Hardhat/Anvil first.")
        sys.exit(1)
    log.info(f"Connected to {rpc_url} | Chain ID: {w3.eth.chain_id}")

    oracle_acct = w3.eth.account.from_key(private_key)
    log.info(f"Oracle wallet: {oracle_acct.address}")

    # Checksum contract address
    padded_contract = "0x" + contract_addr[2:].ljust(40, "0")[:40]
    contract = w3.eth.contract(
        address=w3.to_checksum_address(padded_contract),
        abi=INTELLISTAKE_TOKEN_ABI,
    )
    log.info(f"Contract: {padded_contract}")

    txs = []
    for i, rec in enumerate(triggers, 1):
        wallet = deterministic_wallet(rec.get("startup_id", str(i)))
        reason = build_reason(rec)
        log.info(f"  [{i:>3}] Sending → {rec.get('startup_name','?')[:30]} | {reason}")
        tx = send_live_tx(rec, wallet, reason, w3, contract, oracle_acct)
        txs.append(tx)
    return txs


def main():
    parser = argparse.ArgumentParser(description="IntelliStake Oracle Bridge")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Simulate transactions without blockchain (default)")
    parser.add_argument("--live",    action="store_true",
                        help="Send real transactions to local node (overrides --dry-run)")
    parser.add_argument("--top-n",  type=int, default=50,
                        help="Max number of freeze triggers to process (default: 50)")
    args = parser.parse_args()

    live_mode = args.live

    log.info("=" * 62)
    log.info("IntelliStake Oracle Bridge — AI → Blockchain Signal Relay")
    log.info("=" * 62)
    log.info(f"Mode: {'LIVE (Hardhat/Anvil)' if live_mode else 'DRY-RUN (simulation)'}")

    if not GRAPH_CSV.exists():
        log.error(f"Master graph not found: {GRAPH_CSV}")
        log.error("Run Data_Scaling_Engine/master_knowledge_graph.py first.")
        sys.exit(1)

    # 1. Identify Low Trust / High Risk triggers
    log.info("Step 1: Scanning master knowledge graph for freeze triggers …")
    triggers = load_triggers(GRAPH_CSV, top_n=args.top_n)
    log.info(f"Found {len(triggers)} startups requiring oracle action")

    if not triggers:
        log.info("No triggers found — all startups are compliant. Nothing to freeze.")
        return

    # 2. Execute (dry or live)
    log.info(f"Step 2: {'Sending' if live_mode else 'Simulating'} freeze transactions …")
    txs = run_live(triggers) if live_mode else run_dry(triggers)

    # 3. Save transaction log
    output = {
        "run_id":       hashlib.sha256(datetime.now().isoformat().encode()).hexdigest()[:16],
        "mode":         "LIVE" if live_mode else "DRY_RUN",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "contract":     MOCK_CONTRACT_ADDRESS,
        "total_triggers": len(triggers),
        "total_txs":      len(txs),
        "succeeded":      sum(1 for t in txs if t.get("status") in ("SIMULATED","SUCCESS")),
        "failed":         sum(1 for t in txs if t.get("status") == "FAILED"),
        "transactions":   txs,
    }
    with open(TX_LOG_JSON, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info(f"Transaction log saved → {TX_LOG_JSON}")

    # 4. Update portfolio weights JSON — mark oracle_freeze=True
    if WEIGHTS_JSON.exists():
        with open(WEIGHTS_JSON) as f:
            portfolio = json.load(f)
        frozen_ids = {t["startup_id"] for t in txs if t.get("status") in ("SIMULATED","SUCCESS")}
        changed = 0
        for a in portfolio.get("allocations", []):
            if a["startup_id"] in frozen_ids:
                a["oracle_freeze"] = True
                a["portfolio_action"] = "FROZEN — ORACLE LOCK"
                changed += 1
        if changed:
            portfolio["meta"]["oracle_updated_at"] = datetime.now(tz=timezone.utc).isoformat()
            with open(WEIGHTS_JSON, "w") as f:
                json.dump(portfolio, f, indent=2)
            log.info(f"Updated {changed} entries in final_portfolio_weights.json with oracle_freeze=True")

    # 5. Print summary
    print(f"\n{'='*62}")
    print(f"  Oracle Bridge Complete — {'DRY-RUN' if not live_mode else 'LIVE'}")
    print(f"{'='*62}")
    print(f"  Triggers found:   {len(triggers):>5}")
    print(f"  TXs simulated:    {output['succeeded']:>5}")
    print(f"  TXs failed:       {output['failed']:>5}")
    print()
    print(f"  Sample frozen startups:")
    for t in txs[:10]:
        name  = t.get("startup_name","?")[:28]
        rsn   = t.get("reason","?")[:30]
        print(f"  🔒 {name:<28}  reason: {rsn}")
    if len(txs) > 10:
        print(f"  ... and {len(txs)-10} more")
    print(f"\n  📄 oracle_tx_log.json saved.")
    print(f"  ✅ Portfolio weights updated (oracle_freeze flags set).")
    print("=" * 62)


if __name__ == "__main__":
    main()
