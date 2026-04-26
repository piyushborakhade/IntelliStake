"""
IntelliStake Oracle Bridge
Reads AI trust scores from the engine and submits updateTrustScore() transactions
to the IntelliStakeInvestment contract on Sepolia testnet.
"""

import json
import os
import time
from pathlib import Path

BASE = Path(__file__).parent
ENV_FILE = BASE / ".env"
DEPLOYMENT_FILE = BASE / "deployment.json"
ABI_FILE = BASE / "artifacts/contracts/IntelliStakeInvestment.sol/IntelliStakeInvestment.json"
LOG_FILE = BASE / "oracle_tx_log.json"

DEMO_STARTUPS = [
    {"startup_id": "zepto_001",   "startup_name": "Zepto",    "trust_score": 0.82, "dealId": 0},
    {"startup_id": "razorpay_001","startup_name": "Razorpay", "trust_score": 0.91, "dealId": 1},
    {"startup_id": "byjus_001",   "startup_name": "Byju's",   "trust_score": 0.38, "dealId": 2},
]

FREEZE_THRESHOLD = 0.35


def _load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    env.update({k: v for k, v in os.environ.items() if k in ("SEPOLIA_RPC_URL", "PRIVATE_KEY")})
    return env


def run_oracle_bridge():
    print("=" * 56)
    print("  IntelliStake Oracle Bridge  —  Sepolia Testnet")
    print("=" * 56)

    env = _load_env()
    rpc_url = env.get("SEPOLIA_RPC_URL", "")
    private_key = env.get("PRIVATE_KEY", "")

    if not rpc_url or not private_key:
        print("[ERROR] SEPOLIA_RPC_URL or PRIVATE_KEY missing in .env")
        return

    try:
        from web3 import Web3
        from eth_account import Account
    except ImportError:
        print("[ERROR] web3 not installed — run: pip install web3")
        print("        Falling back to simulation mode for demo display.\n")
        _run_simulation()
        return

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print(f"[ERROR] Cannot connect to {rpc_url}")
        return

    account = Account.from_key(private_key)
    print(f"  Oracle wallet : {account.address}")
    print(f"  Network       : Sepolia (chain {w3.eth.chain_id})")
    bal = w3.eth.get_balance(account.address)
    print(f"  ETH balance   : {w3.from_wei(bal, 'ether'):.4f} ETH\n")

    deployment = json.loads(DEPLOYMENT_FILE.read_text())
    contract_address = deployment["contracts"]["IntelliStakeInvestment"]["address"]
    abi = json.loads(ABI_FILE.read_text())["abi"]
    contract = w3.eth.contract(address=contract_address, abi=abi)

    logs = []
    for s in DEMO_STARTUPS:
        name = s["startup_name"]
        trust = s["trust_score"]
        deal_id = s["dealId"]
        trust_int = int(trust * 100)
        frozen = trust < FREEZE_THRESHOLD

        print(f"  [{name}]  trust={trust:.2f}  dealId={deal_id}  {'⚠ FREEZE' if frozen else '✓ OK'}")

        try:
            nonce = w3.eth.get_transaction_count(account.address)
            tx = contract.functions.updateTrustScore(deal_id, trust_int).build_transaction({
                "chainId": 11155111,
                "gas": 120_000,
                "gasPrice": w3.to_wei("2", "gwei"),
                "nonce": nonce,
            })
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            print(f"    tx submitted : {tx_hash.hex()}")
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            status = "SUCCESS" if receipt.status == 1 else "REVERTED"
            print(f"    status       : {status}  block={receipt.blockNumber}")
            print(f"    etherscan    : https://sepolia.etherscan.io/tx/{tx_hash.hex()}\n")

            logs.append({
                "startup_id": s["startup_id"],
                "startup_name": name,
                "trust_score": trust,
                "deal_id": deal_id,
                "trust_int_sent": trust_int,
                "freeze_triggered": frozen,
                "tx_hash": tx_hash.hex(),
                "block": receipt.blockNumber,
                "status": status,
                "network": "sepolia",
            })
        except Exception as e:
            print(f"    [FAILED] {e}\n")
            logs.append({
                "startup_id": s["startup_id"],
                "startup_name": name,
                "trust_score": trust,
                "error": str(e),
                "status": "ERROR",
                "network": "sepolia",
            })
        time.sleep(1)

    LOG_FILE.write_text(json.dumps({"oracle_runs": logs}, indent=2))
    print(f"  Log saved → {LOG_FILE.name}")
    print("=" * 56)


def _run_simulation():
    """Offline demo path when web3 is unavailable."""
    deployment = json.loads(DEPLOYMENT_FILE.read_text())
    contract_address = deployment["contracts"]["IntelliStakeInvestment"]["address"]
    print(f"  Contract : {contract_address}  (Sepolia)")
    print(f"  Mode     : SIMULATION (install web3 for live txns)\n")

    logs = []
    for s in DEMO_STARTUPS:
        trust = s["trust_score"]
        frozen = trust < FREEZE_THRESHOLD
        print(f"  [{s['startup_name']}]  trust={trust:.2f}  "
              f"{'⚠ MILESTONE FROZEN' if frozen else '✓ milestone active'}")
        logs.append({
            "startup_id": s["startup_id"],
            "startup_name": s["startup_name"],
            "trust_score": trust,
            "freeze_triggered": frozen,
            "status": "SIMULATED",
            "network": "sepolia",
        })
        time.sleep(0.3)

    LOG_FILE.write_text(json.dumps({"oracle_runs": logs}, indent=2))
    print(f"\n  Log saved → {LOG_FILE.name}")
    print("=" * 56)


if __name__ == "__main__":
    run_oracle_bridge()
