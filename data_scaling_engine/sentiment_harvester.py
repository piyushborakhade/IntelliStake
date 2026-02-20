"""
sentiment_harvester.py
======================
IntelliStake — High-Scale Social & Market Sentiment Pipeline

Pipeline Architecture:
  1. RSS Feed Harvester   → News articles from 8 Indian/global tech news sources
  2. Reddit PRAW Scraper  → r/Indianstartups, r/IndiaInvestments, r/startups (100K+ posts)
  3. VADER Sentiment Engine → Polarity scoring for every headline/post body
  4. Entity Mapper        → Link mentions to startup_id in the master dataset
  5. Market Confidence Index (MCI) → Aggregated per-startup sentiment signal

Target: 1,00,000+ mention records  → Stored as Parquet for Dask ingestion.

Dependencies:
  pip install vaderSentiment feedparser praw requests beautifulsoup4 lxml pandas pyarrow tqdm rapidfuzz
"""

from __future__ import annotations

import json
import logging
import math
import time
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

import feedparser
import pandas as pd
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ── optional PRAW import (Reddit) ─────────────────────────────────────────────
try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False

# ── local imports ─────────────────────────────────────────────────────────────
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    MASTER_STARTUPS_PATH, SENTIMENT_OUTPUT,
    NEWS_SOURCES, REDDIT_SUBREDDITS,
    REDDIT_CLIENT_ID, REDDIT_SECRET, REDDIT_USER_AGENT,
    TARGET_MENTION_COUNT, VADER_BATCH_SIZE,
    REQUEST_TIMEOUT_SECS, REQUEST_RETRY_ATTEMPTS,
    SENTIMENT_POSITIVE_THRESH, SENTIMENT_NEGATIVE_THRESH,
    ENTITY_FUZZY_THRESHOLD, LOG_DIR, LOG_FORMAT, LOG_LEVEL,
)

# ── logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "sentiment_harvester.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("sentiment_harvester")


# ─────────────────────────────────────────────────────────────────────────────
# 1. ENTITY INDEX — load startup names for fuzzy matching
# ─────────────────────────────────────────────────────────────────────────────

def build_entity_index(path: Path) -> dict[str, str]:
    """Return {lowercase_startup_name: startup_id} for rapid O(1) lookup."""
    log.info("Building entity index from %s", path.name)
    with open(path, encoding="utf-8") as fh:
        records = json.load(fh)
    index = {r["startup_name"].lower().strip(): r["startup_id"] for r in records}
    log.info("Entity index built: %d startups", len(index))
    return index


def fuzzy_resolve(text: str, entity_index: dict[str, str]) -> str | None:
    """
    Attempt to resolve a mention string to a startup_id using:
      1. Exact substring match (O(n) scan)
      2. Fuzzy match via RapidFuzz (threshold = ENTITY_FUZZY_THRESHOLD)
    Returns startup_id or None.
    """
    text_lower = text.lower()

    # Pass 1: exact substring match
    for name, sid in entity_index.items():
        if len(name) >= 4 and name in text_lower:
            return sid

    # Pass 2: fuzzy match on first 5 tokens of the text
    try:
        from rapidfuzz import process, fuzz
        tokens = " ".join(text_lower.split()[:6])
        match, score, _ = process.extractOne(
            tokens, entity_index.keys(),
            scorer=fuzz.partial_ratio,
        ) or (None, 0, None)
        if score >= ENTITY_FUZZY_THRESHOLD and match:
            return entity_index[match]
    except ImportError:
        pass  # rapidfuzz optional

    return None


# ─────────────────────────────────────────────────────────────────────────────
# 2. RSS FEED HARVESTER
# ─────────────────────────────────────────────────────────────────────────────

def _safe_get(url: str, timeout: int = REQUEST_TIMEOUT_SECS) -> requests.Response | None:
    """GET with retry/backoff. Returns Response or None on permanent failure."""
    for attempt in range(1, REQUEST_RETRY_ATTEMPTS + 1):
        try:
            resp = requests.get(
                url,
                timeout=timeout,
                headers={"User-Agent": "IntelliStakeBot/1.0 (+https://intellistake.ai)"},
            )
            resp.raise_for_status()
            return resp
        except requests.exceptions.Timeout:
            log.warning("Timeout attempt %d/%d — %s", attempt, REQUEST_RETRY_ATTEMPTS, url)
        except requests.exceptions.HTTPError as exc:
            log.warning("HTTP %s for %s", exc.response.status_code, url)
            if exc.response.status_code in (403, 404, 410):
                return None          # permanent failure, no retry
        except requests.exceptions.RequestException as exc:
            log.warning("Request error attempt %d: %s", attempt, exc)
        time.sleep(2 ** attempt)     # exponential back-off
    return None


def harvest_rss_feeds() -> Generator[dict, None, None]:
    """
    Parse all configured RSS feeds via feedparser.
    Yields raw mention dicts: {source, title, summary, url, published_at}
    """
    for source_name, feed_url in NEWS_SOURCES:
        log.info("Fetching RSS — %s: %s", source_name, feed_url)
        try:
            feed = feedparser.parse(feed_url, request_headers={
                "User-Agent": "IntelliStakeBot/1.0",
            })
        except Exception as exc:
            log.error("feedparser error for %s: %s", source_name, exc)
            continue

        if feed.bozo and feed.bozo_exception:
            log.warning("Malformed feed %s: %s", source_name, feed.bozo_exception)

        for entry in feed.entries:
            title   = getattr(entry, "title",   "") or ""
            summary = getattr(entry, "summary", "") or ""
            # Strip HTML tags from summary
            summary = BeautifulSoup(summary, "lxml").get_text(separator=" ").strip()

            published_at = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()

            yield {
                "mention_id":    hashlib.md5((title + (entry.get("link", ""))).encode()).hexdigest(),
                "source":        source_name,
                "source_type":   "news_rss",
                "text":          f"{title}. {summary}",
                "url":           entry.get("link", ""),
                "published_at":  published_at,
                "startup_id":    None,   # resolved later
            }

        log.info("  → %d entries from %s", len(feed.entries), source_name)
        time.sleep(0.5)   # polite delay


def scrape_article_full_text(url: str) -> str:
    """
    Fetch an article URL and extract the main body text using BeautifulSoup.
    We target <article>, <div class="article-body">, <p> tags — common patterns
    across Indian tech-news sites (YourStory, Inc42, Economic Times).
    """
    resp = _safe_get(url)
    if resp is None:
        return ""
    soup = BeautifulSoup(resp.text, "lxml")

    # Remove navigation, ads, scripts
    for tag in soup(["script", "style", "nav", "footer", "aside", "header"]):
        tag.decompose()

    # Prioritise semantic article container
    for selector in ("article", '[class*="article-body"]', '[class*="story-body"]',
                     '[class*="article-content"]', "main"):
        container = soup.select_one(selector)
        if container:
            return container.get_text(separator=" ", strip=True)

    # Fallback: all <p> tags
    paragraphs = soup.find_all("p")
    return " ".join(p.get_text(" ", strip=True) for p in paragraphs)


# ─────────────────────────────────────────────────────────────────────────────
# 3. REDDIT HARVESTER (PRAW)
# ─────────────────────────────────────────────────────────────────────────────

def harvest_reddit_posts(limit_per_sub: int = 1000) -> Generator[dict, None, None]:
    """
    Pull hot + new + top posts from configured subreddits using PRAW.
    Requires REDDIT_CLIENT_ID / REDDIT_SECRET env variables.
    Falls back to HTTP JSON API if PRAW not available.
    """
    if PRAW_AVAILABLE and REDDIT_CLIENT_ID:
        yield from _praw_harvest(limit_per_sub)
    else:
        log.warning("PRAW not configured — falling back to Reddit JSON API (read-only).")
        yield from _reddit_json_api_harvest(limit_per_sub)


def _praw_harvest(limit_per_sub: int) -> Generator[dict, None, None]:
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_SECRET,
        user_agent=REDDIT_USER_AGENT,
    )
    for subreddit_name in REDDIT_SUBREDDITS:
        subreddit = reddit.subreddit(subreddit_name)
        log.info("PRAW harvesting r/%s", subreddit_name)
        for listing in ("hot", "new", "top"):
            try:
                posts = getattr(subreddit, listing)(limit=limit_per_sub)
                for post in posts:
                    text = f"{post.title}. {post.selftext or ''}".strip()
                    yield {
                        "mention_id":   post.id,
                        "source":       f"reddit/r/{subreddit_name}",
                        "source_type":  "social_reddit",
                        "text":         text[:2000],
                        "url":          f"https://reddit.com{post.permalink}",
                        "published_at": datetime.fromtimestamp(
                            post.created_utc, tz=timezone.utc
                        ).isoformat(),
                        "startup_id":   None,
                        "upvotes":      post.score,
                        "comments":     post.num_comments,
                    }
            except Exception as exc:
                log.error("PRAW error r/%s/%s: %s", subreddit_name, listing, exc)


def _reddit_json_api_harvest(limit_per_sub: int) -> Generator[dict, None, None]:
    """
    Fallback: Reddit exposes JSON endpoints without OAuth for read-only access.
    Example: https://www.reddit.com/r/IndiaInvestments/hot.json?limit=100
    """
    for subreddit_name in REDDIT_SUBREDDITS:
        for listing in ("hot", "new", "top"):
            after = None
            fetched = 0
            while fetched < limit_per_sub:
                batch = min(100, limit_per_sub - fetched)
                url = f"https://www.reddit.com/r/{subreddit_name}/{listing}.json?limit={batch}"
                if after:
                    url += f"&after={after}"
                resp = _safe_get(url)
                if resp is None:
                    break
                try:
                    data = resp.json()["data"]
                except (KeyError, ValueError) as exc:
                    log.error("Reddit JSON parse error: %s", exc)
                    break
                children = data.get("children", [])
                if not children:
                    break
                for child in children:
                    p = child["data"]
                    text = f"{p.get('title','')}. {p.get('selftext','')}".strip()
                    yield {
                        "mention_id":   p.get("id", ""),
                        "source":       f"reddit/r/{subreddit_name}",
                        "source_type":  "social_reddit",
                        "text":         text[:2000],
                        "url":          f"https://reddit.com{p.get('permalink','')}",
                        "published_at": datetime.fromtimestamp(
                            p.get("created_utc", 0), tz=timezone.utc
                        ).isoformat(),
                        "startup_id":   None,
                        "upvotes":      p.get("score", 0),
                        "comments":     p.get("num_comments", 0),
                    }
                    fetched += 1
                after = data.get("after")
                if not after:
                    break
                time.sleep(1.0)     # Reddit ask: 1 req/sec for unauthenticated


# ─────────────────────────────────────────────────────────────────────────────
# 4. VADER SENTIMENT ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class VADERSentimentEngine:
    """
    Wraps vaderSentiment with batch processing and caching.
    Outputs compound polarity + discrete label + domain-specific boosts.
    """

    STARTUP_BOOST_WORDS = {
        "unicorn": 0.2, "funded": 0.1, "acquisition": 0.1, "ipo": 0.15,
        "layoff": -0.2, "fraud": -0.3, "bankruptcy": -0.4, "scam": -0.35,
        "valuation": 0.05, "revenue growth": 0.15, "profit": 0.1,
        "loss": -0.1, "regulatory": -0.1, "sebi": -0.05,
    }

    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()
        log.info("VADER SentimentIntensityAnalyzer initialised")

    def score(self, text: str) -> dict:
        """Score a single text string. Returns dict with compound + label."""
        # Apply domain-specific word boosts by updating VADER lexicon
        text_lower = text.lower()
        boost = sum(v for kw, v in self.STARTUP_BOOST_WORDS.items() if kw in text_lower)

        scores = self.analyzer.polarity_scores(text)
        compound = round(min(max(scores["compound"] + boost, -1.0), 1.0), 4)   # clamp [-1, 1]

        if compound >= SENTIMENT_POSITIVE_THRESH:
            label = "POSITIVE"
        elif compound <= SENTIMENT_NEGATIVE_THRESH:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        return {
            "vader_compound":  compound,
            "vader_pos":       round(scores["pos"], 4),
            "vader_neu":       round(scores["neu"], 4),
            "vader_neg":       round(scores["neg"], 4),
            "sentiment_label": label,
        }

    def score_batch(self, records: list[dict]) -> list[dict]:
        """Score a batch; adds sentiment fields in-place and returns records."""
        for rec in records:
            scores = self.score(rec.get("text", ""))
            rec.update(scores)
        return records


# ─────────────────────────────────────────────────────────────────────────────
# 5. MARKET CONFIDENCE INDEX (MCI) AGGREGATOR
# ─────────────────────────────────────────────────────────────────────────────

def compute_market_confidence_index(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate per-mention sentiment → per-startup Market Confidence Index.

    MCI Formula:
        MCI = Σ(compound_i × weight_i) / Σ(weight_i)
        weight = log(1 + upvotes) for social; 1.0 for news

    Returns a DataFrame indexed by startup_id with MCI and metadata.
    """
    resolved = df[df["startup_id"].notna()].copy()
    if resolved.empty:
        log.warning("No resolved mentions — MCI will be empty.")
        return pd.DataFrame()

    resolved["weight"] = resolved.apply(
        lambda r: max(1.0, math.log1p(r.get("upvotes", 0) or 0))
        if r.get("source_type") == "social_reddit" else 1.0,
        axis=1,
    ) if "upvotes" in resolved.columns else 1.0

    resolved["weighted_compound"] = resolved["vader_compound"] * resolved["weight"]

    mci = (
        resolved.groupby("startup_id")
        .agg(
            mention_count       =("mention_id",       "count"),
            positive_count      =("sentiment_label",  lambda s: (s == "POSITIVE").sum()),
            negative_count      =("sentiment_label",  lambda s: (s == "NEGATIVE").sum()),
            neutral_count       =("sentiment_label",  lambda s: (s == "NEUTRAL").sum()),
            sum_weighted_compound=("weighted_compound","sum"),
            sum_weight          =("weight",           "sum"),
            sources             =("source",           lambda s: ",".join(s.unique()[:5])),
            earliest_mention    =("published_at",     "min"),
            latest_mention      =("published_at",     "max"),
        )
        .reset_index()
    )

    mci["market_confidence_index"] = (
        mci["sum_weighted_compound"] / mci["sum_weight"]
    ).round(4)

    mci["mci_label"] = mci["market_confidence_index"].apply(
        lambda v: "HIGH" if v >= 0.25 else ("LOW" if v <= -0.15 else "MODERATE")
    )

    mci["computed_at"] = datetime.now(tz=timezone.utc).isoformat()
    mci.drop(columns=["sum_weighted_compound", "sum_weight"], inplace=True)

    log.info(
        "MCI computed for %d startups | mean MCI = %.4f",
        len(mci), mci["market_confidence_index"].mean(),
    )
    return mci


# ─────────────────────────────────────────────────────────────────────────────
# 6. MAIN PIPELINE ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

def run_sentiment_pipeline(
    max_mentions: int = TARGET_MENTION_COUNT,
    enrich_full_text: bool = False,
) -> pd.DataFrame:
    """
    Full sentiment pipeline:
      RSS harvest → Reddit harvest → Entity resolve → VADER score → MCI → Parquet

    Args:
        max_mentions:     Stop after collecting this many raw mention records.
        enrich_full_text: If True, fetch full article body (slower, more data).

    Returns:
        DataFrame of per-startup Market Confidence Index scores.
    """
    log.info("=" * 60)
    log.info("IntelliStake Sentiment Harvester — Pipeline Start")
    log.info("Target mentions: %d", max_mentions)
    log.info("=" * 60)

    entity_index = build_entity_index(MASTER_STARTUPS_PATH)
    engine       = VADERSentimentEngine()
    all_mentions: list[dict] = []

    # ── Harvest RSS feeds ──────────────────────────────────────────────────
    log.info("Phase 1: RSS News Harvest")
    for mention in tqdm(harvest_rss_feeds(), desc="RSS feeds", unit="article"):
        if enrich_full_text and mention["url"]:
            full_text = scrape_article_full_text(mention["url"])
            if full_text:
                mention["text"] = full_text[:3000]

        mention["startup_id"] = fuzzy_resolve(mention["text"], entity_index)
        all_mentions.append(mention)

        if len(all_mentions) >= max_mentions:
            break

    log.info("  RSS harvest: %d articles", len(all_mentions))

    # ── Harvest Reddit ─────────────────────────────────────────────────────
    if len(all_mentions) < max_mentions:
        log.info("Phase 2: Reddit Social Harvest")
        remaining = max_mentions - len(all_mentions)
        per_sub   = remaining // max(len(REDDIT_SUBREDDITS), 1)

        for mention in tqdm(
            harvest_reddit_posts(limit_per_sub=per_sub),
            desc="Reddit", unit="post", total=remaining,
        ):
            mention["startup_id"] = fuzzy_resolve(mention["text"], entity_index)
            all_mentions.append(mention)
            if len(all_mentions) >= max_mentions:
                break

    log.info("Total raw mentions harvested: %d", len(all_mentions))

    # ── VADER scoring in batches ───────────────────────────────────────────
    log.info("Phase 3: VADER Batch Scoring (%d records/batch)", VADER_BATCH_SIZE)
    scored: list[dict] = []
    for i in range(0, len(all_mentions), VADER_BATCH_SIZE):
        batch = all_mentions[i: i + VADER_BATCH_SIZE]
        scored.extend(engine.score_batch(batch))
        log.debug("  Scored batch %d–%d", i, i + len(batch))

    df_mentions = pd.DataFrame(scored)
    df_mentions["harvested_at"] = datetime.now(tz=timezone.utc).isoformat()

    # ── Save raw scored mentions ───────────────────────────────────────────
    raw_out = SENTIMENT_OUTPUT.parent / "sentiment_mentions_raw.parquet"
    df_mentions.to_parquet(raw_out, index=False, compression="snappy")
    log.info("Raw mentions saved: %s (%d rows)", raw_out.name, len(df_mentions))

    # ── Compute Market Confidence Index ───────────────────────────────────
    log.info("Phase 4: Market Confidence Index Aggregation")
    df_mci = compute_market_confidence_index(df_mentions)

    if not df_mci.empty:
        df_mci.to_parquet(SENTIMENT_OUTPUT, index=False, compression="snappy")
        log.info("MCI saved: %s (%d startups)", SENTIMENT_OUTPUT.name, len(df_mci))
    else:
        log.warning("MCI DataFrame is empty — check entity resolution.")

    log.info("Sentiment pipeline complete.")
    return df_mci


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="IntelliStake Sentiment Harvester")
    parser.add_argument("--max-mentions", type=int, default=TARGET_MENTION_COUNT,
                        help="Max raw mentions to harvest")
    parser.add_argument("--full-text",    action="store_true",
                        help="Scrape full article body (slower)")
    args = parser.parse_args()

    df = run_sentiment_pipeline(
        max_mentions=args.max_mentions,
        enrich_full_text=args.full_text,
    )
    print(f"\n✅ Sentiment pipeline complete. MCI computed for {len(df)} startups.")
    if not df.empty:
        print(df[["startup_id", "mention_count", "market_confidence_index", "mci_label"]].head(20).to_string(index=False))
