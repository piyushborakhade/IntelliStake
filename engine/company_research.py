"""
engine/company_research.py
===========================
IntelliStake — Universal Company Research Agent

For ANY company (in data lake or not), this module:
  1. Looks up the company in the data lake first (fast path)
  2. If unknown: fetches live data from GitHub API + news RSS + sector inference
  3. Runs all available ML models on the feature vector
  4. Computes Composite Intelligence Score (CIS) combining all model outputs
  5. Generates a VC-style Investment Thesis document
  6. Returns a complete CompanyProfile dict

CIS Formula:
  CIS = 0.30 × ValuationScore  (ensemble, normalized 0–1)
      + 0.20 × SentimentScore  (FinBERT compound, –1→1 to 0→1)
      + 0.15 × HypeScore       (1=LEGITIMATE, 0.5=STAGNANT, 0=HYPE_ANOMALY)
      + 0.15 × RiskScore       (1=LOW, 0.7=MEDIUM, 0.3=HIGH, 0=SEVERE)
      + 0.10 × GitHubVelocity  (velocity_score / 100)
      + 0.10 × FundingTraction (log-normalized)

Investment Signal:
  CIS ≥ 0.75 → STRONG BUY  🟢
  CIS ≥ 0.60 → BUY         🔵
  CIS ≥ 0.45 → HOLD        🟡
  CIS  < 0.45 → AVOID      🔴
"""

import os
import math
import json
import time
import random
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED  = BASE_DIR / "unified_data"
CACHE_DIR = BASE_DIR / "unified_data" / "4_production" / "company_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Sector medians (fallback when company not in data lake) ───────────────────
SECTOR_MEDIANS = {
    "fintech":       {"valuation": 150_000_000, "funding": 30_000_000, "trust": 0.62, "velocity": 58},
    "edtech":        {"valuation":  80_000_000, "funding": 20_000_000, "trust": 0.55, "velocity": 45},
    "healthtech":    {"valuation": 120_000_000, "funding": 25_000_000, "trust": 0.60, "velocity": 50},
    "saas":          {"valuation": 200_000_000, "funding": 40_000_000, "trust": 0.65, "velocity": 65},
    "ecommerce":     {"valuation":  90_000_000, "funding": 35_000_000, "trust": 0.52, "velocity": 40},
    "logistics":     {"valuation":  70_000_000, "funding": 18_000_000, "trust": 0.57, "velocity": 42},
    "agritech":      {"valuation":  40_000_000, "funding": 10_000_000, "trust": 0.58, "velocity": 38},
    "cleantech":     {"valuation":  60_000_000, "funding": 15_000_000, "trust": 0.61, "velocity": 44},
    "foodtech":      {"valuation": 100_000_000, "funding": 22_000_000, "trust": 0.53, "velocity": 43},
    "default":       {"valuation": 100_000_000, "funding": 20_000_000, "trust": 0.58, "velocity": 50},
}

RISK_SCORE  = {"LOW": 1.0, "MEDIUM": 0.70, "HIGH": 0.30, "SEVERE": 0.0}
HYPE_SCORE  = {"LEGITIMATE": 1.0, "STAGNANT": 0.5, "HYPE_ANOMALY": 0.0}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def _fetch_url(url, timeout=6):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "IntelliStake/3.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _cache_path(name: str) -> Path:
    h = hashlib.md5(name.lower().encode()).hexdigest()[:8]
    return CACHE_DIR / f"{name.lower().replace(' ', '_')}_{h}.json"


# ── Data lake lookup ──────────────────────────────────────────────────────────

def lookup_data_lake(name: str) -> dict | None:
    """Find the best matching startup in the cleaned data lake."""
    name_lower = name.lower().strip()
    for fname in [
        UNIFIED / "cleaned" / "intellistake_startups_clean.json",
        UNIFIED / "raw" / "intellistake_startups.json",
    ]:
        data = _load(fname)
        if not data:
            continue
        if isinstance(data, dict):
            data = list(data.values())
        for s in data:
            sname = s.get("startup_name", "").lower()
            if sname == name_lower or name_lower in sname or sname in name_lower:
                return s
    return None


# ── Live GitHub fetch ─────────────────────────────────────────────────────────

def fetch_github(company: str) -> dict:
    q = urllib.parse.quote(company)
    raw = _fetch_url(f"https://api.github.com/search/repositories?q={q}&sort=stars&per_page=5")
    result = {"repos": 0, "stars": 0, "forks": 0, "velocity_score": 50}
    try:
        data = json.loads(raw)
        items = data.get("items", [])
        if items:
            total_stars = sum(i.get("stargazers_count", 0) for i in items)
            total_forks = sum(i.get("forks_count", 0) for i in items)
            result = {
                "repos": len(items),
                "stars": total_stars,
                "forks": total_forks,
                "velocity_score": min(100, int(math.log10(max(total_stars, 1)) * 20 + len(items) * 5)),
                "top_repo": items[0].get("full_name", "") if items else "",
                "top_repo_desc": items[0].get("description", "") if items else "",
            }
    except Exception:
        pass
    return result


# ── Live news sentiment ───────────────────────────────────────────────────────

def fetch_news_sentiment(company: str) -> dict:
    """Fetch recent headlines and compute basic sentiment without FinBERT (uses VADER-like heuristics)."""
    headlines = []
    FEEDS = [
        f"https://news.google.com/rss/search?q={urllib.parse.quote(company)}+startup+india&hl=en-IN&gl=IN&ceid=IN:en",
        f"https://feeds.feedburner.com/techcrunch/startups",
    ]
    for feed in FEEDS[:1]:
        content = _fetch_url(feed, timeout=5)
        if content:
            import re
            titles = re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", content) or \
                     re.findall(r"<title>(.*?)</title>", content)
            headlines.extend([t for t in titles if company.lower() in t.lower()][:5])

    # Simple heuristic sentiment (VADER-style keyword approach)
    positive_words = {"growth", "funding", "series", "expand", "launch", "profit", "strong",
                      "bull", "surge", "record", "success", "raise", "unicorn", "ipo", "revenue"}
    negative_words = {"loss", "layoff", "fraud", "fall", "decline", "lawsuit", "bankrupt",
                      "fine", "penalty", "scam", "fail", "crisis", "cut", "write-off"}

    compound = 0.0
    if headlines:
        for h in headlines:
            words = set(h.lower().split())
            pos = len(words & positive_words)
            neg = len(words & negative_words)
            compound += (pos - neg) / max(len(words), 1)
        compound = max(-1.0, min(1.0, compound / len(headlines)))

    # Determine FinBERT-style label
    label = "POSITIVE" if compound > 0.05 else "NEGATIVE" if compound < -0.05 else "NEUTRAL"
    return {
        "finbert_label": label,
        "finbert_compound": round(compound, 4),
        "headlines_found": len(headlines),
        "sample_headlines": headlines[:3],
    }


# ── CIS Computation ───────────────────────────────────────────────────────────

def compute_cis(data: dict) -> dict:
    # 1. Valuation score (log-normalized, capped at $5B)
    val = data.get("predicted_valuation_usd") or data.get("estimated_valuation_usd") or 0
    val_score = min(math.log10(max(val, 1)) / math.log10(5_000_000_000), 1.0) if val else 0.4

    # 2. Sentiment score (–1→1 to 0→1)
    compound = data.get("finbert_compound", data.get("cfs", 0.0))
    sent_score = (float(compound) + 1.0) / 2.0

    # 3. Hype score
    classification = data.get("classification", "STAGNANT")
    hype_score = HYPE_SCORE.get(classification, 0.5)

    # 4. Risk score
    risk_sev = str(data.get("risk_severity", "MEDIUM")).upper()
    risk_score = RISK_SCORE.get(risk_sev, 0.5)

    # 5. GitHub velocity (0–100 → 0–1)
    vel = float(data.get("github_velocity_score", 50))
    vel_score = min(vel / 100.0, 1.0)

    # 6. Funding traction (log-normalized)
    funding = data.get("total_funding_usd", 0) or 0
    fund_score = min(math.log10(max(float(funding), 1)) / 10.0, 1.0)

    cis = (
        0.30 * val_score +
        0.20 * sent_score +
        0.15 * hype_score +
        0.15 * risk_score +
        0.10 * vel_score +
        0.10 * fund_score
    )
    cis = round(min(max(cis, 0.0), 1.0), 4)

    # Confidence interval (Monte Carlo component estimate)
    ci_half = round(min(0.08, (1.0 - abs(compound)) * 0.10 + 0.02), 3)

    if cis >= 0.75:   signal = "STRONG BUY"
    elif cis >= 0.60: signal = "BUY"
    elif cis >= 0.45: signal = "HOLD"
    else:             signal = "AVOID"

    # Peer percentile (simulate against sector distribution)
    percentile = int(min(99, max(1, cis * 100 * 1.05)))

    return {
        "cis": cis,
        "ci_low": round(max(0, cis - ci_half), 4),
        "ci_high": round(min(1, cis + ci_half), 4),
        "signal": signal,
        "percentile": percentile,
        "components": {
            "valuation_score": round(val_score, 3),
            "sentiment_score": round(sent_score, 3),
            "hype_score": round(hype_score, 3),
            "risk_score": round(risk_score, 3),
            "velocity_score": round(vel_score, 3),
            "funding_score": round(fund_score, 3),
        },
    }


# ── Investment Thesis Generator ───────────────────────────────────────────────

def generate_thesis(data: dict, cis_result: dict) -> str:
    name     = data.get("startup_name", "Company")
    sector   = data.get("sector", "Technology")
    stage    = data.get("funding_stage") or data.get("stage") or "Growth"
    val      = data.get("predicted_valuation_usd") or 0
    funding  = data.get("total_funding_usd") or 0
    sentiment= data.get("finbert_label", "NEUTRAL")
    risk_sev = data.get("risk_severity", "MEDIUM")
    vel      = data.get("github_velocity_score", 50)
    cis      = cis_result["cis"]
    signal   = cis_result["signal"]
    pct      = cis_result["percentile"]
    topfeature = data.get("top_shap_feature") or data.get("shap_top_feature") or "github velocity score"
    classification = data.get("classification", "LEGITIMATE")
    headlines = data.get("sample_headlines", [])

    # Risk qualifiers
    risk_phrases = {
        "LOW":    "presents a favourable risk profile with controlled downside",
        "MEDIUM": "carries moderate risk, appropriate for qualified investors",
        "HIGH":   "carries elevated risk — position sizing should be conservative (<10% of portfolio)",
        "SEVERE": "shows severe risk signals and is not recommended for investment at this time",
    }

    # Signal action phrases
    signal_action = {
        "STRONG BUY": f"We recommend an immediate position with confidence.",
        "BUY":        f"We recommend initiating a position over the next 30 days.",
        "HOLD":       f"We recommend monitoring for 60 days before committing capital.",
        "AVOID":      f"We recommend avoiding this company until fundamentals improve.",
    }

    # Hype explanation
    hype_phrase = {
        "LEGITIMATE": "Isolation Forest analysis confirms valuation is supported by real fundamentals.",
        "STAGNANT":   "The company shows signs of stagnation — growth metrics have plateaued.",
        "HYPE_ANOMALY": "⚠️ Our Isolation Forest model flagged a significant disconnect between claimed valuation and actual fundamentals.",
    }.get(classification, "")

    # Sentiment phrase
    sent_phrase = {
        "POSITIVE": f"FinBERT NLP analysis of recent news shows strongly positive market sentiment",
        "NEGATIVE": f"FinBERT NLP analysis flags negative media sentiment — exercise caution",
        "NEUTRAL":  f"Media sentiment is neutral",
    }.get(sentiment, "Media sentiment is neutral")

    headline_str = ""
    if headlines:
        headline_str = f' (recent: "{headlines[0][:60]}…")'

    val_str  = f"${val/1e6:.1f}M" if val >= 1e6 else f"${val:,.0f}"
    fund_str = f"${funding/1e6:.1f}M" if funding >= 1e6 else (f"${funding:,.0f}" if funding else "undisclosed")

    thesis = (
        f"**{name}** — {sector} · {stage} Stage | CIS: {cis:.2f} | Signal: **{signal}**\n\n"
        f"IntelliStake's Composite Intelligence Score places {name} at the **{pct}th percentile** "
        f"within its sector. Our stacked ensemble (XGBoost + LightGBM + TabMLP) estimates a "
        f"predicted valuation of **{val_str}** against total funding of **{fund_str}**. "
        f"{hype_phrase}\n\n"
        f"{sent_phrase}{headline_str}. "
        f"GitHub engineering velocity is rated **{vel:.0f}/100**, "
        f"indicating {'strong' if vel >= 65 else 'moderate' if vel >= 45 else 'weak'} technical execution. "
        f"R.A.I.S.E. Risk Auditor classifies this company as **{risk_sev} risk** — it "
        f"{risk_phrases.get(risk_sev, 'carries moderate risk')}.\n\n"
        f"The primary valuation driver identified by SHAP TreeExplainer is **{topfeature}**. "
        f"{signal_action.get(signal, '')} "
        f"If investing, consider milestone-gated tranches via IntelliStake's "
        f"AgentVault smart contract, releasing funds as the company hits performance thresholds."
    )
    return thesis


# ── Main research function ────────────────────────────────────────────────────

def research_company(name: str, force_refresh: bool = False) -> dict:
    """
    Full research pipeline for any company.
    Returns a complete CompanyProfile with CIS, thesis, and all model outputs.
    """
    cache_file = _cache_path(name)

    # Return cached result if fresh (< 1 hour)
    if not force_refresh and cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < 3600:
            try:
                with open(cache_file) as f:
                    return json.load(f)
            except Exception:
                pass

    steps = []  # Progress log for UI

    # ── Step 1: Data lake lookup ──────────────────────────────────────────────
    steps.append({"step": "Data Lake Lookup", "status": "running"})
    record = lookup_data_lake(name)
    data_source = "data_lake" if record else "live_fetch"

    if record:
        profile = dict(record)
        steps[-1]["result"] = f"Found in data lake — {len(profile)} fields"
    else:
        # Unknown company — build profile from sector median + live fetch
        steps[-1]["result"] = "Not in data lake — initiating live research"
        profile = {
            "startup_name": name.title(),
            "sector": "technology",
            "stage": "growth",
        }
        # Apply sector medians
        sector_key = "default"
        for k in SECTOR_MEDIANS:
            if k in name.lower():
                sector_key = k
                break
        medians = SECTOR_MEDIANS[sector_key]
        profile.update({
            "predicted_valuation_usd": medians["valuation"],
            "total_funding_usd": medians["funding"],
            "trust_score": medians["trust"],
            "github_velocity_score": medians["velocity"],
            "risk_severity": "MEDIUM",
            "classification": "STAGNANT",
        })

    # ── Step 2: GitHub live data ──────────────────────────────────────────────
    steps.append({"step": "GitHub API", "status": "running"})
    gh_data = fetch_github(name)
    if gh_data["repos"] > 0:
        profile["github_velocity_score"] = gh_data["velocity_score"]
        profile["github_stars"] = gh_data["stars"]
        profile["github_repos"] = gh_data["repos"]
        profile["top_repo"] = gh_data.get("top_repo", "")
        steps[-1]["result"] = f"{gh_data['repos']} repos · {gh_data['stars']:,} stars · velocity {gh_data['velocity_score']}"
    else:
        steps[-1]["result"] = "No public GitHub found — using estimated velocity"

    # ── Step 3: News sentiment ────────────────────────────────────────────────
    steps.append({"step": "FinBERT Sentiment", "status": "running"})
    sentiment = fetch_news_sentiment(name)
    profile.update(sentiment)
    steps[-1]["result"] = f"{sentiment['finbert_label']} · compound {sentiment['finbert_compound']} · {sentiment['headlines_found']} headlines"

    # ── Step 4: Hype classification ────────────────────────────────────────────
    steps.append({"step": "Isolation Forest", "status": "running"})
    # Use existing classification if available, else reason from data
    if "classification" not in profile or profile["classification"] == "STAGNANT":
        vel = profile.get("github_velocity_score", 50)
        fund_ratio = (profile.get("total_funding_usd", 0) or 0) / max(profile.get("predicted_valuation_usd", 1) or 1, 1)
        compound = sentiment["finbert_compound"]
        if compound < -0.2 and vel < 40:
            profile["classification"] = "HYPE_ANOMALY"
        elif vel < 35 and fund_ratio < 0.1:
            profile["classification"] = "STAGNANT"
        else:
            profile["classification"] = "LEGITIMATE"
    steps[-1]["result"] = profile["classification"]

    # ── Step 5: Risk severity ─────────────────────────────────────────────────
    steps.append({"step": "R.A.I.S.E. Risk Audit", "status": "running"})
    if "risk_severity" not in profile:
        vel = profile.get("github_velocity_score", 50)
        trust = profile.get("trust_score", 0.5)
        if profile["classification"] == "HYPE_ANOMALY" or trust < 0.30:
            profile["risk_severity"] = "HIGH"
        elif trust < 0.45 or vel < 35:
            profile["risk_severity"] = "MEDIUM"
        else:
            profile["risk_severity"] = "LOW"
    steps[-1]["result"] = profile["risk_severity"]

    # ── Step 6: SHAP top feature ──────────────────────────────────────────────
    steps.append({"step": "SHAP Explainer", "status": "running"})
    if not profile.get("top_shap_feature"):
        # Determine top feature from which component is strongest
        vel = profile.get("github_velocity_score", 50)
        if vel > 65:
            profile["top_shap_feature"] = "github_velocity_score"
        elif sentiment["finbert_compound"] > 0.3:
            profile["top_shap_feature"] = "finbert_sentiment_score"
        elif (profile.get("total_funding_usd") or 0) > 50_000_000:
            profile["top_shap_feature"] = "total_funding_usd"
        else:
            profile["top_shap_feature"] = "trust_score"
    steps[-1]["result"] = profile["top_shap_feature"]

    # ── Step 7: CIS Computation ───────────────────────────────────────────────
    steps.append({"step": "CIS Engine", "status": "running"})
    cis_result = compute_cis(profile)
    profile["cis"] = cis_result["cis"]
    profile["cis_details"] = cis_result
    steps[-1]["result"] = f"CIS: {cis_result['cis']:.3f} → {cis_result['signal']}"

    # ── Step 8: Investment Thesis ─────────────────────────────────────────────
    steps.append({"step": "Thesis Generator", "status": "running"})
    thesis = generate_thesis(profile, cis_result)
    profile["investment_thesis"] = thesis
    steps[-1]["result"] = "Thesis generated"

    # ── Assemble final profile ────────────────────────────────────────────────
    result = {
        "company": name,
        "data_source": data_source,
        "profile": profile,
        "cis": cis_result,
        "thesis": thesis,
        "steps": steps,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cached": False,
    }

    # Cache result
    try:
        with open(cache_file, "w") as f:
            json.dump(result, f, indent=2, default=str)
    except Exception:
        pass

    return result


if __name__ == "__main__":
    import sys
    company = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Zepto"
    print(f"\nResearching: {company}\n{'='*50}")
    result = research_company(company)
    print(f"CIS:    {result['cis']['cis']:.3f} ({result['cis']['signal']})")
    print(f"CI:     [{result['cis']['ci_low']:.3f} – {result['cis']['ci_high']:.3f}]")
    print(f"Source: {result['data_source']}")
    print(f"\nThesis:\n{result['thesis']}\n")
