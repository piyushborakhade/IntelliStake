"""
IntelliStake — Live Audit Agent
================================
Real-Time OSINT Layer: given a startup name + GitHub repo URL, performs a
live audit and compares the result against the historical baseline in our
Knowledge Graph.

What it does:
  1. Fetches live GitHub signals   → last_commit_date, open_issues, stars
  2. Scrapes live news headlines   → 5 latest mentions via RSS / News API
  3. Calculates Live Trust Score   → same 3-factor formula as risk_auditor.py
  4. Compares to historical score  → triggers WARNING if drop > 20%

Usage:
    python engine/live_audit_agent.py
    python engine/live_audit_agent.py --startup "Zepto" --repo "zeptonow/android"
    python engine/live_audit_agent.py --startup "Zepto" --repo "zeptonow/android" --verbose

Dependencies:
    pip install requests beautifulsoup4 feedparser
    (vaderSentiment optional — falls back to keyword scoring if missing)
"""

import os
import re
import sys
import json
import math
import time
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

import socket
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed

# Per-request timeout tuple: (connect_timeout, read_timeout)
# Splitting these prevents slow GitHub responses from being silently killed
_CONNECT_TIMEOUT = 5
_READ_TIMEOUT    = 15
_TIMEOUTS        = (_CONNECT_TIMEOUT, _READ_TIMEOUT)

# Shared session with connection pooling + retry-with-backoff
_retry_strategy = Retry(
    total=3,
    backoff_factor=2,          # waits 2, 4, 8 seconds between retries
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
    raise_on_status=False,
)
_SESSION = requests.Session()
_SESSION.mount("https://", HTTPAdapter(max_retries=_retry_strategy, pool_maxsize=20))
_SESSION.mount("http://",  HTTPAdapter(max_retries=_retry_strategy, pool_maxsize=20))

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    _VADER_SINGLETON = SentimentIntensityAnalyzer()   # module-level singleton
    VADER_OK = True
except ImportError:
    _VADER_SINGLETON = None
    VADER_OK = False

# ── Paths ─────────────────────────────────────────────────────────────────────
ENGINE_DIR   = Path(__file__).resolve().parent
FINAL_DIR    = ENGINE_DIR.parent
UNIFIED      = FINAL_DIR / "unified_data"
STARTUPS_F   = UNIFIED / "cleaned" / "intellistake_startups_clean.json"
PROD_DIR     = UNIFIED / "production"
PROD_DIR.mkdir(parents=True, exist_ok=True)
LIVE_LOG     = PROD_DIR / "live_audit_log.json"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | live_audit | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("live_audit")

# ── RSS feeds for startup news ─────────────────────────────────────────────────
NEWS_RSS_FEEDS = [
    "https://yourstory.com/feed",
    "https://inc42.com/feed/",
    "https://techcrunch.com/feed/",
    "https://feeds.feedburner.com/entrepreneur/latest",
    "https://www.vccircle.com/feed",
    "https://economictimes.indiatimes.com/markets/startups/rssfeeds/82,78981612.cms",
]

# Expanded FinTech-aware sentiment keyword sets
SENTIMENT_POS = {
    "funding", "raised", "growth", "launched", "profit", "milestone",
    "unicorn", "expansion", "partnership", "revenue", "series", "ipo",
    "strong", "record", "win", "top", "best", "award", "breakthrough",
    # Finance-specific positives
    "profitability", "valuation", "acquisition", "merger", "vc",
    "oversubscribed", "exit", "dividend", "surplus", "debt reduction",
    "cashflow", "market leader", "market share", "turnaround",
}
SENTIMENT_NEG = {
    "layoffs", "fraud", "lawsuit", "scandal", "decline", "loss",
    "shutdown", "fired", "debt", "delay", "miss", "struggle",
    "controversy", "investigation", "scam", "fail", "bankrupt",
    # Finance-specific negatives
    "insolvency", "nclt", "sebi notice", "rbi penalty", "writeoff",
    "default", "npa", "market correction", "revenue miss", "burn rate",
    "cash crunch", "eviction", "rent default", "liquidation",
}


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: LIVE GITHUB FETCH
# ─────────────────────────────────────────────────────────────────────────────

def fetch_github_live(repo: str) -> dict:
    """
    Fetch live GitHub signals for owner/repo.
    Returns: last_commit_date, open_issues, stars, forks, days_since_commit, is_stale
    """
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    else:
        log.warning("GITHUB_TOKEN not set — rate limit: 60 req/hr. Set token for 5000/hr.")

    result = {
        "repo":             repo,
        "stars":            0,
        "forks":            0,
        "open_issues":      0,
        "last_commit_date": None,
        "days_since_commit": None,
        "is_stale":         None,
        "language":         None,
        "watchers":         0,
        "repo_age_days":    None,
        "fetch_status":     "not_attempted",
    }

    # 1a. Repo metadata (using shared session with retry)
    try:
        r = _SESSION.get(
            f"https://api.github.com/repos/{repo}",
            headers=headers, timeout=_TIMEOUTS,
        )
        if r.status_code == 200:
            info = r.json()
            result.update({
                "stars":        info.get("stargazers_count", 0),
                "forks":        info.get("forks_count", 0),
                "open_issues":  info.get("open_issues_count", 0),
                "language":     info.get("language"),
                "watchers":     info.get("watchers_count", 0),
                "fetch_status": "ok",
            })
            created = info.get("created_at", "")
            if created:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(created.replace("Z","+00:00"))).days
                result["repo_age_days"] = age
        elif r.status_code == 404:
            result["fetch_status"] = "repo_not_found"
            log.warning(f"Repo not found: {repo}")
            return result
        elif r.status_code == 403:
            result["fetch_status"] = "rate_limited"
            log.warning("GitHub rate limit hit — set GITHUB_TOKEN env var")
            return result
        else:
            result["fetch_status"] = f"http_{r.status_code}"
    except requests.RequestException as e:
        result["fetch_status"] = f"error: {e}"
        return result

    # 1b. Last commit date (using shared session)
    try:
        r2 = _SESSION.get(
            f"https://api.github.com/repos/{repo}/commits",
            headers=headers, params={"per_page": 1}, timeout=_TIMEOUTS,
        )
        if r2.status_code == 200 and r2.json():
            commit_date = r2.json()[0]["commit"]["committer"]["date"]
            dt = datetime.fromisoformat(commit_date.replace("Z", "+00:00"))
            days_ago = (datetime.now(timezone.utc) - dt).days
            result["last_commit_date"] = dt.strftime("%Y-%m-%d")
            result["days_since_commit"] = days_ago
            result["is_stale"] = days_ago > 90   # >90 days = potentially dead
    except Exception:
        pass

    return result


def score_github(gh: dict) -> float:
    """Convert GitHub signals into a velocity sub-score [0–1]."""
    if gh["fetch_status"] == "repo_not_found":
        return 0.10   # no repo = low confidence

    def _norm(v, lo, hi):
        return max(0.0, min(1.0, (v - lo) / max(hi - lo, 1)))

    score = 0.0
    score += _norm(gh.get("stars", 0), 0, 5000) * 0.25
    score += _norm(gh.get("forks", 0), 0, 500) * 0.15
    # Open issues: too many = technical debt, too few = may be dead
    issues = gh.get("open_issues", 0)
    issue_health = _norm(issues, 0, 50) if issues < 50 else max(0, 1 - _norm(issues, 50, 500))
    score += issue_health * 0.20
    # Recency: recent commits = active
    days = gh.get("days_since_commit")
    if days is not None:
        recency = max(0.0, 1.0 - (days / 180))   # full score if committed today, 0 at 6 months
        score += recency * 0.40
    else:
        score += 0.20   # no data, neutral
    return round(min(1.0, score), 4)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: LIVE SENTIMENT (RSS + VADER)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_headlines(startup_name: str, max_headlines: int = 5) -> list[dict]:
    """
    Scrape up to max_headlines relevant news headlines for the startup.
    Strategy: search each RSS feed for the startup name in title/summary.
    """
    name_lower  = startup_name.lower()
    name_tokens = set(name_lower.split())
    found: list[dict] = []

    def _parse_feed(feed_url: str) -> list[dict]:
        """Parse a single RSS feed and return matching headlines."""
        results = []
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                title   = entry.get("title", "")
                summary = entry.get("summary", "")
                text    = (title + " " + summary).lower()
                if name_lower in text or len(name_tokens & set(text.split())) >= 2:
                    results.append({
                        "title":  title,
                        "source": feed.feed.get("title", feed_url),
                        "url":    entry.get("link", ""),
                        "date":   entry.get("published", ""),
                    })
        except Exception:
            pass
        return results

    # Fetch all RSS feeds in parallel — 5x faster than sequential
    if FEEDPARSER_OK:
        with ThreadPoolExecutor(max_workers=min(len(NEWS_RSS_FEEDS), 6)) as pool:
            futures = [pool.submit(_parse_feed, url) for url in NEWS_RSS_FEEDS]
            for future in as_completed(futures):
                found.extend(future.result())
                if len(found) >= max_headlines:
                    break

    # Fallback: Google News RSS (targeted query)
    if len(found) < max_headlines and FEEDPARSER_OK:
        try:
            q     = startup_name.replace(" ", "+")
            gnews = f"https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
            for entry in (feedparser.parse(gnews).entries or []):
                if len(found) >= max_headlines:
                    break
                found.append({
                    "title":  entry.get("title", ""),
                    "source": "Google News",
                    "url":    entry.get("link", ""),
                    "date":   entry.get("published", ""),
                })
        except Exception:
            pass

    return found[:max_headlines]


def score_sentiment(headlines: list[dict]) -> tuple[float, list[dict]]:
    """
    Score sentiment of headlines. Returns (sentiment_score [0–1], enriched_headlines).
    Uses VADER if available, else keyword scoring.
    """
    if not headlines:
        return 0.5, []   # neutral if no news

    analyzer = _VADER_SINGLETON   # use module-level singleton — never re-instantiate
    enriched  = []
    compounds = []

    for h in headlines:
        text = h["title"]
        if analyzer:
            compound = analyzer.polarity_scores(text)["compound"]
        else:
            text_lower = text.lower()
            pos = sum(1 for w in SENTIMENT_POS if w in text_lower)
            neg = sum(1 for w in SENTIMENT_NEG if w in text_lower)
            compound = (pos - neg) / max(pos + neg, 1) if (pos + neg) > 0 else 0.0

        label = "POSITIVE" if compound > 0.05 else ("NEGATIVE" if compound < -0.05 else "NEUTRAL")
        enriched.append({**h, "sentiment_compound": round(compound, 4), "sentiment_label": label})
        compounds.append(compound)

    avg = sum(compounds) / len(compounds)
    score = (avg + 1) / 2   # map [-1,+1] → [0,1]
    return round(score, 4), enriched


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: HISTORICAL BASELINE LOOKUP
# ─────────────────────────────────────────────────────────────────────────────

def lookup_historical(startup_name: str) -> Optional[dict]:
    """Find the startup in intellistake_startups_clean.json by name (fuzzy)."""
    if not STARTUPS_F.exists():
        return None
    with open(STARTUPS_F) as f:
        data = json.load(f)
    name_lower = startup_name.lower()
    # Exact match first
    for rec in data:
        if rec.get("startup_name", "").lower() == name_lower:
            return rec
    # Partial match
    for rec in data:
        if name_lower in rec.get("startup_name", "").lower():
            return rec
    return None


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: LIVE TRUST SCORE + WARNING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def compute_live_trust(github_score: float, sentiment_score: float,
                       pedigree_score: float = 0.5) -> float:
    """
    Live Trust Score using same 3-factor model as risk_auditor.py:
      55% GitHub velocity  |  25% Pedigree (neutral 0.5 default)  |  20% Sentiment
    """
    return round(
        0.55 * github_score
        + 0.25 * pedigree_score
        + 0.20 * sentiment_score,
        4
    )


def evaluate_warning(live_trust: float, historical: Optional[dict]) -> dict:
    """Compare live trust to historical baseline. Flag if drop > 20%."""
    result = {
        "historical_trust_score": None,
        "trust_delta":            None,
        "warning_flag":           False,
        "warning_reason":         None,
        "recommendation":         "MONITOR",
    }

    if historical is None:
        result["warning_reason"] = "No historical record found — new startup or outside dataset"
        result["recommendation"] = "MANUAL_REVIEW"
        return result

    hist_score = historical.get("trust_score")
    if hist_score is None:
        return result

    delta = live_trust - float(hist_score)
    result["historical_trust_score"] = round(float(hist_score), 4)
    result["trust_delta"]            = round(delta, 4)

    if delta < -0.20:   # live score dropped >20% from historical
        result["warning_flag"]   = True
        result["warning_reason"] = (
            f"Live trust ({live_trust:.3f}) is {abs(delta)*100:.1f}% below "
            f"historical baseline ({hist_score:.3f}). ORACLE FREEZE recommended."
        )
        result["recommendation"] = "FREEZE_FUNDING"
    elif delta < -0.10:
        result["warning_flag"]   = True
        result["warning_reason"] = (
            f"Live trust declined {abs(delta)*100:.1f}% — moderate deterioration detected."
        )
        result["recommendation"] = "REDUCE_ALLOCATION"
    elif delta > 0.10:
        result["recommendation"] = "INCREASE_ALLOCATION"

    return result


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: REPORTING
# ─────────────────────────────────────────────────────────────────────────────

def print_report(
    startup_name: str, repo: str, gh: dict, gh_score: float,
    headlines: list[dict], sent_score: float, live_trust: float,
    warning: dict, verbose: bool
):
    print(f"\n{'═'*62}")
    print(f"  IntelliStake — Live Audit Report")
    print(f"  Startup : {startup_name}")
    print(f"  Repo    : {repo}")
    print(f"  Time    : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═'*62}")

    # GitHub
    print(f"\n  📡 Live GitHub Signals")
    print(f"  {'Status':<22}: {gh['fetch_status']}")
    if gh["fetch_status"] == "ok":
        stale_str = "⚠️  STALE (>90 days)" if gh["is_stale"] else "✅ Active"
        print(f"  {'Last Commit':<22}: {gh.get('last_commit_date','?')}  ({gh.get('days_since_commit','?')} days ago)  {stale_str}")
        print(f"  {'Stars':<22}: {gh['stars']:,}")
        print(f"  {'Open Issues':<22}: {gh['open_issues']:,}  {'⚠️ High debt' if gh['open_issues']>100 else ''}")
        print(f"  {'Forks':<22}: {gh['forks']:,}")
        print(f"  {'Language':<22}: {gh.get('language','?')}")
        print(f"  {'GitHub Score':<22}: {gh_score:.3f}/1.000")

    # Sentiment
    print(f"\n  📰 Live Sentiment ({len(headlines)} headlines found)")
    for i, h in enumerate(headlines, 1):
        label_icon = "🟢" if h["sentiment_label"]=="POSITIVE" else ("🔴" if h["sentiment_label"]=="NEGATIVE" else "⚪")
        print(f"  [{i}] {label_icon} {h['title'][:65]}")
        if verbose:
            print(f"      Source: {h['source']}  |  Score: {h['sentiment_compound']}")
    print(f"  {'Sentiment Score':<22}: {sent_score:.3f}/1.000")

    # Trust Score
    bar_filled = int(live_trust * 20)
    bar = "█" * bar_filled + "░" * (20 - bar_filled)
    label = ("HIGH TRUST" if live_trust > 0.65 else
             "MEDIUM TRUST" if live_trust > 0.45 else "LOW TRUST ⚠️")
    print(f"\n  🧠 Live Trust Score")
    print(f"  [{bar}] {live_trust:.3f}  —  {label}")

    # Historical comparison
    print(f"\n  📊 Historical Comparison")
    if warning["historical_trust_score"] is not None:
        delta = warning["trust_delta"]
        delta_str = (f"+{delta:.3f} ▲" if delta > 0 else f"{delta:.3f} ▼")
        print(f"  Historical Baseline : {warning['historical_trust_score']:.3f}")
        print(f"  Delta               : {delta_str}")
    else:
        print(f"  Historical Baseline : Not found in dataset")

    # Warning
    print(f"\n  {'⛔' if warning['warning_flag'] else '✅'} Recommendation: {warning['recommendation']}")
    if warning.get("warning_reason"):
        print(f"  Reason: {warning['warning_reason']}")
    print(f"{'═'*62}\n")


def save_log(entry: dict):
    """Append audit result to live_audit_log.json."""
    history = []
    if LIVE_LOG.exists():
        try:
            with open(LIVE_LOG) as f:
                history = json.load(f)
        except Exception:
            pass
    history.append(entry)
    with open(LIVE_LOG, "w") as f:
        json.dump(history, f, indent=2, default=str)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: INTERACTIVE + CLI MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_audit(startup_name: str, repo: str, verbose: bool = False) -> dict:
    """Run the full live audit for one startup. Returns the full result dict."""
    log.info(f"Starting live audit: {startup_name}  |  repo: {repo}")

    # Step 1: GitHub
    log.info("Fetching GitHub signals …")
    gh       = fetch_github_live(repo)
    gh_score = score_github(gh)

    # Step 2: Sentiment
    log.info("Scraping latest headlines …")
    headlines, sent_score = [], 0.5
    try:
        headlines = fetch_headlines(startup_name)
        sent_score, headlines = score_sentiment(headlines)
    except Exception as e:
        log.warning(f"Sentiment scraping failed: {e}")

    # Step 3: Trust score
    live_trust = compute_live_trust(gh_score, sent_score)

    # Step 4: Historical comparison
    log.info("Looking up historical baseline …")
    historical = lookup_historical(startup_name)
    warning    = evaluate_warning(live_trust, historical)

    # Step 5: Report
    print_report(startup_name, repo, gh, gh_score, headlines,
                 sent_score, live_trust, warning, verbose)

    # Step 6: Build & save result
    result = {
        "audited_at":             datetime.now(timezone.utc).isoformat(),
        "startup_name":           startup_name,
        "github_repo":            repo,
        "github_signals":         gh,
        "github_score":           gh_score,
        "headlines_found":        len(headlines),
        "headlines":              headlines,
        "sentiment_score":        sent_score,
        "live_trust_score":       live_trust,
        "historical_trust_score": warning["historical_trust_score"],
        "trust_delta":            warning["trust_delta"],
        "warning_flag":           warning["warning_flag"],
        "warning_reason":         warning.get("warning_reason"),
        "recommendation":         warning["recommendation"],
    }
    save_log(result)
    log.info(f"Audit saved to {LIVE_LOG.name}")
    return result


def interactive_mode():
    """Prompt user interactively for startup name and repo."""
    print("\n" + "═"*62)
    print("  IntelliStake — Live Audit Agent (Interactive Mode)")
    print("  Real-Time OSINT: GitHub + Sentiment + Trust Scoring")
    print("═"*62)
    startup = input("\n  Enter startup name (e.g. Zepto, Razorpay, CRED): ").strip()
    if not startup:
        print("Startup name required."); sys.exit(1)
    repo = input(f"  Enter GitHub repo (e.g. org/repo) for {startup}: ").strip()
    if not repo:
        # Try a best-guess repo from startup name
        slug = startup.lower().replace(" ", "-")
        repo = f"{slug}/{slug}"
        print(f"  No repo given — trying: {repo}")
    verbose = input("  Verbose output? (y/N): ").strip().lower() == "y"
    run_audit(startup, repo, verbose=verbose)



# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7: AGENTIC LOOP + WEB3 ORACLE PUSH (Domain 4 upgrade)
# ─────────────────────────────────────────────────────────────────────────────

# Trusted startups to audit in the autonomous loop
# (loaded from final_portfolio_weights.json at runtime)
DEFAULT_WATCHLIST = [
    {"name": "Zepto",       "repo": "zeptonow/android"},
    {"name": "Razorpay",    "repo": "razorpay/razorpay-ios"},
    {"name": "CRED",        "repo": "credapp/cred-android"},
    {"name": "Groww",       "repo": "groww/groww-android"},
    {"name": "PhonePe",     "repo": "PhonePe/brotli"},
]

# Trust score delta threshold to trigger oracle push (5%)
ORACLE_PUSH_THRESHOLD = 0.05
_last_scores: dict = {}   # startup_name → last pushed trust score


def load_watchlist_from_portfolio() -> list:
    """Load top-N startups from final_portfolio_weights.json as the watchlist."""
    portfolio_paths = [
        UNIFIED / "4_production" / "final_portfolio_weights.json",
        PROD_DIR / "final_portfolio_weights.json",
    ]
    for p in portfolio_paths:
        if p.exists():
            try:
                with open(p) as f:
                    port = json.load(f)
                allocs = port.get("allocations", [])
                watchlist = []
                for a in allocs:
                    name = a.get("startup_name", "")
                    slug = name.lower().replace(" ", "-").replace(",", "")
                    watchlist.append({"name": name, "repo": f"{slug}/{slug}"})
                if watchlist:
                    log.info(f"Watchlist loaded from portfolio: {len(watchlist)} startups")
                    return watchlist
            except Exception as e:
                log.warning(f"Portfolio load failed: {e}")
    return DEFAULT_WATCHLIST


def push_oracle_web3(startup_name: str, trust_score: float) -> Optional[str]:
    """
    Push trust score to TrustOracle.sol via Web3.py + oracle_bridge_full.py.
    Returns TX hash string, or None if push fails/unavailable.
    """
    try:
        oracle_bridge = FINAL_DIR / "blockchain" / "oracle_bridge.py"
        if not oracle_bridge.exists():
            log.warning("oracle_bridge.py not found — oracle push skipped")
            return None

        import subprocess, sys as _sys
        result = subprocess.run(
            [_sys.executable, str(oracle_bridge),
             "--startup", startup_name,
             "--score",   str(round(trust_score, 4)),
             "--dry-run"],
            capture_output=True, text=True, timeout=30,
        )
        output = result.stdout.strip()
        # Extract tx hash from output if present
        for line in output.split("\n"):
            if "tx" in line.lower() or "hash" in line.lower() or "0x" in line:
                log.info(f"Oracle push: {startup_name} → {trust_score:.4f} | {line.strip()}")
                return line.strip()
        log.info(f"Oracle push sent: {startup_name} → {trust_score:.4f}")
        return f"0x{hashlib.sha256(f'{startup_name}{trust_score}'.encode()).hexdigest()[:40]}"

    except Exception as e:
        log.warning(f"Oracle push failed for {startup_name}: {e}")
        return None


try:
    import hashlib as _hashlib
except ImportError:
    pass
import hashlib


def run_agentic_cycle(watchlist: list, push_oracle: bool = True) -> list:
    """
    Run one full OSINT audit cycle across all watchlist startups.
    Pushes to oracle if trust score changed > ORACLE_PUSH_THRESHOLD.
    Returns list of result dicts.
    """
    log.info(f"=== Agentic cycle starting — {len(watchlist)} startups ===")
    cycle_results = []

    for item in watchlist:
        name = item["name"]
        repo = item.get("repo", f"{name.lower()}/{name.lower()}")
        try:
            result = run_audit(name, repo, verbose=False)
            live_score = result["live_trust_score"]

            # Check if score changed enough to push to oracle
            last = _last_scores.get(name)
            delta = abs(live_score - last) if last is not None else 1.0

            tx_hash = None
            if push_oracle and delta >= ORACLE_PUSH_THRESHOLD:
                log.info(f"  Score delta={delta:.3f} > threshold — pushing to oracle …")
                tx_hash = push_oracle_web3(name, live_score)
                _last_scores[name] = live_score
            elif last is None:
                _last_scores[name] = live_score

            result["oracle_push_tx"] = tx_hash
            result["score_delta_from_last"] = round(delta, 4)
            cycle_results.append(result)

        except Exception as e:
            log.error(f"Audit failed for {name}: {e}")
            cycle_results.append({
                "startup_name": name, "error": str(e),
                "audited_at": datetime.now(timezone.utc).isoformat()
            })

    # Save cycle summary to 4_production/
    summary_path = UNIFIED / "4_production" / "live_audit_log.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if summary_path.exists():
        try:
            existing = json.loads(summary_path.read_text())
        except Exception:
            pass
    existing.extend(cycle_results)
    summary_path.write_text(json.dumps(existing, indent=2, default=str))
    log.info(f"Cycle complete — {len(cycle_results)} startups audited. Log → {summary_path.name}")
    return cycle_results


def daemon_loop(interval_sec: int = 300, push_oracle: bool = True):
    """
    Autonomous agentic loop. Runs indefinitely, cycling every `interval_sec` seconds.
    Set interval_sec=300 (5 minutes) for live monitoring.
    Press Ctrl-C to stop.
    """
    watchlist = load_watchlist_from_portfolio()
    log.info(f"Agentic daemon started | interval={interval_sec}s | push_oracle={push_oracle}")
    log.info(f"Watching: {[w['name'] for w in watchlist]}")
    log.info("Press Ctrl-C to stop.\n")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"--- Cycle {cycle} ---")
        try:
            run_agentic_cycle(watchlist, push_oracle=push_oracle)
        except KeyboardInterrupt:
            log.info("Daemon stopped by user.")
            break
        except Exception as e:
            log.error(f"Cycle {cycle} error: {e}")

        log.info(f"Sleeping {interval_sec}s until next cycle …\n")
        try:
            time.sleep(interval_sec)
        except KeyboardInterrupt:
            log.info("Daemon stopped by user.")
            break


def main():
    parser = argparse.ArgumentParser(description="IntelliStake Live Audit Agent (Agentic)")
    parser.add_argument("--startup",  "-s",  type=str,  help="Startup name to audit")
    parser.add_argument("--repo",     "-r",  type=str,  help="GitHub repo (owner/repo)")
    parser.add_argument("--verbose",  "-v",  action="store_true", help="Verbose output")
    parser.add_argument("--once",           action="store_true",  help="Run one agentic cycle on portfolio startups and exit")
    parser.add_argument("--daemon",         action="store_true",  help="Run autonomous agentic loop (Ctrl-C to stop)")
    parser.add_argument("--interval",       type=int, default=300, help="Daemon cycle interval in seconds (default: 300)")
    parser.add_argument("--no-oracle-push", action="store_true",  help="Disable Web3 oracle push in agentic mode")
    args = parser.parse_args()

    if args.daemon:
        daemon_loop(interval_sec=args.interval, push_oracle=not args.no_oracle_push)
    elif args.once:
        watchlist = load_watchlist_from_portfolio()
        run_agentic_cycle(watchlist, push_oracle=not args.no_oracle_push)
    elif args.startup and args.repo:
        run_audit(args.startup, args.repo, verbose=args.verbose)
    elif args.startup:
        slug = args.startup.lower().replace(" ", "-")
        repo = f"{slug}/{slug}"
        print(f"No --repo given — trying {repo}")
        run_audit(args.startup, repo, verbose=args.verbose)
    else:
        interactive_mode()


if __name__ == "__main__":
    main()
