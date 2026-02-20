"""
master_knowledge_graph.py
==========================
IntelliStake — The "Big Data" Synthesizer

Architecture:
  1. Load all 4 enrichment streams   (Dask DataFrames)
  2. Entity Resolution               (fuzzy name deduplication → canonical startup_id)
  3. Stream Fusion                   (left-joins on startup_id)
  4. Feature Engineering             (composite scores, time-series flags)
  5. Output                          (Parquet knowledge graph + CSV summary)

Unified Data Schema → 5,00,000+ total data points:
  Master startups (50,000)
    × Sentiment time-series (100,000 mention events)
    × MCA filings (5,000 audited companies)
    × GitHub velocity (1,000 repos)
    × Real funding rounds (46,809 rounds)
  ─────────────────────────────────────────────────
  Total events: ~200,000 unique records
  Total data points (features × records): ~500,000+

Dependencies:
  pip install dask pandas pyarrow rapidfuzz tqdm
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import dask.dataframe as dd
import pandas as pd
from dask.diagnostics import ProgressBar

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    MASTER_STARTUPS_PATH, REAL_FUNDING_PATH,
    SENTIMENT_OUTPUT, MCA_OUTPUT, GITHUB_VELOCITY_OUTPUT,
    KNOWLEDGE_GRAPH_OUTPUT, KNOWLEDGE_GRAPH_CSV,
    DASK_NPARTITIONS, DASK_SCHEDULER,
    ENTITY_FUZZY_THRESHOLD,
    LOG_DIR, LOG_FORMAT, LOG_LEVEL,
)

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "knowledge_graph.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("knowledge_graph")


# ─────────────────────────────────────────────────────────────────────────────
# UNIFIED DATA SCHEMA (authoritative reference)
# ─────────────────────────────────────────────────────────────────────────────

SCHEMA_DESCRIPTION = """
IntelliStake Master Knowledge Graph — Unified Data Schema
==========================================================

Entity: Startup (primary key: startup_id)

Core Identity Block (from intellistake_startups_clean.json)
───────────────────────────────────────────────────────────
startup_id                UUID / GH-XXXX / CB-XXXX
startup_name              str
country                   str (ISO country name)
sector                    str (Fintech | AI/ML | SaaS | Blockchain | ...)
founded_year              int
funding_round             str (Pre-Seed | Seed | Series A–D | PE)
funding_amount_usd        float
estimated_valuation_usd   float
employee_count            int
company_age_years         int
valuation_tier            str (Early Stage | Growth | Centaur | Unicorn+)
lead_investor             str

GitHub Execution Block (from github_velocity_aggregator.py)
────────────────────────────────────────────────────────────
github_repo               str (org/repo)
commits_last_365d         int
commits_last_90d          int
commits_last_30d          int
unique_contributors_1yr   int
bus_factor                int
velocity_slope            float  (OLS slope over weekly buckets)
velocity_tier             str   (ROCKET | HIGH | MEDIUM | LOW | STALE)
velocity_trust_delta      float
repo_stars                int
repo_forks                int
repo_language             str

Trust & Risk Block (from intellistake_startups_clean.json)
──────────────────────────────────────────────────────────
trust_score               float [0–1]  ← UPDATED by GitHub velocity delta
trust_label               str (LOW | MEDIUM | HIGH TRUST)
risk_flag_active          bool
risk_severity             str (NONE | LOW | MEDIUM | HIGH)
bl_omega_multiplier       float (Bl-Omega risk adjustment)
portfolio_action          str

Sentiment Block (from sentiment_harvester.py)
─────────────────────────────────────────────
mention_count             int
positive_count            int
negative_count            int
market_confidence_index   float [-1, +1]
mci_label                 str (HIGH | MODERATE | LOW)
latest_mention            str (ISO datetime)

MCA Financial Integrity Block (from mca_audit_pipeline.py)
───────────────────────────────────────────────────────────
cin                       str (Corporate Identity Number, Indian companies)
reported_revenue_usd      float | null
revenue_delta_pct         float | null  (abs % deviation from estimate)
valuation_anomaly         bool
anomaly_severity          str (CLEAN | MINOR | MODERATE | SEVERE | UNKNOWN)
audit_flag                str (VERIFIED | ANOMALY | UNRESOLVED)

Funding Rounds Block (from real_funding_data.json, one row per round)
──────────────────────────────────────────────────────────────────────
funding_round_id          str
funding_date              str
funding_round_type        str
city                      str
co_investors              str (comma-joined)
data_source               str (crunchbase_india | intellistake_synthetic)

Composite Signals (computed during graph construction)
──────────────────────────────────────────────────────
intellistake_score        float [0–100]   → weighted composite of all signals
confidence_percentile     float [0–100]   → rank within sector
risk_adjusted_valuation   float           → xgboost_val × (1/bl_omega) × mci_boost
data_completeness_pct     float [0–100]   → % of optional blocks resolved
"""


# ─────────────────────────────────────────────────────────────────────────────
# ENTITY RESOLUTION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class EntityResolver:
    """
    Cross-dataset entity resolution using a two-pass strategy:
      Pass 1: Exact match on startup_id (O(1))
      Pass 2: Exact match on normalised startup_name (O(1))
      Pass 3: Fuzzy match via RapidFuzz partial_ratio (O(n), threshold 82)

    Builds a canonical ID map: alias → canonical startup_id
    """

    def __init__(self, master_df: pd.DataFrame):
        self.id_set    = set(master_df["startup_id"].dropna())
        self.name_map  = {
            str(n).lower().strip(): sid
            for sid, n in zip(master_df["startup_id"], master_df["startup_name"])
            if pd.notna(n)
        }
        self._cache: dict[str, str | None] = {}
        log.info("EntityResolver built: %d IDs, %d name keys",
                 len(self.id_set), len(self.name_map))

    def resolve(self, startup_id: str | None, name: str | None) -> str | None:
        """Return canonical startup_id or None if unresolvable."""
        # Pass 1 — exact ID match
        if startup_id and startup_id in self.id_set:
            return startup_id

        if not name:
            return None

        name_key = str(name).lower().strip()

        # Cache hit
        if name_key in self._cache:
            return self._cache[name_key]

        # Pass 2 — exact name match
        if name_key in self.name_map:
            self._cache[name_key] = self.name_map[name_key]
            return self._cache[name_key]

        # Pass 3 — fuzzy match
        try:
            from rapidfuzz import process, fuzz
            match, score, _ = process.extractOne(
                name_key, self.name_map.keys(),
                scorer=fuzz.partial_ratio,
            ) or (None, 0, None)
            if score >= ENTITY_FUZZY_THRESHOLD and match:
                self._cache[name_key] = self.name_map[match]
                return self._cache[name_key]
        except ImportError:
            pass

        self._cache[name_key] = None
        return None

    def resolve_dataframe(
        self, df: pd.DataFrame,
        id_col: str | None = "startup_id",
        name_col: str | None = "startup_name",
    ) -> pd.DataFrame:
        """Add/update canonical_id column in a DataFrame."""
        df = df.copy()
        df["canonical_id"] = df.apply(
            lambda r: self.resolve(
                r.get(id_col) if id_col else None,
                r.get(name_col) if name_col else None,
            ),
            axis=1,
        )
        resolved_pct = df["canonical_id"].notna().mean() * 100
        log.info("Entity resolution: %.1f%% records linked to canonical ID", resolved_pct)
        return df


# ─────────────────────────────────────────────────────────────────────────────
# STREAM LOADERS
# ─────────────────────────────────────────────────────────────────────────────

def _load_parquet_if_exists(path: Path, label: str) -> pd.DataFrame:
    if path.exists():
        df = pd.read_parquet(path)
        log.info("Loaded %s: %d rows", label, len(df))
        return df
    log.warning("%s not found at %s — stream will be empty", label, path)
    return pd.DataFrame()


def load_all_streams() -> dict[str, pd.DataFrame]:
    """Load master + all enrichment streams. Returns {stream_name: DataFrame}."""
    log.info("Loading all data streams …")
    streams: dict[str, pd.DataFrame] = {}

    # Master startups (always required)
    with open(MASTER_STARTUPS_PATH, encoding="utf-8") as fh:
        streams["master"] = pd.DataFrame(json.load(fh))
    log.info("Master startups: %d rows", len(streams["master"]))

    # Real funding data
    with open(REAL_FUNDING_PATH, encoding="utf-8") as fh:
        streams["funding"] = pd.DataFrame(json.load(fh))
    log.info("Real funding rounds: %d rows", len(streams["funding"]))

    # Enrichment streams (may not exist if pipelines haven't run yet)
    streams["sentiment"] = _load_parquet_if_exists(SENTIMENT_OUTPUT,        "Sentiment MCI")
    streams["mca"]       = _load_parquet_if_exists(MCA_OUTPUT,              "MCA Audit")
    streams["github"]    = _load_parquet_if_exists(GITHUB_VELOCITY_OUTPUT,  "GitHub Velocity")

    return streams


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────

def compute_intellistake_score(row: pd.Series) -> float:
    """
    Composite IntelliStake Score [0–100] combining:
      40% Financial signal   — normalised valuation + funding tier
      25% Trust signal       — trust_score (updated by GitHub velocity)
      20% Sentiment signal   — market_confidence_index
      15% Risk penalty       — bl_omega_multiplier inversion

    Score = Σ(weight_i × normalised_signal_i) × 100
    """
    # ── Financial (40%) ─────────────────────────────────────────────────────
    valuation   = row.get("xgboost_adjusted_valuation", 0) or 0
    fin_score   = min(math.log1p(valuation) / math.log1p(1e10), 1.0) * 0.40

    # ── Trust (25%) ──────────────────────────────────────────────────────────
    trust       = float(row.get("updated_trust_score", row.get("trust_score", 0.5)) or 0.5)
    trust_score = trust * 0.25

    # ── Sentiment (20%) ──────────────────────────────────────────────────────
    mci   = float(row.get("market_confidence_index", 0.0) or 0.0)
    sent  = (mci + 1.0) / 2.0 * 0.20     # map [-1,+1] → [0,1] → weighted

    # ── Risk (15%) — inverse of omega multiplier ─────────────────────────────
    omega      = float(row.get("bl_omega_multiplier", 1.0) or 1.0)
    risk_score = (1.0 / max(omega, 1.0)) * 0.15

    return round((fin_score + trust_score + sent + risk_score) * 100, 2)


def compute_risk_adjusted_valuation(row: pd.Series) -> float:
    """
    Risk-adjusted valuation:
      RAV = xgboost_valuation × (1 / bl_omega) × (1 + 0.1 × MCI)
    """
    val   = float(row.get("xgboost_adjusted_valuation", 0) or 0)
    omega = float(row.get("bl_omega_multiplier", 1.0) or 1.0)
    mci   = float(row.get("market_confidence_index", 0.0) or 0.0)
    return round(val * (1.0 / max(omega, 1.0)) * (1.0 + 0.1 * mci), 2)


def compute_data_completeness(row: pd.Series) -> float:
    """% of optional enrichment fields that are non-null."""
    optional_fields = [
        "market_confidence_index", "mention_count",     # sentiment
        "reported_revenue_usd", "cin", "audit_flag",    # MCA
        "commits_last_90d", "velocity_tier",             # GitHub
        "lead_investor",                                  # funding
    ]
    filled = sum(1 for f in optional_fields if pd.notna(row.get(f)))
    return round(filled / len(optional_fields) * 100, 1)


# ─────────────────────────────────────────────────────────────────────────────
# FUSION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def fuse_streams(streams: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Merge all enrichment streams onto the master startups DataFrame.

    Join strategy: LEFT JOIN (every startup retained; enrichments are optional).
    De-duplicate each enrichment stream on startup_id before joining.
    """
    master = streams["master"].copy()
    resolver = EntityResolver(master)
    log.info("Starting stream fusion on %d master records …", len(master))

    # ── GitHub Velocity ───────────────────────────────────────────────────────
    if not streams["github"].empty:
        gh = streams["github"].drop_duplicates("startup_id")
        gh_cols = [
            "startup_id", "commits_last_365d", "commits_last_90d", "commits_last_30d",
            "unique_contributors_1yr", "bus_factor", "velocity_slope", "velocity_tier",
            "velocity_trust_delta", "updated_trust_score",
            "repo_stars", "repo_forks", "repo_language",
        ]
        gh = gh[[c for c in gh_cols if c in gh.columns]]
        master = master.merge(gh, on="startup_id", how="left", suffixes=("", "_gh"))
        log.info("  GitHub velocity merged: %d matched repos",
                 master["velocity_tier"].notna().sum())

    # ── Sentiment / MCI ───────────────────────────────────────────────────────
    if not streams["sentiment"].empty:
        sent = resolver.resolve_dataframe(streams["sentiment"])
        sent = sent[sent["canonical_id"].notna()].drop_duplicates("canonical_id")
        sent_cols = [
            "canonical_id", "mention_count", "positive_count", "negative_count",
            "market_confidence_index", "mci_label", "latest_mention",
        ]
        sent = sent[[c for c in sent_cols if c in sent.columns]]
        sent = sent.rename(columns={"canonical_id": "startup_id"})
        master = master.merge(sent, on="startup_id", how="left")
        log.info("  Sentiment MCI merged: %d startups with MCI",
                 master["market_confidence_index"].notna().sum())

    # ── MCA Audit ─────────────────────────────────────────────────────────────
    if not streams["mca"].empty:
        mca = streams["mca"].drop_duplicates("startup_id")
        mca_cols = [
            "startup_id", "cin", "reported_revenue_usd",
            "revenue_delta_pct", "valuation_anomaly", "anomaly_severity", "audit_flag",
        ]
        mca = mca[[c for c in mca_cols if c in mca.columns]]
        master = master.merge(mca, on="startup_id", how="left")
        log.info("  MCA audit merged: %d startups audited",
                 master["audit_flag"].notna().sum())

    # ── Real Funding (aggregated per startup) ─────────────────────────────────
    if not streams["funding"].empty:
        fund = resolver.resolve_dataframe(
            streams["funding"],
            id_col="startup_id",
            name_col="startup_name",
        )
        fund_valid = fund[fund["canonical_id"].notna()].copy()
        fund_agg = (
            fund_valid.groupby("canonical_id")
            .agg(
                total_funding_rounds=("funding_round", "count"),
                total_funding_raised_usd=("funding_amount_usd", "sum"),
                latest_funding_year=("founded_year", "max"),
                funding_sources=("source", lambda x: ",".join(x.unique())),
            )
            .reset_index()
            .rename(columns={"canonical_id": "startup_id"})
        )
        master = master.merge(fund_agg, on="startup_id", how="left")
        log.info("  Funding rounds aggregated: %d startups with funding history",
                 master["total_funding_rounds"].notna().sum())

    return master


# ─────────────────────────────────────────────────────────────────────────────
# DASK PROCESSING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def build_knowledge_graph_with_dask(master_df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert fused DataFrame to Dask, apply feature engineering at scale,
    compute composite signals, and return final knowledge graph.
    """
    log.info("Converting to Dask DataFrame (%d partitions) …", DASK_NPARTITIONS)
    ddf = dd.from_pandas(master_df, npartitions=DASK_NPARTITIONS)

    # Apply composite score computation (Dask map_partitions for parallelism)
    def apply_scores(partition: pd.DataFrame) -> pd.DataFrame:
        partition = partition.copy()
        partition["intellistake_score"]       = partition.apply(compute_intellistake_score, axis=1)
        partition["risk_adjusted_valuation"]  = partition.apply(compute_risk_adjusted_valuation, axis=1)
        partition["data_completeness_pct"]    = partition.apply(compute_data_completeness, axis=1)
        return partition

    log.info("Applying composite feature engineering via Dask map_partitions …")
    ddf_enriched = ddf.map_partitions(apply_scores)

    # Compute confidence percentile within sector (requires a full reduce)
    log.info("Computing confidence percentiles …")
    with ProgressBar():
        result_df = ddf_enriched.compute(scheduler=DASK_SCHEDULER)

    # Add sector-relative confidence percentile
    result_df["confidence_percentile"] = (
        result_df.groupby("sector")["intellistake_score"]
        .rank(pct=True) * 100
    ).round(2)

    # Add graph construction timestamp
    result_df["graph_built_at"] = datetime.now(tz=timezone.utc).isoformat()

    log.info("Dask processing complete: %d rows, %d columns",
             len(result_df), len(result_df.columns))
    return result_df


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

def run_knowledge_graph_pipeline(save_csv: bool = True) -> pd.DataFrame:
    """
    Full R.A.I.S.E. data fusion pipeline:
      1. Load all streams
      2. Entity resolution
      3. Left-join fusion
      4. Dask feature engineering
      5. Persist Parquet + optional CSV

    Returns final knowledge graph DataFrame.
    """
    log.info("=" * 64)
    log.info("IntelliStake Master Knowledge Graph Builder")
    log.info("Schema version: R.A.I.S.E. v2.0")
    log.info("=" * 64)

    # Print schema for documentation
    log.info(SCHEMA_DESCRIPTION)

    # Step 1: Load
    streams = load_all_streams()

    # Step 2 & 3: Entity resolve + fuse
    fused_df = fuse_streams(streams)
    log.info("Fused DataFrame: %d rows × %d columns", len(fused_df), len(fused_df.columns))

    # Step 4: Dask feature engineering
    graph_df = build_knowledge_graph_with_dask(fused_df)

    # Step 5: Persist
    graph_df.to_parquet(KNOWLEDGE_GRAPH_OUTPUT, index=False, compression="snappy")
    log.info("Knowledge graph saved: %s (%d rows)", KNOWLEDGE_GRAPH_OUTPUT.name, len(graph_df))

    if save_csv:
        # Save a summary CSV (key columns only, for quick inspection)
        summary_cols = [
            "startup_id", "startup_name", "country", "sector", "founded_year",
            "funding_round", "funding_amount_usd", "estimated_valuation_usd",
            "trust_score", "updated_trust_score", "trust_label",
            "risk_severity", "bl_omega_multiplier",
            "market_confidence_index", "mci_label",
            "valuation_anomaly", "audit_flag",
            "velocity_tier", "commits_last_90d",
            "intellistake_score", "confidence_percentile",
            "risk_adjusted_valuation", "data_completeness_pct",
            "valuation_tier", "graph_built_at",
        ]
        csv_cols = [c for c in summary_cols if c in graph_df.columns]
        graph_df[csv_cols].to_csv(KNOWLEDGE_GRAPH_CSV, index=False)
        log.info("Summary CSV saved: %s", KNOWLEDGE_GRAPH_CSV.name)

    # ── Final data point count ─────────────────────────────────────────────
    total_points = len(graph_df) * len(graph_df.columns)
    log.info("=" * 64)
    log.info("TOTAL DATA POINTS IN KNOWLEDGE GRAPH: %s", f"{total_points:,}")
    log.info("Rows: %d | Columns: %d", len(graph_df), len(graph_df.columns))
    log.info("=" * 64)

    _print_summary_stats(graph_df)
    return graph_df


def _print_summary_stats(df: pd.DataFrame) -> None:
    """Print a clean summary table to stdout."""
    print("\n" + "=" * 64)
    print("  IntelliStake Knowledge Graph — Summary Statistics")
    print("=" * 64)
    print(f"  Total startups:           {len(df):>10,}")
    print(f"  Total columns (features): {len(df.columns):>10,}")
    print(f"  Total data points:        {len(df)*len(df.columns):>10,}")
    print(f"  Data completeness avg:    {df.get('data_completeness_pct', pd.Series([0])).mean():>9.1f}%")

    if "sector" in df.columns:
        print("\n  Top 5 Sectors:")
        for sector, count in df["sector"].value_counts().head(5).items():
            print(f"    {sector:<24} {count:>6,}")

    if "intellistake_score" in df.columns:
        scores = pd.to_numeric(df["intellistake_score"], errors="coerce").dropna()
        if not scores.empty:
            print(f"\n  IntelliStake Score:")
            print(f"    Mean:  {scores.mean():.2f}")
            print(f"    Max:   {scores.max():.2f}")
            print(f"    Min:   {scores.min():.2f}")

    if "valuation_anomaly" in df.columns:
        # Cast to bool-compatible int to avoid ArrowStringArray.sum() error
        anom = pd.to_numeric(df["valuation_anomaly"], errors="coerce").fillna(0).astype(int).sum()
        print(f"\n  Valuation anomalies flagged: {int(anom):,}")

    if "velocity_tier" in df.columns:
        print("\n  GitHub Velocity Distribution:")
        for tier, cnt in df["velocity_tier"].value_counts().items():
            print(f"    {tier:<12} {cnt:>6,}")

    print("=" * 64)


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="IntelliStake Master Knowledge Graph Builder"
    )
    parser.add_argument("--no-csv", action="store_true",
                        help="Skip CSV summary export")
    args = parser.parse_args()

    df = run_knowledge_graph_pipeline(save_csv=not args.no_csv)
    print(f"\n✅ Knowledge graph built: {len(df):,} startups × {len(df.columns)} features "
          f"= {len(df)*len(df.columns):,} data points")
