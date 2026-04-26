#!/usr/bin/env python3
"""
Import IntelliStake datapool into Supabase.

Prerequisite:
1. Run supabase/schema.sql in Supabase SQL Editor.
2. Ensure engine/.env contains SUPABASE_URL and SUPABASE_ANON_KEY.

Usage:
  python3 scripts/import_datapool_to_supabase.py --all
  python3 scripts/import_datapool_to_supabase.py --limit 1000
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
ENGINE_ENV = ROOT / "engine" / ".env"


def load_env() -> None:
    if not ENGINE_ENV.exists():
        return
    for line in ENGINE_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def clean(value: Any) -> Any:
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


def as_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def as_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        n = float(value)
        return None if math.isnan(n) or math.isinf(n) else n
    except Exception:
        return None


def load_json(path: str) -> Any:
    with open(ROOT / path, "r", encoding="utf-8") as f:
        return json.load(f)


def batches(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def startup_rows(limit: int | None) -> list[dict[str, Any]]:
    data = load_json("unified_data/cleaned/intellistake_startups_clean.json")
    if limit:
        data = data[:limit]
    rows = []
    for r in data:
        rows.append(clean({
            "startup_name": r.get("startup_name"),
            "sector": r.get("sector"),
            "city": r.get("city"),
            "country": r.get("country"),
            "founded_year": as_int(r.get("founded_year")),
            "company_age_years": as_float(r.get("company_age_years")),
            "total_funding_usd": as_float(r.get("total_funding_usd")),
            "valuation_usd": as_float(r.get("valuation_usd")),
            "revenue_usd": as_float(r.get("revenue_usd")),
            "employees": as_int(r.get("employees")),
            "trust_score": as_float(r.get("trust_score")),
            "sentiment_cfs": as_float(r.get("sentiment_cfs")),
            "github_velocity_score": as_float(r.get("github_velocity_score")),
            "stage": r.get("stage"),
            "data_source": r.get("data_source"),
            "investors": r.get("investors"),
            "is_real": bool(r.get("is_real")) if r.get("is_real") is not None else None,
            "raw": r,
        }))
    return rows


def funding_rows(limit: int | None) -> list[dict[str, Any]]:
    data = load_json("unified_data/cleaned/real_funding_data.json")
    if limit:
        data = data[:limit]
    rows = []
    for r in data:
        rows.append(clean({
            "startup_id": r.get("startup_id"),
            "startup_name": r.get("startup_name"),
            "sector": r.get("sector"),
            "city": r.get("city"),
            "country": r.get("country"),
            "funding_round": r.get("funding_round"),
            "funding_amount_usd": as_float(r.get("funding_amount_usd")),
            "lead_investor": r.get("lead_investor"),
            "founded_year": as_int(r.get("founded_year")),
            "estimated_valuation_usd": as_float(r.get("estimated_valuation_usd")),
            "estimated_revenue_usd": as_float(r.get("estimated_revenue_usd")),
            "employee_count": as_int(r.get("employee_count")),
            "exited": bool(r.get("exited")) if r.get("exited") is not None else None,
            "exit_type": r.get("exit_type"),
            "tags": r.get("tags"),
            "funding_date": r.get("funding_date"),
            "source": r.get("source"),
            "valuation_tier": r.get("valuation_tier"),
            "raw": r,
        }))
    return rows


def shap_rows(limit: int | None) -> list[dict[str, Any]]:
    data = load_json("unified_data/4_production/shap_narratives.json")
    if limit:
        data = data[:limit]
    rows = []
    for r in data:
        rows.append(clean({
            "startup_name": r.get("startup_name"),
            "sector": r.get("sector"),
            "predicted_valuation_usd": as_float(r.get("predicted_valuation_usd") or r.get("predicted_valuation")),
            "actual_valuation_usd": as_float(r.get("actual_valuation_usd") or r.get("valuation_usd")),
            "trust_score": as_float(r.get("trust_score")),
            "model_confidence": as_float(r.get("model_confidence")),
            "narrative_text": r.get("narrative_text"),
            "features": r.get("features"),
            "survival_1yr": as_float(r.get("survival_1yr")),
            "survival_3yr": as_float(r.get("survival_3yr")),
            "survival_5yr": as_float(r.get("survival_5yr")),
            "survival_score": as_float(r.get("survival_score")),
            "raw": r,
        }))
    return rows


def finbert_rows(limit: int | None) -> list[dict[str, Any]]:
    blob = load_json("unified_data/4_production/finbert_sentiment_scores.json")
    data = blob.get("scores", []) if isinstance(blob, dict) else blob
    if limit:
        data = data[:limit]
    rows = []
    for r in data:
        rows.append(clean({
            "headline": r.get("headline") or r.get("title"),
            "source": r.get("source"),
            "label": r.get("label") or r.get("sentiment_label"),
            "score": as_float(r.get("score")),
            "compound": as_float(r.get("compound") or r.get("compound_score")),
            "sector": r.get("sector"),
            "raw": r,
        }))
    return rows


def insert_table(supabase, table: str, rows: list[dict[str, Any]], batch_size: int, truncate: bool) -> None:
    if not rows:
        print(f"{table}: no rows")
        return
    if truncate:
        print(f"{table}: clearing existing rows")
        supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    total = len(rows)
    print(f"{table}: importing {total:,} rows")
    done = 0
    for chunk in batches(rows, batch_size):
        supabase.table(table).insert(chunk).execute()
        done += len(chunk)
        print(f"  {done:,}/{total:,}")
        time.sleep(0.08)


def main() -> int:
    load_env()
    try:
        from supabase import create_client
    except Exception as exc:
        print(f"Missing Python supabase package: {exc}", file=sys.stderr)
        return 2

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_ANON_KEY are required in engine/.env", file=sys.stderr)
        return 2

    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Import the complete datapool")
    parser.add_argument("--limit", type=int, default=None, help="Import only N rows from each source for a fast demo")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--truncate", action="store_true", help="Clear target tables before inserting")
    args = parser.parse_args()

    if not args.all and not args.limit:
        print("Use --all for the full datapool or --limit N for a demo import.", file=sys.stderr)
        return 2

    limit = None if args.all else args.limit
    supabase = create_client(url, key)

    insert_table(supabase, "startup_dataset", startup_rows(limit), args.batch_size, args.truncate)
    insert_table(supabase, "funding_rounds", funding_rows(limit), args.batch_size, args.truncate)
    insert_table(supabase, "shap_narratives", shap_rows(limit), args.batch_size, args.truncate)
    insert_table(supabase, "finbert_headlines", finbert_rows(limit), args.batch_size, args.truncate)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
