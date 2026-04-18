"""
engine/anomaly_ensemble.py
===========================
IntelliStake — 4-Model Anomaly Detection Ensemble (Domain 2, AI Upgrade 2F)

Replaces single Isolation Forest with a 4-model ensemble:

  Model              Type           Notes
  ─────────────────  ─────────────  ──────────────────────────────────────
  Isolation Forest   Tree-based     Existing model, kept
  LOF                Density-based  Local Outlier Factor, k=20
  DBSCAN             Clustering     eps auto-tuned via k-distance elbow
  Autoencoder        Neural net     PyTorch 3-layer bottleneck, CPU

Hype anomaly flagged ONLY if ≥ 3/4 detectors agree → reduces false positives.

Output adds `ensemble_votes` field to each prediction:
  {
    "isolation_forest": 1,  // 1=anomaly, 0=normal
    "lof":              1,
    "dbscan":           0,
    "autoencoder":      1,
    "ensemble_votes":   3,
    "is_hype_anomaly":  true   // true if votes >= 3
  }

Usage:
  from engine.anomaly_ensemble import detect_anomalies
  results = detect_anomalies(df_features)   # DataFrame with HYPE_FEATURES

  python engine/anomaly_ensemble.py         # run on full dataset
  python engine/anomaly_ensemble.py --contamination 0.07
"""

import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
PROD_DIR = BASE_DIR / "unified_data" / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)

HYPE_FEATURES = [
    "trust_score",
    "github_velocity_score",
    "annual_revenue_usd",
    "employee_count",
    "sentiment_compound",
]
HYPE_SIGNALS = [
    "total_funding_usd",
    "predicted_valuation_usd",
]

VOTE_THRESHOLD = 3   # ≥3 of 4 detectors must agree


# ── Data helpers ───────────────────────────────────────────────────────────────
def _prep_features(df: pd.DataFrame, contamination: float = 0.08) -> np.ndarray:
    """Extract and normalise hype features from DataFrame."""
    cols = [c for c in HYPE_FEATURES + HYPE_SIGNALS if c in df.columns]
    if not cols:
        raise ValueError(f"No hype features found in DataFrame. Expected: {HYPE_FEATURES}")

    X = df[cols].fillna(df[cols].median()).astype(float)
    # Log-scale high-variance columns
    for col in ["annual_revenue_usd", "total_funding_usd", "predicted_valuation_usd", "employee_count"]:
        if col in X.columns:
            X[col] = np.log1p(X[col])

    from sklearn.preprocessing import RobustScaler
    scaler = RobustScaler()
    return scaler.fit_transform(X)


# ── Model 1: Isolation Forest ─────────────────────────────────────────────────
def _run_isolation_forest(X: np.ndarray, contamination: float) -> np.ndarray:
    from sklearn.ensemble import IsolationForest
    clf = IsolationForest(
        n_estimators=200, contamination=contamination,
        random_state=42, n_jobs=-1
    )
    preds = clf.fit_predict(X)
    return (preds == -1).astype(int)   # 1=anomaly


# ── Model 2: LOF ──────────────────────────────────────────────────────────────
def _run_lof(X: np.ndarray, contamination: float) -> np.ndarray:
    from sklearn.neighbors import LocalOutlierFactor
    clf = LocalOutlierFactor(
        n_neighbors=20, contamination=contamination, n_jobs=-1
    )
    preds = clf.fit_predict(X)
    return (preds == -1).astype(int)


# ── Model 3: DBSCAN ───────────────────────────────────────────────────────────
def _run_dbscan(X: np.ndarray) -> np.ndarray:
    from sklearn.cluster import DBSCAN
    from sklearn.neighbors import NearestNeighbors

    # Auto-tune eps via k-distance elbow (k=5)
    try:
        nbrs = NearestNeighbors(n_neighbors=5, n_jobs=-1).fit(X)
        distances, _ = nbrs.kneighbors(X)
        k_distances = np.sort(distances[:, -1])
        # Elbow: point of maximum curvature
        diffs = np.diff(k_distances)
        eps = float(k_distances[np.argmax(diffs)])
        eps = max(eps, 0.3)   # floor to avoid over-splitting
    except Exception:
        eps = 0.5

    clf = DBSCAN(eps=eps, min_samples=5, n_jobs=-1)
    labels = clf.fit_predict(X)
    return (labels == -1).astype(int)   # noise points = anomaly


# ── Model 4: Autoencoder ──────────────────────────────────────────────────────
def _run_autoencoder(X: np.ndarray, threshold_pct: float = 90.0) -> np.ndarray:
    """
    3-layer bottleneck autoencoder. Reconstruction error > 90th percentile → anomaly.
    Uses PyTorch if available, falls back to PCA reconstruction.
    """
    try:
        import torch
        import torch.nn as nn

        n_feat = X.shape[1]
        bottleneck = max(2, n_feat // 3)

        class AE(nn.Module):
            def __init__(self):
                super().__init__()
                self.enc = nn.Sequential(
                    nn.Linear(n_feat, n_feat * 2), nn.ReLU(),
                    nn.Linear(n_feat * 2, bottleneck),
                )
                self.dec = nn.Sequential(
                    nn.Linear(bottleneck, n_feat * 2), nn.ReLU(),
                    nn.Linear(n_feat * 2, n_feat),
                )
            def forward(self, x):
                return self.dec(self.enc(x))

        X_t = torch.from_numpy(X.astype(np.float32))
        model = AE()
        opt   = torch.optim.Adam(model.parameters(), lr=1e-3)

        model.train()
        for _ in range(80):
            opt.zero_grad()
            loss = nn.functional.mse_loss(model(X_t), X_t)
            loss.backward()
            opt.step()

        model.eval()
        with torch.no_grad():
            recon = model(X_t).numpy()
        errors = np.mean((X - recon) ** 2, axis=1)

    except (ImportError, Exception):
        # PCA fallback
        from sklearn.decomposition import PCA
        n_comp = max(1, X.shape[1] // 3)
        pca    = PCA(n_components=n_comp)
        recon  = pca.inverse_transform(pca.fit_transform(X))
        errors = np.mean((X - recon) ** 2, axis=1)

    threshold = np.percentile(errors, threshold_pct)
    return (errors > threshold).astype(int)


# ── Ensemble ───────────────────────────────────────────────────────────────────
def detect_anomalies(df: pd.DataFrame, contamination: float = 0.08) -> pd.DataFrame:
    """
    Run all 4 detectors and return df with ensemble columns appended.

    Added columns:
      anom_iso, anom_lof, anom_dbscan, anom_ae,
      ensemble_votes, is_hype_anomaly
    """
    print(f"  [AnomalyEnsemble] Running 4-model detection on {len(df):,} startups …")
    X = _prep_features(df, contamination)

    print("    [1/4] Isolation Forest …")
    iso  = _run_isolation_forest(X, contamination)
    print(f"          flagged: {iso.sum():,}")

    print("    [2/4] LOF …")
    lof  = _run_lof(X, contamination)
    print(f"          flagged: {lof.sum():,}")

    print("    [3/4] DBSCAN …")
    dbs  = _run_dbscan(X)
    print(f"          flagged: {dbs.sum():,}")

    print("    [4/4] Autoencoder …")
    ae   = _run_autoencoder(X)
    print(f"          flagged: {ae.sum():,}")

    votes = iso + lof + dbs + ae
    hype  = (votes >= VOTE_THRESHOLD).astype(int)

    print(f"\n  Ensemble results (≥{VOTE_THRESHOLD}/4 required):")
    print(f"    1/4 votes: {(votes == 1).sum():,}")
    print(f"    2/4 votes: {(votes == 2).sum():,}")
    print(f"    3/4 votes: {(votes == 3).sum():,}  ← FLAGGED")
    print(f"    4/4 votes: {(votes == 4).sum():,}  ← FLAGGED")
    print(f"  Total hype anomalies: {hype.sum():,} / {len(df):,}")

    result = df.copy()
    result["anom_iso"]        = iso
    result["anom_lof"]        = lof
    result["anom_dbscan"]     = dbs
    result["anom_ae"]         = ae
    result["ensemble_votes"]  = votes
    result["is_hype_anomaly"] = hype.astype(bool)
    return result


def run_and_save(contamination: float = 0.08, top_n: int = None):
    """Load dataset, run ensemble, save JSON output."""
    data_paths = [
        BASE_DIR / "unified_data" / "knowledge_graph" / "intellistake_master_graph.parquet",
        BASE_DIR / "unified_data" / "cleaned" / "intellistake_startups_clean.json",
    ]

    df = None
    for p in data_paths:
        if p.exists():
            if p.suffix == ".parquet":
                df = pd.read_parquet(p)
            else:
                with open(p) as f:
                    raw = json.load(f)
                if isinstance(raw, dict):
                    raw = raw.get("startups", list(raw.values()))
                df = pd.DataFrame(raw)
            print(f"  Loaded {len(df):,} rows from {p.name}")
            break

    if df is None:
        print("  No dataset found — using synthetic demo data")
        np.random.seed(42)
        n = 500
        df = pd.DataFrame({
            "startup_name":         [f"Startup_{i}" for i in range(n)],
            "trust_score":          np.random.beta(2, 3, n),
            "github_velocity_score":np.random.beta(2, 3, n),
            "annual_revenue_usd":   np.random.lognormal(14, 2, n),
            "employee_count":       np.random.lognormal(4, 1.5, n).astype(int),
            "sentiment_compound":   np.random.uniform(-1, 1, n),
            "total_funding_usd":    np.random.lognormal(16, 2, n),
            "predicted_valuation_usd": np.random.lognormal(18, 2, n),
        })

    if top_n:
        ts_col = "trust_score" if "trust_score" in df.columns else None
        df = df.nlargest(top_n, ts_col) if ts_col else df.head(top_n)

    result_df = detect_anomalies(df, contamination=contamination)

    name_col = next((c for c in ["startup_name", "name", "company_name"] if c in result_df.columns), None)
    records = []
    for _, row in result_df.iterrows():
        records.append({
            "startup_name":    str(row[name_col]) if name_col else f"startup_{_}",
            "trust_score":     round(float(row.get("trust_score", 0.5)), 4),
            "ensemble_votes":  int(row["ensemble_votes"]),
            "is_hype_anomaly": bool(row["is_hype_anomaly"]),
            "detector_votes": {
                "isolation_forest": int(row["anom_iso"]),
                "lof":              int(row["anom_lof"]),
                "dbscan":           int(row["anom_dbscan"]),
                "autoencoder":      int(row["anom_ae"]),
            },
        })

    output = {
        "meta": {
            "generated_at":     datetime.now(timezone.utc).isoformat(),
            "model":            "4-Model Anomaly Ensemble",
            "detectors":        ["IsolationForest", "LOF", "DBSCAN", "Autoencoder"],
            "vote_threshold":   VOTE_THRESHOLD,
            "contamination":    contamination,
            "total_startups":   len(records),
            "hype_anomaly_count": sum(1 for r in records if r["is_hype_anomaly"]),
        },
        "flags": records,
    }

    out = PROD_DIR / "hype_anomaly_flags.json"
    with open(out, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  ✓ Written → {out}")
    return output


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="IntelliStake 4-Model Anomaly Ensemble")
    parser.add_argument("--contamination", type=float, default=0.08)
    parser.add_argument("--top-n", type=int, default=None)
    args = parser.parse_args()
    run_and_save(contamination=args.contamination, top_n=args.top_n)
