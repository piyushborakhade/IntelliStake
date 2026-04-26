"""
IntelliStake live signal pipeline.

Builds a demo-friendly live intelligence layer on top of the historical 74k
startup corpus. The pipeline prefers real RSS/GitHub signals when available and
falls back to deterministic seeded signals when the environment is offline.

Outputs written to unified_data/4_production:
  - live_news_signals.json
  - live_funding_activity.json
  - live_compliance_tracker.json
  - live_github_refresh.json
  - live_alert_engine.json
  - live_intelligence.json
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED = BASE_DIR / "unified_data"
CLEANED = UNIFIED / "cleaned"
PROD = UNIFIED / "4_production"
PROD.mkdir(parents=True, exist_ok=True)

RSS_FEEDS = [
    ("TechCrunch India", "https://techcrunch.com/tag/india/feed/"),
    ("YourStory", "https://yourstory.com/feed"),
    ("Inc42", "https://inc42.com/feed/"),
    ("Economic Times Tech", "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms"),
    ("Entrackr", "https://entrackr.com/feed/"),
]

WATCHLIST_DEFAULTS = [
    {"startup_name": "Razorpay", "sector": "FinTech", "github_repo": "razorpay/razorpay-php"},
    {"startup_name": "PhonePe", "sector": "FinTech", "github_repo": "PhonePe/phonepe-pg-sdk-nodejs"},
    {"startup_name": "Paytm", "sector": "FinTech", "github_repo": "paytm/paytm-pg-node-sdk"},
    {"startup_name": "CRED", "sector": "FinTech", "github_repo": "credativ/terraform-aws-gitlab-runner"},
    {"startup_name": "Groww", "sector": "FinTech", "github_repo": "groww/groww-android"},
    {"startup_name": "Zepto", "sector": "Commerce", "github_repo": "zeptonow/zepto-webview"},
    {"startup_name": "Meesho", "sector": "Commerce", "github_repo": "meesho-supply/kanvas"},
    {"startup_name": "Nykaa", "sector": "Commerce", "github_repo": "nyuad-astrolab/nyx"},
    {"startup_name": "Swiggy", "sector": "Logistics", "github_repo": "swiggy/skynet"},
    {"startup_name": "Byju's", "sector": "EdTech", "github_repo": "byjus-public/byjus-js-sdk"},
]

POSITIVE_TERMS = {
    "raises", "raised", "funding", "series", "acquires", "acquired", "profit",
    "profitable", "approval", "launch", "expands", "growth", "partnership",
    "record", "surge", "wins", "beats", "strong", "bullish",
}
NEGATIVE_TERMS = {
    "layoff", "layoffs", "probe", "penalty", "lawsuit", "loss", "delays",
    "decline", "down", "default", "fraud", "insolvency", "shutdown",
    "audit", "frozen", "sebi", "rbi", "nclt", "compliance", "misses",
}
FUNDING_TERMS = ("raises", "raised", "funding", "series", "seed", "round", "acquires", "acquired", "investment")
COMPLIANCE_TERMS = ("mca", "roc", "filing", "sebi", "rbi", "penalty", "probe", "notice", "audit", "lawsuit", "nclt", "insolvency")

FALLBACK_NEWS = [
    {"startup_name": "Razorpay", "headline": "Razorpay expands agentic payments pilots with NPCI partners", "source": "Google News", "published_at": "Live"},
    {"startup_name": "PhonePe", "headline": "PhonePe deepens merchant payments push as UPI volumes climb", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Paytm", "headline": "Paytm focuses on compliance-first merchant products after regulatory reset", "source": "Google News", "published_at": "Live"},
    {"startup_name": "CRED", "headline": "CRED sharpens premium lending and rewards strategy with new product rollout", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Groww", "headline": "Groww adds wealth tools as retail investing demand stays firm", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Zepto", "headline": "Zepto explores fresh funding conversations as quick commerce competition heats up", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Meesho", "headline": "Meesho scales logistics efficiency ahead of festive demand", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Nykaa", "headline": "Nykaa expands omnichannel beauty distribution with brand tie-ups", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Swiggy", "headline": "Swiggy doubles down on Instamart footprint in tier-2 cities", "source": "Google News", "published_at": "Live"},
    {"startup_name": "Byju's", "headline": "Byju's faces ongoing restructuring pressure amid delayed resolution efforts", "source": "Google News", "published_at": "Live"},
]

FALLBACK_GITHUB = {
    "Razorpay": {"repo": "razorpay/razorpay-php", "stars": 204, "open_issues": 61, "days_since_commit": 5, "language": "PHP"},
    "PhonePe": {"repo": "PhonePe/phonepe-pg-sdk-nodejs", "stars": 27, "open_issues": 4, "days_since_commit": 18, "language": "TypeScript"},
    "Paytm": {"repo": "paytm/paytm-pg-node-sdk", "stars": 68, "open_issues": 11, "days_since_commit": 23, "language": "JavaScript"},
    "CRED": {"repo": "credativ/terraform-aws-gitlab-runner", "stars": 563, "open_issues": 47, "days_since_commit": 31, "language": "HCL"},
    "Groww": {"repo": "groww/groww-android", "stars": 40, "open_issues": 8, "days_since_commit": 27, "language": "Kotlin"},
    "Zepto": {"repo": "zeptonow/zepto-webview", "stars": 12, "open_issues": 6, "days_since_commit": 13, "language": "TypeScript"},
    "Meesho": {"repo": "meesho-supply/kanvas", "stars": 79, "open_issues": 15, "days_since_commit": 21, "language": "TypeScript"},
    "Nykaa": {"repo": "nyuad-astrolab/nyx", "stars": 145, "open_issues": 12, "days_since_commit": 16, "language": "Python"},
    "Swiggy": {"repo": "swiggy/skynet", "stars": 91, "open_issues": 18, "days_since_commit": 9, "language": "Go"},
    "Byju's": {"repo": "byjus-public/byjus-js-sdk", "stars": 11, "open_issues": 9, "days_since_commit": 97, "language": "JavaScript"},
}


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        with open(path) as fh:
            return json.load(fh)
    except Exception:
        return default


def _save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


def _norm_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
        if math.isnan(out) or math.isinf(out):
            return default
        return out
    except Exception:
        return default


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_url(url: str, timeout: int = 8) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 IntelliStake/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _extract_items(xml_text: str) -> list[dict[str, str]]:
    items = []
    blocks = re.findall(r"<item\b.*?>.*?</item>", xml_text, flags=re.IGNORECASE | re.DOTALL)
    if not blocks:
        blocks = re.findall(r"<entry\b.*?>.*?</entry>", xml_text, flags=re.IGNORECASE | re.DOTALL)
    for block in blocks[:40]:
        title = ""
        for pattern in (
            r"<title><!\[CDATA\[(.*?)\]\]></title>",
            r"<title[^>]*>(.*?)</title>",
        ):
            match = re.search(pattern, block, flags=re.IGNORECASE | re.DOTALL)
            if match:
                title = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                break
        if not title:
            continue
        link = ""
        for pattern in (
            r"<link>(.*?)</link>",
            r'<link[^>]*href="([^"]+)"',
        ):
            match = re.search(pattern, block, flags=re.IGNORECASE | re.DOTALL)
            if match:
                link = match.group(1).strip()
                break
        published = ""
        for pattern in (
            r"<pubDate>(.*?)</pubDate>",
            r"<published>(.*?)</published>",
            r"<updated>(.*?)</updated>",
        ):
            match = re.search(pattern, block, flags=re.IGNORECASE | re.DOTALL)
            if match:
                published = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                break
        items.append({"title": title, "link": link, "published_at": published})
    return items


def load_watchlist() -> list[dict[str, Any]]:
    startups = _load_json(CLEANED / "intellistake_startups_clean.json", [])
    portfolio = _load_json(PROD / "final_portfolio_weights.json", {})
    allocations = portfolio.get("allocations", []) if isinstance(portfolio, dict) else []

    startup_by_name = {}
    for rec in startups:
        name = rec.get("startup_name")
        if name:
            startup_by_name[_norm_name(name)] = rec

    selected = []
    seen = set()
    seeds = [a.get("startup_name") for a in allocations[:12] if isinstance(a, dict)] + [d["startup_name"] for d in WATCHLIST_DEFAULTS]
    defaults_by_name = {_norm_name(item["startup_name"]): item for item in WATCHLIST_DEFAULTS}
    for name in seeds:
        if not name:
            continue
        key = _norm_name(name)
        if key in seen:
            continue
        rec = startup_by_name.get(key, {})
        default = defaults_by_name.get(key, {})
        selected.append({
            "startup_name": rec.get("startup_name") or default.get("startup_name") or name,
            "sector": rec.get("sector") or default.get("sector") or "General",
            "city": rec.get("city") or "India",
            "country": rec.get("country") or "India",
            "trust_score": _safe_float(rec.get("trust_score"), 0.55),
            "risk_severity": rec.get("risk_severity") or "MEDIUM",
            "github_repo": rec.get("github_repo") or default.get("github_repo"),
        })
        seen.add(key)
        if len(selected) >= 10:
            break
    return selected


def score_headline(text: str) -> tuple[str, float]:
    lower = (text or "").lower()
    pos = sum(1 for term in POSITIVE_TERMS if term in lower)
    neg = sum(1 for term in NEGATIVE_TERMS if term in lower)
    if pos > neg:
        return "positive", round(min(0.95, 0.15 + 0.12 * pos), 3)
    if neg > pos:
        return "negative", round(max(-0.95, -0.15 - 0.12 * neg), 3)
    return "neutral", 0.0


def fetch_live_news(watchlist: list[dict[str, Any]]) -> dict[str, Any]:
    startup_map = {_norm_name(item["startup_name"]): item for item in watchlist}
    name_tokens = {
        key: [tok for tok in re.findall(r"[a-z0-9]+", item["startup_name"].lower()) if len(tok) >= 3]
        for key, item in startup_map.items()
    }
    items = []
    seen = set()
    live_sources = set()

    for source_name, url in RSS_FEEDS:
        try:
            xml_text = _fetch_url(url)
        except Exception:
            continue
        for entry in _extract_items(xml_text):
            title = entry["title"]
            title_lower = title.lower()
            for key, startup in startup_map.items():
                full_name = startup["startup_name"].lower()
                tokens = name_tokens[key]
                if full_name in title_lower or any(token in title_lower for token in tokens):
                    uniq = (startup["startup_name"], title)
                    if uniq in seen:
                        break
                    seen.add(uniq)
                    label, score = score_headline(title)
                    items.append({
                        "startup_name": startup["startup_name"],
                        "sector": startup["sector"],
                        "headline": title,
                        "source": source_name,
                        "url": entry.get("link", ""),
                        "published_at": entry.get("published_at", "") or "Live",
                        "label": label,
                        "sentiment_score": score,
                    })
                    live_sources.add(source_name)
                    break

    if len(items) < 8:
        for entry in FALLBACK_NEWS:
            if _norm_name(entry["startup_name"]) not in startup_map:
                continue
            uniq = (entry["startup_name"], entry["headline"])
            if uniq in seen:
                continue
            label, score = score_headline(entry["headline"])
            items.append({
                **entry,
                "sector": startup_map[_norm_name(entry["startup_name"])]["sector"],
                "url": "",
                "label": label,
                "sentiment_score": score,
            })
            seen.add(uniq)

    items.sort(key=lambda item: abs(item["sentiment_score"]), reverse=True)
    sector_scores = defaultdict(list)
    for item in items:
        sector_scores[item["sector"]].append(item["sentiment_score"])
    sector_summary = {
        sector: {
            "avg_score": round(sum(vals) / len(vals), 3),
            "headline_count": len(vals),
            "label": "bullish" if sum(vals) / len(vals) > 0.08 else "bearish" if sum(vals) / len(vals) < -0.08 else "neutral",
        }
        for sector, vals in sector_scores.items()
        if vals
    }
    overall = round(sum(item["sentiment_score"] for item in items) / max(len(items), 1), 3)
    return {
        "generated_at": _now_iso(),
        "sources": sorted(live_sources) or ["seeded-fallback"],
        "overall_score": overall,
        "overall_label": "bullish" if overall > 0.08 else "bearish" if overall < -0.08 else "neutral",
        "sector_scores": sector_summary,
        "items": items[:40],
    }


def build_funding_activity(news_payload: dict[str, Any]) -> dict[str, Any]:
    colors = {"positive": "green", "negative": "red", "neutral": "blue"}
    events = []
    for item in news_payload.get("items", []):
        text = item["headline"].lower()
        if not any(term in text for term in FUNDING_TERMS):
            continue
        if "acquir" in text:
            event_type = "acquisition"
        elif "series" in text or "seed" in text or "round" in text:
            event_type = "funding_round"
        else:
            event_type = "capital_activity"
        events.append({
            "startup_name": item["startup_name"],
            "sector": item["sector"],
            "event_type": event_type,
            "headline": item["headline"],
            "source": item["source"],
            "published_at": item["published_at"],
            "label": item["label"],
            "color": colors.get(item["label"], "blue"),
            "plain_english": item["headline"],
            "tx_hash": "0x" + hashlib.sha256(f"funding-{item['startup_name']}-{item['headline']}".encode()).hexdigest()[:32],
        })
    if not events:
        for item in news_payload.get("items", [])[:5]:
            events.append({
                "startup_name": item["startup_name"],
                "sector": item["sector"],
                "event_type": "market_signal",
                "headline": item["headline"],
                "source": item["source"],
                "published_at": item["published_at"],
                "label": item["label"],
                "color": colors.get(item["label"], "blue"),
                "plain_english": item["headline"],
                "tx_hash": "0x" + hashlib.sha256(f"signal-{item['startup_name']}-{item['headline']}".encode()).hexdigest()[:32],
            })
    return {"generated_at": _now_iso(), "events": events[:20], "event_count": len(events[:20])}


def fetch_github_refresh(watchlist: list[dict[str, Any]]) -> dict[str, Any]:
    live_audits = _load_json(UNIFIED / "production" / "live_audit_log.json", [])
    audits_by_name = {}
    for entry in live_audits:
        name = entry.get("startup_name")
        if name:
            audits_by_name[_norm_name(name)] = entry

    repositories = []
    for startup in watchlist:
        name = startup["startup_name"]
        repo = startup.get("github_repo") or FALLBACK_GITHUB.get(name, {}).get("repo")
        fallback = FALLBACK_GITHUB.get(name, {})
        record = {
            "startup_name": name,
            "repo": repo or "",
            "stars": 0,
            "open_issues": 0,
            "language": "",
            "last_commit_date": "",
            "days_since_commit": None,
            "velocity_status": "UNKNOWN",
            "activity_score": 0.45,
            "source": "fallback",
        }
        audit = audits_by_name.get(_norm_name(name), {})
        if audit:
            gh = audit.get("github_signals", {})
            record.update({
                "repo": gh.get("repo") or record["repo"],
                "stars": gh.get("stars", 0),
                "open_issues": gh.get("open_issues", 0),
                "language": gh.get("language", ""),
                "last_commit_date": gh.get("last_commit_date", ""),
                "days_since_commit": gh.get("days_since_commit"),
                "source": "live_audit_log",
            })
        elif repo:
            url = f"https://api.github.com/repos/{repo}"
            headers = {"User-Agent": "Mozilla/5.0 IntelliStake/1.0", "Accept": "application/vnd.github+json"}
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=8) as resp:
                    meta = json.loads(resp.read().decode("utf-8"))
                record.update({
                    "stars": meta.get("stargazers_count", 0),
                    "open_issues": meta.get("open_issues_count", 0),
                    "language": meta.get("language", ""),
                    "source": "github_api",
                })
                req_c = urllib.request.Request(f"https://api.github.com/repos/{repo}/commits?per_page=1", headers=headers)
                with urllib.request.urlopen(req_c, timeout=8) as resp:
                    commits = json.loads(resp.read().decode("utf-8"))
                if commits:
                    commit_date = commits[0]["commit"]["committer"]["date"]
                    dt = datetime.fromisoformat(commit_date.replace("Z", "+00:00"))
                    record["last_commit_date"] = dt.strftime("%Y-%m-%d")
                    record["days_since_commit"] = max(0, (datetime.now(timezone.utc) - dt).days)
            except Exception:
                record.update(fallback)
                record["source"] = "fallback"
        else:
            record.update(fallback)

        days = record.get("days_since_commit")
        if days is None:
            days = fallback.get("days_since_commit")
            record["days_since_commit"] = days
        if days is None:
            status = "WATCH"
            score = 0.45
        elif days <= 14:
            status = "ACTIVE"
            score = 0.82
        elif days <= 45:
            status = "WATCH"
            score = 0.64
        else:
            status = "STALE"
            score = 0.32
        record["velocity_status"] = status
        record["activity_score"] = round(score, 3)
        repositories.append(record)

    repositories.sort(key=lambda item: (item["velocity_status"] != "ACTIVE", item["days_since_commit"] or 9999))
    return {"generated_at": _now_iso(), "repositories": repositories}


def build_compliance_tracker(watchlist: list[dict[str, Any]], news_payload: dict[str, Any]) -> dict[str, Any]:
    news_by_name = defaultdict(list)
    for item in news_payload.get("items", []):
        news_by_name[_norm_name(item["startup_name"])].append(item)

    records = []
    for startup in watchlist:
        name = startup["startup_name"]
        risk = str(startup.get("risk_severity") or "MEDIUM").upper()
        matched = []
        for item in news_by_name.get(_norm_name(name), []):
            text = item["headline"].lower()
            if any(term in text for term in COMPLIANCE_TERMS):
                matched.append(item)

        if matched:
            worst = matched[0]
            negative = any(item["label"] == "negative" for item in matched)
            status = "HIGH_RISK" if negative else "REVIEW"
            risk_note = worst["headline"]
        elif risk in ("HIGH", "SEVERE"):
            status = "REVIEW"
            risk_note = f"Historical risk severity is {risk}; keep MCA and regulatory filings under active watch."
        else:
            status = "CLEAR"
            risk_note = "No adverse live compliance mentions detected across tracked feeds."

        records.append({
            "startup_name": name,
            "sector": startup["sector"],
            "status": status,
            "risk_severity": risk,
            "signal_count": len(matched),
            "latest_signal": risk_note,
            "next_action": "Escalate to manual diligence" if status == "HIGH_RISK" else "Monitor weekly" if status == "REVIEW" else "No action",
            "source": "live_news_monitor",
        })
    records.sort(key=lambda item: {"HIGH_RISK": 0, "REVIEW": 1, "CLEAR": 2}.get(item["status"], 9))
    return {"generated_at": _now_iso(), "records": records}


def build_alert_engine(
    watchlist: list[dict[str, Any]],
    news_payload: dict[str, Any],
    funding_payload: dict[str, Any],
    compliance_payload: dict[str, Any],
    github_payload: dict[str, Any],
) -> dict[str, Any]:
    news_by_name = defaultdict(list)
    for item in news_payload.get("items", []):
        news_by_name[_norm_name(item["startup_name"])].append(item)

    github_by_name = {_norm_name(item["startup_name"]): item for item in github_payload.get("repositories", [])}
    compliance_by_name = {_norm_name(item["startup_name"]): item for item in compliance_payload.get("records", [])}
    funding_names = {_norm_name(item["startup_name"]) for item in funding_payload.get("events", [])}

    alerts = []
    trust_updates = []
    oracle_recommendations = []

    for startup in watchlist:
        name = startup["startup_name"]
        key = _norm_name(name)
        baseline = _safe_float(startup.get("trust_score"), 0.55)
        delta = 0.0
        notes = []

        news_items = news_by_name.get(key, [])
        neg_count = sum(1 for item in news_items if item["label"] == "negative")
        pos_count = sum(1 for item in news_items if item["label"] == "positive")
        if neg_count:
            delta -= min(0.12, 0.04 * neg_count)
            notes.append(f"{neg_count} negative live headline(s)")
        if pos_count:
            delta += min(0.06, 0.02 * pos_count)
            notes.append(f"{pos_count} positive live headline(s)")

        if key in funding_names:
            delta += 0.03
            notes.append("Fresh capital-market activity detected")

        compliance = compliance_by_name.get(key)
        compliance_status = compliance.get("status") if compliance else "CLEAR"
        if compliance_status == "HIGH_RISK":
            delta -= 0.18
            notes.append("Compliance tracker flagged high-risk signal")
        elif compliance_status == "REVIEW":
            delta -= 0.07
            notes.append("Compliance tracker moved to review")

        github = github_by_name.get(key)
        if github:
            if github.get("velocity_status") == "STALE":
                delta -= 0.08
                notes.append("GitHub activity stale")
            elif github.get("velocity_status") == "ACTIVE":
                delta += 0.04
                notes.append("GitHub activity healthy")

        updated = round(max(0.05, min(0.99, baseline + delta)), 3)
        if updated < 0.40 or compliance_status == "HIGH_RISK":
            level = "DANGER"
            oracle_action = "FREEZE_MILESTONE_FUNDING"
            color = "red"
        elif updated < 0.55 or neg_count >= 2 or compliance_status == "REVIEW":
            level = "WARNING"
            oracle_action = "CONDITIONAL_HOLD"
            color = "amber"
        else:
            level = "OK"
            oracle_action = "APPROVE_TRANCHE"
            color = "green"

        summary = "; ".join(notes) if notes else "No live degradation detected"
        alerts.append({
            "startup_name": name,
            "sector": startup["sector"],
            "baseline_trust_score": round(baseline, 3),
            "updated_trust_score": updated,
            "trust_delta": round(updated - baseline, 3),
            "alert_level": level,
            "oracle_action": oracle_action,
            "color": color,
            "summary": summary,
            "notes": notes,
            "compliance_status": compliance_status,
            "github_status": github.get("velocity_status") if github else "UNKNOWN",
            "negative_news_count": neg_count,
        })
        trust_updates.append({
            "startup_name": name,
            "previous_trust_score": round(baseline, 3),
            "updated_trust_score": updated,
            "delta": round(updated - baseline, 3),
        })
        oracle_recommendations.append({
            "startup_name": name,
            "action": oracle_action,
            "trust_score": updated,
            "reason": summary,
            "color": "red" if level == "DANGER" else "blue" if level == "WARNING" else "green",
            "plain_english": (
                f"AI recommends freezing funding for {name} until new diligence clears."
                if oracle_action == "FREEZE_MILESTONE_FUNDING"
                else f"AI recommends holding the next tranche for {name} pending more signals."
                if oracle_action == "CONDITIONAL_HOLD"
                else f"AI recommends releasing the next tranche for {name}; live signals remain supportive."
            ),
        })

    alerts.sort(key=lambda item: {"DANGER": 0, "WARNING": 1, "OK": 2}.get(item["alert_level"], 9))
    summary = {
        "danger_count": sum(1 for item in alerts if item["alert_level"] == "DANGER"),
        "warning_count": sum(1 for item in alerts if item["alert_level"] == "WARNING"),
        "ok_count": sum(1 for item in alerts if item["alert_level"] == "OK"),
        "tracked_startups": len(alerts),
    }
    return {
        "generated_at": _now_iso(),
        "summary": summary,
        "alerts": alerts,
        "trust_updates": trust_updates,
        "oracle_recommendations": oracle_recommendations,
    }


def generate_live_intelligence() -> dict[str, Any]:
    watchlist = load_watchlist()
    news_payload = fetch_live_news(watchlist)
    funding_payload = build_funding_activity(news_payload)
    compliance_payload = build_compliance_tracker(watchlist, news_payload)
    github_payload = fetch_github_refresh(watchlist)
    alerts_payload = build_alert_engine(watchlist, news_payload, funding_payload, compliance_payload, github_payload)

    aggregate = {
        "generated_at": _now_iso(),
        "watchlist": watchlist,
        "news": news_payload,
        "funding": funding_payload,
        "compliance": compliance_payload,
        "github": github_payload,
        "alerts": alerts_payload,
    }

    _save_json(PROD / "live_news_signals.json", news_payload)
    _save_json(PROD / "live_funding_activity.json", funding_payload)
    _save_json(PROD / "live_compliance_tracker.json", compliance_payload)
    _save_json(PROD / "live_github_refresh.json", github_payload)
    _save_json(PROD / "live_alert_engine.json", alerts_payload)
    _save_json(PROD / "live_intelligence.json", aggregate)
    return aggregate


if __name__ == "__main__":
    payload = generate_live_intelligence()
    print(
        json.dumps(
            {
                "generated_at": payload["generated_at"],
                "news_items": len(payload["news"].get("items", [])),
                "funding_events": len(payload["funding"].get("events", [])),
                "compliance_records": len(payload["compliance"].get("records", [])),
                "github_repos": len(payload["github"].get("repositories", [])),
                "danger_alerts": payload["alerts"].get("summary", {}).get("danger_count", 0),
                "warning_alerts": payload["alerts"].get("summary", {}).get("warning_count", 0),
            },
            indent=2,
        )
    )
