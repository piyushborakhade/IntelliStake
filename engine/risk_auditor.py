"""
IntelliStake R.A.I.S.E. Framework — Risk Auditor
==================================================
Merged module combining:
  - Execution vetting (GitHub velocity + Founder pedigree)
  - Market traction   (Web traffic + VADER Sentiment)

Reads from unified_data/cleaned/intellistake_startups_clean.json and
unified_data/knowledge_graph/intellistake_master_graph.csv to produce a
unified risk audit report.

Outputs:
  unified_data/outputs/risk_audit_report.json
  unified_data/outputs/risk_audit_report.csv

Usage (from IntelliStake_Final/):
    python engine/risk_auditor.py
    python engine/risk_auditor.py --live        # uses real GitHub token
    python engine/risk_auditor.py --top-n 20    # audit top-N startups only
"""

import os
import csv
import json
import math
import logging
import argparse
import hashlib
import random
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

# ── Optional imports (graceful fallback) ─────────────────────────────────────
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# ── Paths (relative to this file's location inside engine/) ──────────────────
ENGINE_DIR   = Path(__file__).resolve().parent
FINAL_DIR    = ENGINE_DIR.parent
UNIFIED_DATA = FINAL_DIR / "unified_data"
CLEANED_DIR  = UNIFIED_DATA / "cleaned"
GRAPH_DIR    = UNIFIED_DATA / "knowledge_graph"
OUT_DIR      = UNIFIED_DATA / "outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

STARTUPS_FILE = CLEANED_DIR / "intellistake_startups_clean.json"
GRAPH_CSV     = GRAPH_DIR   / "intellistake_master_graph.csv"
AUDIT_JSON    = OUT_DIR     / "risk_audit_report.json"
AUDIT_CSV     = OUT_DIR     / "risk_audit_report.csv"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | risk_auditor | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("risk_auditor")

# ── Scoring constants ─────────────────────────────────────────────────────────
VELOCITY_WEIGHTS = {
    "commits_90d":        0.35,
    "repo_age":           0.20,
    "language_diversity": 0.15,
    "stars":              0.15,
    "contributors":       0.15,
}
TRUST_WEIGHT_VELOCITY = 0.55
TRUST_WEIGHT_PEDIGREE = 0.25
TRUST_WEIGHT_TRACTION = 0.20

RISK_HIGH   = 3.5
RISK_MEDIUM = 2.0
RISK_LOW    = 1.5

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: DATA LOADERS
# ─────────────────────────────────────────────────────────────────────────────

def load_startups(path: Path, top_n: int = None) -> list[dict]:
    """Load startups from unified_data/cleaned/."""
    if not path.exists():
        log.error(f"Startups file not found: {path}")
        return []
    with open(path) as f:
        data = json.load(f)
    if top_n:
        data = data[:top_n]
    log.info(f"Loaded {len(data):,} startups from {path.name}")
    return data


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: EXECUTION VETTING — GitHub Velocity
# ─────────────────────────────────────────────────────────────────────────────

def _mock_github(startup: dict) -> dict:
    """Generate deterministic mock GitHub data from startup fields."""
    seed = int(hashlib.md5(startup["startup_id"].encode()).hexdigest()[:8], 16)
    rng  = random.Random(seed)
    trust = startup.get("trust_score", 0.5) or 0.5
    return {
        "startup_id":    startup["startup_id"],
        "repo":          startup.get("github_repo", "unknown/repo"),
        "commits_90d":   int(trust * rng.randint(30, 200)),
        "repo_age_months": startup.get("repo_age_months", rng.randint(6, 60)),
        "language_count": startup.get("language_count", rng.randint(1, 8)),
        "stars":          rng.randint(0, 2000),
        "contributors":   startup.get("contributors_count", rng.randint(1, 25)),
    }


def _live_github(startup: dict) -> dict:
    """Fetch real GitHub data using GITHUB_TOKEN."""
    repo = startup.get("github_repo", "")
    if not repo or "/" not in repo or not REQUESTS_AVAILABLE:
        return _mock_github(startup)
    headers = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}
    try:
        r = requests.get(f"https://api.github.com/repos/{repo}", headers=headers, timeout=10)
        if r.status_code != 200:
            return _mock_github(startup)
        info = r.json()
        return {
            "startup_id":     startup["startup_id"],
            "repo":           repo,
            "commits_90d":    0,   # would need /commits endpoint with since param
            "repo_age_months": 0,
            "language_count": 1,
            "stars":          info.get("stargazers_count", 0),
            "contributors":   0,
        }
    except Exception:
        return _mock_github(startup)


def _min_max(value, lo, hi) -> float:
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def compute_velocity_score(gh: dict) -> float:
    """Technical Velocity Score [0–1] from GitHub metrics."""
    return (
        VELOCITY_WEIGHTS["commits_90d"]        * _min_max(gh["commits_90d"], 0, 200)
        + VELOCITY_WEIGHTS["repo_age"]         * _min_max(gh["repo_age_months"], 0, 60)
        + VELOCITY_WEIGHTS["language_diversity"] * _min_max(gh["language_count"], 1, 10)
        + VELOCITY_WEIGHTS["stars"]            * _min_max(gh["stars"], 0, 2000)
        + VELOCITY_WEIGHTS["contributors"]     * _min_max(gh["contributors"], 1, 30)
    )


def compute_pedigree_score(startup: dict) -> float:
    """
    Founder Pedigree Score [0–1] estimated from startup-level signals
    (kyc_verified, is_accredited, company_age, valuation_tier).
    In production: replace with Proxycurl LinkedIn fetch.
    """
    score = 0.0
    if startup.get("kyc_verified"):
        score += 0.30
    if startup.get("is_accredited"):
        score += 0.25
    age = min(startup.get("company_age_years", 0) or 0, 20)
    score += (age / 20) * 0.25
    tier_map = {"Unicorn+": 0.20, "Unicorn": 0.15, "Growth": 0.10,
                "Early": 0.05, "Pre-Seed": 0.02}
    score += tier_map.get(startup.get("valuation_tier", ""), 0.05)
    return min(1.0, score)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: MARKET TRACTION — Sentiment + Web Traffic
# ─────────────────────────────────────────────────────────────────────────────

def compute_traction_score(startup: dict) -> float:
    """
    Market Traction Score [0–1] from web traffic, sentiment, and MoM growth.
    In production: replace with SimilarWeb API + live VADER on scraped mentions.
    """
    score = 0.0

    # Web traffic signal (monthly_web_visits)
    visits = startup.get("monthly_web_visits", 0) or 0
    score += _min_max(visits, 0, 5_000_000) * 0.40

    # Sentiment signal (avg_sentiment_polarity already in master data)
    sentiment = startup.get("avg_sentiment_polarity", 0.0) or 0.0
    score += ((sentiment + 1) / 2) * 0.40   # normalize [-1,+1] → [0,1]

    # MoM traffic growth
    mom = startup.get("mom_traffic_change_pct", 0.0) or 0.0
    score += _min_max(mom, -30, 30) * 0.20

    return min(1.0, max(0.0, score))


def compute_vader_sentiment(text: str) -> float:
    """VADER compound score for a single text string. Returns 0.0 if unavailable."""
    if not VADER_AVAILABLE or not text:
        return 0.0
    analyzer = SentimentIntensityAnalyzer()
    return analyzer.polarity_scores(str(text))["compound"]


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: COMPOSITE TRUST SCORE + RISK FLAG
# ─────────────────────────────────────────────────────────────────────────────

def compute_composite_trust(velocity: float, pedigree: float, traction: float) -> float:
    """
    Composite Trust Score [0–1]:
        55% Technical Velocity (GitHub cadence)
        25% Founder Pedigree  (KYC / accreditation / experience)
        20% Market Traction   (web traffic / sentiment / growth)
    """
    return (
        TRUST_WEIGHT_VELOCITY * velocity
        + TRUST_WEIGHT_PEDIGREE * pedigree
        + TRUST_WEIGHT_TRACTION * traction
    )


def compute_risk_flag(startup: dict, trust: float) -> tuple[bool, str, float]:
    """
    Returns (risk_flag_active, severity, bl_omega_multiplier).
    Overrides master data risk with computed trust for demonstration.
    """
    # BL-Omega increases as trust decreases — high uncertainty ↔ low trust
    bl_omega = max(1.0, round((1 - trust) * RISK_HIGH + 1.0, 1))

    # Combine with existing risk signal from master data
    existing_sev = str(startup.get("risk_severity", "NONE")).upper()

    if trust < 0.35 or bl_omega >= RISK_HIGH or existing_sev == "HIGH":
        return True, "HIGH", RISK_HIGH
    elif trust < 0.55 or bl_omega >= RISK_MEDIUM or existing_sev in ("MEDIUM", "MODERATE"):
        return True, "MEDIUM", RISK_MEDIUM
    elif startup.get("risk_flag_active") and existing_sev == "LOW":
        return True, "LOW", RISK_LOW
    else:
        return False, "NONE", 1.0


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: MAIN AUDIT PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def run_risk_audit(top_n: int = None, live: bool = False) -> list[dict]:
    """Run the full risk audit pipeline. Returns list of audit records."""
    startups = load_startups(STARTUPS_FILE, top_n)
    if not startups:
        return []

    fetch_gh = _live_github if (live and GITHUB_TOKEN) else _mock_github

    results  = []
    counters = defaultdict(int)

    log.info(f"Auditing {len(startups):,} startups (mode={'LIVE' if live else 'MOCK'}) …")

    for s in startups:
        gh         = fetch_gh(s)
        velocity   = compute_velocity_score(gh)
        pedigree   = compute_pedigree_score(s)
        traction   = compute_traction_score(s)
        trust      = compute_composite_trust(velocity, pedigree, traction)
        flag, sev, omega = compute_risk_flag(s, trust)
        counters[sev] += 1

        results.append({
            "startup_id":             s["startup_id"],
            "startup_name":           s.get("startup_name", "?"),
            "sector":                 s.get("sector", "?"),
            "country":                s.get("country", "?"),
            # Execution scores
            "technical_velocity_score": round(velocity, 4),
            "founder_pedigree_score":   round(pedigree, 4),
            "market_traction_score":    round(traction, 4),
            # Composite trust
            "audited_trust_score":    round(trust, 4),
            "trust_label":            ("HIGH TRUST" if trust > 0.65
                                       else "MEDIUM TRUST" if trust > 0.45
                                       else "LOW TRUST"),
            # Risk
            "risk_flag_active":       flag,
            "risk_severity":          sev,
            "bl_omega_multiplier":    omega,
            # Existing master signals (pass-through)
            "master_trust_score":     s.get("trust_score"),
            "master_risk_severity":   s.get("risk_severity"),
            "valuation_tier":         s.get("valuation_tier"),
            "estimated_valuation_usd": s.get("estimated_valuation_usd"),
            # GitHub
            "github_repo":            gh.get("repo"),
            "commits_90d":            gh.get("commits_90d"),
            "repo_contributors":      gh.get("contributors"),
            # Audit metadata
            "audited_at":             datetime.now(tz=timezone.utc).isoformat(),
        })

    log.info(f"Audit complete — HIGH: {counters['HIGH']}, MEDIUM: {counters['MEDIUM']}, "
             f"LOW: {counters['LOW']}, NONE: {counters['NONE']}")
    return results


def save_results(results: list[dict]):
    """Save audit results to JSON and CSV."""
    # JSON
    with open(AUDIT_JSON, "w") as f:
        json.dump(results, f, indent=2, default=str)
    log.info(f"JSON saved → {AUDIT_JSON.relative_to(FINAL_DIR)}")

    # CSV
    if results:
        with open(AUDIT_CSV, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        log.info(f"CSV  saved → {AUDIT_CSV.relative_to(FINAL_DIR)}")


def print_summary(results: list[dict]):
    """Print a concise audit summary table."""
    high   = [r for r in results if r["risk_severity"] == "HIGH"]
    medium = [r for r in results if r["risk_severity"] == "MEDIUM"]
    none_  = [r for r in results if r["risk_severity"] == "NONE"]

    print(f"\n{'=' * 62}")
    print(f"  IntelliStake — Risk Audit Summary")
    print(f"{'=' * 62}")
    print(f"  Total audited:  {len(results):>6,}")
    print(f"  HIGH risk:      {len(high):>6,}  🔴")
    print(f"  MEDIUM risk:    {len(medium):>6,}  🟡")
    print(f"  CLEAN:          {len(none_):>6,}  🟢")
    print()
    print(f"  Top 10 HIGH-Risk Startups (flag for oracle freeze):")
    print(f"  {'Startup':<30} {'Trust':>6}  {'Ω':>5}  {'Sector'}")
    print(f"  {'-'*30} {'-'*6}  {'-'*5}  {'-'*16}")
    for r in sorted(high, key=lambda x: x["audited_trust_score"])[:10]:
        print(f"  {r['startup_name'][:30]:<30} {r['audited_trust_score']:>6.3f}  "
              f"{r['bl_omega_multiplier']:>5.1f}  {r['sector'][:16]}")
    print(f"{'=' * 62}\n")


def main():
    parser = argparse.ArgumentParser(description="IntelliStake Risk Auditor")
    parser.add_argument("--top-n", type=int, default=None,
                        help="Audit top-N startups (default: all 50,000)")
    parser.add_argument("--live", action="store_true",
                        help="Use real GitHub API (requires GITHUB_TOKEN env var)")
    args = parser.parse_args()

    log.info("=" * 62)
    log.info("IntelliStake R.A.I.S.E. — Unified Risk Auditor")
    log.info("=" * 62)

    results = run_risk_audit(top_n=args.top_n, live=args.live)
    if not results:
        log.error("No results — check data paths.")
        return

    save_results(results)
    print_summary(results)


if __name__ == "__main__":
    main()
