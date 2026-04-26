"""
IntelliStake — Real Data Retrain Experiment
============================================
Trains valuation model on ONLY real-labeled startups (37,711 rows)
to measure true predictive R² vs the old ~5k / ~0.2 result.

Run: python engine/retrain_real_data.py
"""

import os, sys, json, warnings, argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED  = BASE_DIR / "unified_data"
CLEANED  = UNIFIED / "cleaned" / "intellistake_startups_clean.json"
OUTPUTS  = UNIFIED / "4_production"
OUTPUTS.mkdir(parents=True, exist_ok=True)

# ── Feature config ───────────────────────────────────────────────────────────
# Use only clean, scalar columns that definitely exist
BASE_FEATURES = [
    "total_funding_usd", "company_age_years", "employees",
]
TARGET_COL = "valuation_usd"


def load_real_data() -> pd.DataFrame:
    """Load only rows with real valuation labels."""
    print("[1/5] Loading startup data ...")
    
    with open(CLEANED, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Data is a list of dicts
    if isinstance(data, list):
        startups = data
    elif isinstance(data, dict):
        startups = data.get("startups", data.get("data", list(data.values())))
    else:
        startups = []
    
    df = pd.DataFrame(startups)
    print(f"  Total loaded: {len(df):,} rows")
    
    # Filter: only real valuation (non-null, non-zero)
    val_series = pd.to_numeric(df[TARGET_COL], errors="coerce")
    df_real = df[(val_series.notna()) & (val_series > 0)].copy()
    print(f"  Real-labeled: {len(df_real):,} rows (with non-null, non-zero valuation)")
    
    return df_real


def engineer_features(df: pd.DataFrame) -> tuple:
    """Map columns and engineer features."""
    col_map = {
        "total_funding": "total_funding_usd",
        "employees": "employees",
    }
    df = df.rename(columns=col_map)
    
    # Ensure all base features exist (fill missing with 0)
    for col in BASE_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    
    # Use available features - convert directly to numeric
    avail = [f for f in BASE_FEATURES if f in df.columns]
    
    X_dict = {}
    for col in avail:
        X_dict[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).values
    
    X = pd.DataFrame(X_dict)
    y = np.log1p(pd.to_numeric(df[TARGET_COL], errors="coerce").fillna(0).values)
    
    print(f"  Features used: {avail}")
    print(f"  X shape: {X.shape} | y shape: {y.shape}")
    
    return X, y, avail


def train_and_evaluate(X, y, feature_names):
    """Train XGBoost + LightGBM ensemble, evaluate on holdout."""
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
    from sklearn.preprocessing import LabelEncoder
    import xgboost as xgb
    import lightgbm as lgb
    
    # 80/20 random split (same as old experiments for comparability)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\n[2/5] Train/test split:")
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")
    
    # ── XGBoost ─────────────────────────────────────────────────────────────
    print("\n[3/5] Training XGBoost ...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=500, max_depth=6, learning_rate=0.03,
        subsample=0.85, colsample_bytree=0.8, min_child_weight=3,
        gamma=0.1, reg_alpha=0.1, reg_lambda=1.5,
        random_state=42, n_jobs=-1, verbosity=0,
        early_stopping_rounds=30,
    )
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    xgb_pred = xgb_model.predict(X_test)
    xgb_r2 = r2_score(y_test, xgb_pred)
    print(f"  XGBoost R² (log-scale): {xgb_r2:.5f}")
    
    # ── LightGBM ───────────────────────────────────────────────────────────
    print("\n[4/5] Training LightGBM ...")
    lgb_model = lgb.LGBMRegressor(
        n_estimators=500, max_depth=6, learning_rate=0.03,
        num_leaves=63, subsample=0.85, colsample_bytree=0.8,
        min_child_samples=20, reg_lambda=1.5,
        random_state=42, n_jobs=-1, verbosity=-1,
    )
    lgb_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(30, verbose=False)],
    )
    lgb_pred = lgb_model.predict(X_test)
    lgb_r2 = r2_score(y_test, lgb_pred)
    print(f"  LightGBM R² (log-scale): {lgb_r2:.5f}")
    
    # ── Ensemble ───────────────────────────────────────────────────────────
    ens_pred = 0.5 * xgb_pred + 0.5 * lgb_pred
    ens_r2 = r2_score(y_test, ens_pred)
    
    # Convert back to original USD scale for interpretable metrics
    y_pred_usd = np.expm1(ens_pred)
    y_true_usd = np.expm1(y_test)
    mae_usd = mean_absolute_error(y_true_usd, y_pred_usd)
    rmse_usd = np.sqrt(mean_squared_error(y_true_usd, y_pred_usd))
    
    # Also compute R² on original USD scale
    ens_r2_usd = r2_score(y_true_usd, y_pred_usd)
    
    print("\n[5/5] Final metrics:")
    print(f"  ╔══════════════════════════════════════════════════════════╗")
    print(f"  ║  XGBoost  R² (log)   = {xgb_r2:.5f}                           ║")
    print(f"  ║  LightGBM R² (log)   = {lgb_r2:.5f}                           ║")
    print(f"  ║  Ensemble R² (log)   = {ens_r2:.5f}                           ║")
    print(f"  ║  Ensemble R² (USD)   = {ens_r2_usd:.5f}  ← compare with old   ║")
    print(f"  ║  Ensemble MAE (USD)   = ${mae_usd:>15,.0f}                 ║")
    print(f"  ║  Ensemble RMSE (USD)  = ${rmse_usd:>14,.0f}                 ║")
    print(f"  ╚══════════════════════════════════════════════════════════╝")
    
    return {
        "xgb_r2_log": xgb_r2,
        "lgb_r2_log": lgb_r2,
        "ens_r2_log": ens_r2,
        "ens_r2_usd": ens_r2_usd,
        "mae_usd": mae_usd,
        "rmse_usd": rmse_usd,
    }


def main():
    print("\n" + "=" * 60)
    print("  IntelliStake — Real Data Retrain Experiment")
    print("  Comparing: ~5k rows (old) vs ~37k rows (new)")
    print("=" * 60 + "\n")
    
    # Load only real-labeled data
    df_real = load_real_data()
    
    # Engineer features
    X, y, features = engineer_features(df_real)
    
    # Train and evaluate
    metrics = train_and_evaluate(X, y, features)
    
    # Save results
    result = {
        "experiment": "real_data_retrain",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": len(X),
        "test_rows": int(len(X) * 0.2),
        "features": features,
        "metrics": {k: round(v, 5) if isinstance(v, float) else v for k, v in metrics.items()},
        "comparison_note": "Old result was ~0.2 R² on ~5k rows. This run uses ~37k real-labeled rows.",
    }
    
    out_path = OUTPUTS / "retrain_real_data_results.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"\n  ✓ Results saved → {out_path}")
    print(f"\n  SUMMARY:")
    print(f"  - Training on {len(X):,} REAL labeled startups")
    print(f"  - Ensemble R² (USD scale): {metrics['ens_r2_usd']:.5f}")
    print(f"  - Previous (5k rows): ~0.2 R²")
    print(f"  - Improvement: {'YES' if metrics['ens_r2_usd'] > 0.2 else 'NO'} (+{metrics['ens_r2_usd']-0.2:.3f})")
    
    return result


if __name__ == "__main__":
    main()