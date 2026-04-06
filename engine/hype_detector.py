"""
engine/hype_detector.py
=======================
IntelliStake — Hype Anomaly Detector (Domain 2, Cybersecurity/Unsupervised AI)

Uses Isolation Forest to identify startups where valuation is
DISCONNECTED from actual technical signals (code velocity, team size,
revenue) — flagging them as "Hype Anomalies" for investor protection.

Labels:
  HYPE_ANOMALY  — high valuation but low real-world signals
  LEGITIMATE    — valuation proportional to fundamentals
  STAGNANT      — low valuation AND low signals (undervalued or dormant)

Output:
  unified_data/4_production/hype_anomaly_flags.json

Usage:
  python engine/hype_detector.py
  python engine/hype_detector.py --contamination 0.07   # adjust anomaly rate
  python engine/hype_detector.py --top-n 100           # analyse top-N by valuation
"""

import os
import sys
import json
import warnings
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

BASE_DIR  = Path(__file__).resolve().parent.parent
UNIFIED   = BASE_DIR / "unified_data"
PROD_DIR  = UNIFIED / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)

STARTUPS_PATHS = [
    UNIFIED / "2_cleaned"  / "intellistake_startups_clean.json",
    UNIFIED / "cleaned"    / "intellistake_startups_clean.json",
]
KG_PATHS = [
    UNIFIED / "knowledge_graph" / "intellistake_master_graph.parquet",
]

# Features: mix of "hype" signals (valuation, funding) vs "real" signals (velocity, revenue)
HYPE_FEATURES = [
    "trust_score",
    "github_velocity_score",
    "annual_revenue_usd",
    "employee_count",
    "sentiment_compound",
]
HYPE_SIGNALS = [
    "total_funding_usd",
    "predicted_valuation_usd",  # from stacked_valuation_summary if available
]


def _resolve(paths):
    return next((p for p in paths if p.exists()), None)


def load_data() -> pd.DataFrame:
    # Try KG Parquet
    kg = _resolve(KG_PATHS)
    if kg:
        df = pd.read_parquet(kg)
        print(f"  Loaded {len(df):,} rows from knowledge graph")
        return df

    # Fallback to cleaned JSON
    src = _resolve(STARTUPS_PATHS)
    if not src:
        raise FileNotFoundError("No startup data found for hype detection.")

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        for key in ("startups", "data", "items"):
            if key in data:
                data = data[key]
                break
        else:
            data = list(data.values())
    df = pd.DataFrame(data)
    print(f"  Loaded {len(df):,} rows from {src.name}")
    return df


def prepare_features(df: pd.DataFrame, top_n: int = None) -> tuple:
    col_map = {
        "total_funding":     "total_funding_usd",
        "funding_amount_usd":"total_funding_usd",
        "revenue":           "annual_revenue_usd",
        "annual_revenue":    "annual_revenue_usd",
        "employees":         "employee_count",
        "age_years":         "company_age_years",
        "github_velocity":   "github_velocity_score",
        "valuation":         "valuation_usd",
    }
    df = df.rename(columns=col_map)

    # Synthesize missing columns
    for col in HYPE_FEATURES + ["total_funding_usd", "valuation_usd"]:
        if col not in df.columns:
            df[col] = np.random.uniform(0, 1, len(df)) if "score" in col or "compound" in col else np.random.uniform(1e5, 1e8, len(df))

    if "valuation_usd" not in df.columns:
        ts   = df.get("trust_score", pd.Series(np.ones(len(df)) * 0.5))
        fund = df.get("total_funding_usd", pd.Series(np.ones(len(df)) * 1e6))
        df["valuation_usd"] = fund * 10 * (1 + ts)

    # Try to load stacked predictions if available
    stacked_path = PROD_DIR / "stacked_valuation_summary.json"
    if stacked_path.exists():
        with open(stacked_path) as f:
            stacked = json.load(f)
        pred_map = {p["startup_id"]: p["predicted_valuation_usd"] for p in stacked.get("predictions", [])}
        id_col = next((c for c in ["startup_id", "id"] if c in df.columns), None)
        if id_col:
            df["predicted_valuation_usd"] = df[id_col].map(pred_map).fillna(df["valuation_usd"])
    else:
        df["predicted_valuation_usd"] = df["valuation_usd"]

    df = df.dropna(subset=HYPE_FEATURES[:3])  # at least 3 real features needed

    # Rank by valuation for top-N selection
    if top_n:
        df = df.nlargest(top_n, "predicted_valuation_usd")

    all_feats = HYPE_FEATURES + ["total_funding_usd", "predicted_valuation_usd"]
    for col in all_feats:
        if col not in df.columns:
            df[col] = 0.0

    X = df[all_feats].fillna(0.0).astype(float)
    id_col   = next((c for c in ["startup_id", "id", "company_id"] if c in df.columns), None)
    name_col = next((c for c in ["startup_name", "name", "company_name"] if c in df.columns), None)
    ids   = df[id_col].reset_index(drop=True) if id_col else pd.Series(range(len(df)))
    names = df[name_col].reset_index(drop=True) if name_col else pd.Series([f"Startup_{i}" for i in range(len(df))])

    return X.reset_index(drop=True), df.reset_index(drop=True), ids, names, all_feats


def classify(df_row, anomaly_score: float, threshold: float = -0.1) -> str:
    """Classify anomaly + stagnation state."""
    if anomaly_score < threshold:
        return "HYPE_ANOMALY"
    # Check for stagnant: low velocity AND low valuation
    vel   = float(df_row.get("github_velocity_score", 0.5))
    trust = float(df_row.get("trust_score", 0.5))
    val   = float(df_row.get("predicted_valuation_usd", 1e8))
    if vel < 0.25 and trust < 0.4 and val < 5e7:
        return "STAGNANT"
    return "LEGITIMATE"


def disconnect_ratio(df_row) -> float:
    """Valuation / (GitHub velocity * revenue proxy). High = hype disconnect."""
    val = float(df_row.get("predicted_valuation_usd", 1e6)) + 1.0
    vel = float(df_row.get("github_velocity_score", 0.01)) + 0.01
    rev = float(df_row.get("annual_revenue_usd", 1e5)) + 1.0
    return round(val / (vel * rev), 2)


def run(contamination: float = 0.05, top_n: int = None):
    print("\n" + "=" * 60)
    print("  IntelliStake — Hype Anomaly Detector (Isolation Forest)")
    print("=" * 60)

    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    # 1. Load & prepare
    print("\n[1] Loading data …")
    df_raw = load_data()
    print(f"\n[2] Preparing features …")
    X, df_full, ids, names, feat_names = prepare_features(df_raw, top_n=top_n)
    print(f"  Features: {feat_names}")
    print(f"  Samples:  {len(X):,}")

    # 2. Scale + fit Isolation Forest
    print(f"\n[3] Fitting Isolation Forest (contamination={contamination}) …")
    scaler = StandardScaler()
    X_sc   = scaler.fit_transform(X)

    iso = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_features=len(feat_names),
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_sc)
    raw_scores   = iso.decision_function(X_sc)  # higher = more normal
    iso_labels   = iso.predict(X_sc)            # +1=normal, -1=anomaly

    # 3. Build output records
    print(f"\n[4] Classifying {len(X):,} startups …")
    records = []
    label_counts = {"HYPE_ANOMALY": 0, "LEGITIMATE": 0, "STAGNANT": 0}

    for i in range(len(X)):
        score = float(raw_scores[i])
        label = classify(df_full.iloc[i], score)
        label_counts[label] += 1
        dr = disconnect_ratio(df_full.iloc[i])

        records.append({
            "rank":             i + 1,
            "startup_id":       str(ids.iloc[i]),
            "startup_name":     str(names.iloc[i]),
            "anomaly_score":    round(score, 4),
            "iso_forest_label": "ANOMALY" if iso_labels[i] == -1 else "NORMAL",
            "classification":   label,
            "disconnect_ratio": dr,
            "trust_score":      round(float(df_full.iloc[i].get("trust_score", 0.0)), 4),
            "github_velocity":  round(float(df_full.iloc[i].get("github_velocity_score", 0.0)), 4),
            "predicted_valuation_usd": round(float(df_full.iloc[i].get("predicted_valuation_usd", 0.0)), 2),
            "total_funding_usd":round(float(df_full.iloc[i].get("total_funding_usd", 0.0)), 2),
            "alert": (
                f"HIGH DISCONNECT: Valuation {dr:,.0f}× above velocity×revenue composite"
                if label == "HYPE_ANOMALY" else None
            ),
        })

    # Sort: HYPE_ANOMALY first, then by disconnect_ratio desc
    records.sort(key=lambda r: (0 if r["classification"] == "HYPE_ANOMALY" else 1, -r["disconnect_ratio"]))

    output = {
        "meta": {
            "generated_at":   datetime.now(timezone.utc).isoformat(),
            "model":          "IsolationForest (sklearn)",
            "contamination":  contamination,
            "n_estimators":   200,
            "features":       feat_names,
            "total_analysed": len(records),
        },
        "summary": {
            "hype_anomaly_count":  label_counts["HYPE_ANOMALY"],
            "legitimate_count":    label_counts["LEGITIMATE"],
            "stagnant_count":      label_counts["STAGNANT"],
            "hype_anomaly_pct":    round(label_counts["HYPE_ANOMALY"] / len(records) * 100, 1),
        },
        "flags": records,
    }

    out_path = PROD_DIR / "hype_anomaly_flags.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n  ✓ Output written → {out_path}")
    print(f"  HYPE_ANOMALY: {label_counts['HYPE_ANOMALY']} | LEGITIMATE: {label_counts['LEGITIMATE']} | STAGNANT: {label_counts['STAGNANT']}")
    print(f"  Top hype startup: {records[0]['startup_name']} (disconnect ratio: {records[0]['disconnect_ratio']:,})")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliStake Hype Anomaly Detector")
    parser.add_argument("--contamination", type=float, default=0.05, help="Expected anomaly fraction (default: 0.05)")
    parser.add_argument("--top-n",         type=int,   default=None,  help="Analyse only top-N by valuation")
    args = parser.parse_args()
    run(contamination=args.contamination, top_n=args.top_n)
