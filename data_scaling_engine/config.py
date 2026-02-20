"""
config.py — Centralised configuration for the IntelliStake Data Scaling Engine.
All API keys, file paths, rate-limit constants, and schema definitions live here.
"""

import os
from pathlib import Path

# ── Project root ─────────────────────────────────────────────────────────────
ROOT_DIR         = Path(__file__).resolve().parent.parent
DATA_DIR         = ROOT_DIR / "Phase_2_Data"
ENGINE_DIR       = ROOT_DIR / "Data_Scaling_Engine"
OUTPUT_DIR       = ENGINE_DIR / "outputs"
LOG_DIR          = ENGINE_DIR / "logs"

# Ensure output and log dirs exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ── Master dataset paths ─────────────────────────────────────────────────────
MASTER_STARTUPS_PATH    = DATA_DIR / "intellistake_startups_clean.json"
RISK_SIGNALS_PATH       = DATA_DIR / "intellistake_risk_signals_clean.json"
GITHUB_REPOS_PATH       = DATA_DIR / "github_repositories_clean.json"
REAL_FUNDING_PATH       = DATA_DIR / "real_funding_data.json"

# ── Output paths ─────────────────────────────────────────────────────────────
SENTIMENT_OUTPUT        = OUTPUT_DIR / "sentiment_scores.parquet"
MCA_OUTPUT              = OUTPUT_DIR / "mca_audit_results.parquet"
GITHUB_VELOCITY_OUTPUT  = OUTPUT_DIR / "github_velocity_signals.parquet"
KNOWLEDGE_GRAPH_OUTPUT  = OUTPUT_DIR / "intellistake_master_graph.parquet"
KNOWLEDGE_GRAPH_CSV     = OUTPUT_DIR / "intellistake_master_graph.csv"

# ── API Credentials (load from environment; never hard-code secrets) ─────────
# Set these via:  export GITHUB_TOKEN="ghp_..."  etc.
GITHUB_TOKEN     = os.getenv("GITHUB_TOKEN", "")           # GitHub Personal Access Token
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")       # Reddit OAuth
REDDIT_SECRET    = os.getenv("REDDIT_SECRET", "")
REDDIT_USER_AGENT= os.getenv("REDDIT_USER_AGENT", "IntelliStakeBot/1.0")
TOFLER_API_KEY   = os.getenv("TOFLER_API_KEY", "")         # Tofler.in API
PROBE42_API_KEY  = os.getenv("PROBE42_API_KEY", "")        # Probe42 API (alternative)

# ── GitHub API ───────────────────────────────────────────────────────────────
GITHUB_BASE_URL          = "https://api.github.com"
GITHUB_RATE_LIMIT_PAUSE  = 1.0        # seconds between burst batches
GITHUB_MAX_CONCURRENT    = 20         # max simultaneous aiohttp connections
GITHUB_LOOKBACK_DAYS     = 365        # 1 year of commit history
GITHUB_TOP_N_STARTUPS    = 1000       # top N startups to enrich

# ── Sentiment Harvester ──────────────────────────────────────────────────────
NEWS_SOURCES = [
    # Format: (site_name, rss_or_sitemap_url)
    ("YourStory",       "https://yourstory.com/feed"),
    ("Inc42",           "https://inc42.com/feed/"),
    ("TechCrunch",      "https://techcrunch.com/feed/"),
    ("VCCircle",        "https://www.vccircle.com/feed"),
    ("Entrackr",        "https://entrackr.com/feed/"),
    ("Economic Times",  "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78570550.cms"),
    ("Mint",            "https://www.livemint.com/rss/companies"),
    ("Business Standard","https://www.business-standard.com/rss/technology-10006.rss"),
]
REDDIT_SUBREDDITS        = ["india", "IndiaInvestments", "Indianstartups", "startups", "StockMarket"]
TARGET_MENTION_COUNT     = 100_000    # target mentions to harvest
VADER_BATCH_SIZE         = 5_000      # records per VADER batch
REQUEST_TIMEOUT_SECS     = 15        # HTTP timeout per request
REQUEST_RETRY_ATTEMPTS   = 3

# ── MCA Audit Pipeline ───────────────────────────────────────────────────────
MCA_BASE_URL             = "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"
TOFLER_BASE_URL          = "https://api.tofler.in/v1"
PROBE42_BASE_URL         = "https://api.probe42.in/prod_new"
VALUATION_ANOMALY_THRESH = 0.30       # >30% deviation from filing = anomaly flag
MCA_SCRAPE_DELAY_SECS    = 2.0        # polite delay between MCA page requests

# ── Dask / Spark ─────────────────────────────────────────────────────────────
DASK_NPARTITIONS         = 16         # Dask DataFrame partitions
DASK_SCHEDULER           = "threads"  # or "synchronous" for debugging

# ── VADER thresholds ─────────────────────────────────────────────────────────
SENTIMENT_POSITIVE_THRESH =  0.05
SENTIMENT_NEGATIVE_THRESH = -0.05

# ── Entity resolution ────────────────────────────────────────────────────────
# Fuzzy-match threshold (0–100) for matching startup names across datasets
ENTITY_FUZZY_THRESHOLD   = 82

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_LEVEL  = "INFO"   # DEBUG / INFO / WARNING / ERROR
