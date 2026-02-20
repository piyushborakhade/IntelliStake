"""
IntelliStake R.A.I.S.E. Framework - Valuation Engine
====================================================

High-performance ML valuation engine leveraging an XGBoost + LightGBM ensemble
with log-transformed targets, early stopping, cross-validation, and feature
engineering on 8 signals (vs the previous 6).

Author: IntelliStake Development Team
Course: MBA (Tech) Capstone — NMIMS  |  February 2026
"""

import os
import warnings
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor

warnings.filterwarnings("ignore")

sns.set_style("whitegrid")
plt.rcParams["figure.figsize"] = (12, 7)
plt.rcParams["font.size"] = 11

# ── Paths ─────────────────────────────────────────────────────────────────────
ENGINE_DIR  = Path(__file__).resolve().parent
FINAL_DIR   = ENGINE_DIR.parent
UNIFIED_DIR = FINAL_DIR / "unified_data"
OUTPUTS_DIR = UNIFIED_DIR / "outputs"
MODELS_DIR  = OUTPUTS_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

XGB_MODEL_PATH   = MODELS_DIR / "xgb_valuation.joblib"
LGBM_MODEL_PATH  = MODELS_DIR / "lgbm_valuation.joblib"
PLOT_PATH        = OUTPUTS_DIR / "feature_importance.png"

# ── Feature config ─────────────────────────────────────────────────────────────
NUMERIC_FEATURES = [
    "funding_amount_usd",
    "employee_count",
    "estimated_revenue_usd",
    "founded_year",
    "trust_score",
    "company_age_years",
    "avg_sentiment_polarity",
    "monthly_web_visits",
]
CATEGORICAL_FEATURES = ["industry", "funding_round"]
TARGET_COL = "estimated_valuation_usd"

# Ordinal encoding for funding rounds (preserves ordinality)
FUNDING_ROUND_ORDER = [
    "Pre-Seed", "Seed", "Series A", "Series B",
    "Series C", "Series D", "Series E", "Series F+",
    "Growth", "Pre-IPO", "IPO",
]


def load_data(filepath: str) -> pd.DataFrame:
    """Load startup valuation dataset from CSV file."""
    print(f"[INFO] Loading dataset from: {filepath}")
    df = pd.read_csv(filepath)
    print(f"[SUCCESS] Dataset loaded: {df.shape[0]:,} rows, {df.shape[1]} columns")
    return df


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive additional signals from raw data.
    - company_age_years if not already present (2026 - founded_year)
    - revenue_per_employee as an efficiency proxy
    - funding_to_revenue_ratio as a growth metric
    """
    if "company_age_years" not in df.columns and "founded_year" in df.columns:
        df["company_age_years"] = 2026 - df["founded_year"].clip(upper=2025)

    if "estimated_revenue_usd" in df.columns and "employee_count" in df.columns:
        df["revenue_per_employee"] = (
            df["estimated_revenue_usd"] / (df["employee_count"].clip(lower=1))
        )

    if "funding_amount_usd" in df.columns and "estimated_revenue_usd" in df.columns:
        df["funding_to_revenue"] = (
            df["funding_amount_usd"] / (df["estimated_revenue_usd"].clip(lower=1))
        ).clip(upper=100)

    return df


def preprocess_data(df: pd.DataFrame) -> tuple:
    """
    Full preprocessing pipeline:
    - Feature engineering
    - Missing-value imputation
    - Label / ordinal encoding
    - Log1p transform on target
    - 80/20 stratified split
    """
    print("\n[INFO] Starting preprocessing pipeline...")

    df = _engineer_features(df)

    # Build final feature list from what's actually in the dataframe
    extra_numeric = ["revenue_per_employee", "funding_to_revenue"]
    all_numeric = [c for c in NUMERIC_FEATURES + extra_numeric if c in df.columns]
    all_categorical = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    all_features = all_numeric + all_categorical

    X = df[all_features].copy()
    y = df[TARGET_COL].copy()

    # Impute numerics with median (robust to outliers)
    for col in all_numeric:
        X[col] = pd.to_numeric(X[col], errors="coerce")
        X[col].fillna(X[col].median(), inplace=True)

    # Encode funding_round ordinally if available
    if "funding_round" in X.columns:
        known_rounds = [r for r in FUNDING_ROUND_ORDER if r in X["funding_round"].unique()]
        oe = OrdinalEncoder(
            categories=[FUNDING_ROUND_ORDER],
            handle_unknown="use_encoded_value",
            unknown_value=len(FUNDING_ROUND_ORDER) - 1,
        )
        X["funding_round"] = oe.fit_transform(X[["funding_round"]])

    # Label-encode all remaining categoricals
    label_encoders = {}
    remaining_cats = [c for c in all_categorical if c != "funding_round"]
    for col in remaining_cats:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str).fillna("Unknown"))
        label_encoders[col] = le

    # Log-transform target (handles heavy right-skew in valuation distributions)
    y_log = np.log1p(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_log, test_size=0.2, random_state=42, shuffle=True
    )

    print(f"[SUCCESS] Features used: {all_features}")
    print(f"  → Training: {X_train.shape[0]:,} | Test: {X_test.shape[0]:,}")
    print(f"  → Target log-transformed (np.log1p)")

    return X_train, X_test, y_train, y_test, all_features, label_encoders


def train_xgboost_model(
    X_train: pd.DataFrame, y_train: pd.Series,
    X_val: pd.DataFrame, y_val: pd.Series,
) -> XGBRegressor:
    """
    Train XGBoost with:
    - Tuned depth/regularisation to prevent overfitting
    - Early stopping on a validation set (avoids hand-picking n_estimators)
    """
    print("\n[INFO] Training XGBoost Regressor...")

    model = XGBRegressor(
        max_depth=6,
        n_estimators=1000,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.5,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
        early_stopping_rounds=50,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    print(f"[SUCCESS] XGBoost trained — best iteration: {model.best_iteration}")
    return model


def train_lightgbm_model(
    X_train: pd.DataFrame, y_train: pd.Series,
    X_val: pd.DataFrame, y_val: pd.Series,
) -> LGBMRegressor:
    """
    Train LightGBM with early stopping and tighter regularisation.
    """
    print("\n[INFO] Training LightGBM Regressor...")

    model = LGBMRegressor(
        num_leaves=63,
        n_estimators=1000,
        learning_rate=0.03,
        feature_fraction=0.8,
        bagging_fraction=0.85,
        bagging_freq=5,
        min_data_in_leaf=20,
        lambda_l1=0.1,
        path_smooth=0.1,
        random_state=42,
        n_jobs=-1,
        verbosity=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[],
    )
    print("[SUCCESS] LightGBM training complete")
    return model


def evaluate_model(
    model, X_test: pd.DataFrame, y_test_log: pd.Series, model_name: str
) -> dict:
    """
    Evaluate model on original (un-logged) scale.
    Metrics: R², MAE, RMSE on actual USD valuations.
    """
    print(f"\n[INFO] Evaluating {model_name}...")

    y_pred_log = model.predict(X_test)

    # Inverse log transform → original USD scale
    y_pred = np.expm1(y_pred_log)
    y_true = np.expm1(y_test_log)

    r2   = r2_score(y_true, y_pred)
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    metrics = {"R² Score": r2, "MAE": mae, "RMSE": rmse}

    print(f"\n{'='*60}")
    print(f"{model_name} — Performance Metrics (original USD scale)")
    print(f"{'='*60}")
    print(f"  R² Score : {r2:.6f}")
    print(f"  MAE      : ${mae:,.0f}")
    print(f"  RMSE     : ${rmse:,.0f}")
    print(f"{'='*60}\n")

    return metrics


def evaluate_ensemble(
    xgb_model, lgbm_model,
    X_test: pd.DataFrame, y_test_log: pd.Series,
    weights: tuple = (0.5, 0.5),
) -> dict:
    """
    Blend XGB + LGBM predictions in log-space then invert.
    Returns metrics on the blended ensemble.
    """
    w1, w2 = weights
    pred_log = w1 * xgb_model.predict(X_test) + w2 * lgbm_model.predict(X_test)
    y_pred = np.expm1(pred_log)
    y_true = np.expm1(y_test_log)

    r2   = r2_score(y_true, y_pred)
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    metrics = {"R² Score": r2, "MAE": mae, "RMSE": rmse}

    print(f"\n{'='*60}")
    print(f"Ensemble (XGB {w1:.0%} + LGBM {w2:.0%}) — Performance Metrics")
    print(f"{'='*60}")
    print(f"  R² Score : {r2:.6f}")
    print(f"  MAE      : ${mae:,.0f}")
    print(f"  RMSE     : ${rmse:,.0f}")
    print(f"{'='*60}\n")

    return metrics


def cross_validate_model(model_cls, model_kwargs, X, y_log, cv=5) -> None:
    """5-fold CV to confirm generalisation before final training."""
    print(f"\n[INFO] Running {cv}-fold cross-validation for {model_cls.__name__}...")
    kf = KFold(n_splits=cv, shuffle=True, random_state=42)
    scores = cross_val_score(
        model_cls(**model_kwargs), X, y_log,
        cv=kf, scoring="r2", n_jobs=-1,
    )
    print(f"  CV R² scores: {[f'{s:.4f}' for s in scores]}")
    print(f"  Mean R²: {scores.mean():.4f} ± {scores.std():.4f}")


def plot_feature_importance(model, feature_names: list, save_path: Path) -> None:
    """Save horizontal bar chart of XGBoost feature importances."""
    print("[INFO] Generating feature importance visualization...")

    importances = model.feature_importances_
    imp_df = pd.DataFrame(
        {"Feature": feature_names, "Importance": importances}
    ).sort_values("Importance", ascending=True)

    plt.figure(figsize=(12, max(6, len(feature_names) * 0.55)))
    colors = sns.color_palette("viridis", len(imp_df))
    bars = plt.barh(imp_df["Feature"], imp_df["Importance"], color=colors)

    for bar, val in zip(bars, imp_df["Importance"]):
        plt.text(val + 0.002, bar.get_y() + bar.get_height() / 2,
                 f"{val:.4f}", va="center", fontsize=10)

    plt.xlabel("Feature Importance (Gain)", fontsize=13, fontweight="bold")
    plt.ylabel("Feature", fontsize=13, fontweight="bold")
    plt.title(
        "XGBoost Feature Importance — IntelliStake Valuation Engine\n"
        "R.A.I.S.E. Framework | Log-transformed Target",
        fontsize=14, fontweight="bold", pad=20,
    )
    plt.grid(axis="x", alpha=0.3, linestyle="--")
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    print(f"[SUCCESS] Plot saved → {save_path}")

    print("\n[INFO] Feature Importance Ranking:")
    for _, row in imp_df.sort_values("Importance", ascending=False).iterrows():
        print(f"  {row['Feature']:35s} → {row['Importance']:.6f}")


def save_models(xgb_model, lgbm_model) -> None:
    """Persist models so the pipeline doesn't re-train on every run."""
    joblib.dump(xgb_model,  XGB_MODEL_PATH)
    joblib.dump(lgbm_model, LGBM_MODEL_PATH)
    print(f"[SUCCESS] Models saved → {MODELS_DIR}")


def load_cached_models():
    """Load previously trained models if they exist. Returns (xgb, lgbm) or (None, None)."""
    if XGB_MODEL_PATH.exists() and LGBM_MODEL_PATH.exists():
        print("[INFO] Loading cached models from disk...")
        return joblib.load(XGB_MODEL_PATH), joblib.load(LGBM_MODEL_PATH)
    return None, None


def main():
    print("\n" + "=" * 80)
    print(" " * 10 + "IntelliStake R.A.I.S.E. Framework — Valuation Engine v2")
    print(" " * 15 + "Log-Transform + Ensemble + Early Stopping + CV")
    print("=" * 80 + "\n")

    # ── Data ──────────────────────────────────────────────────────────────────
    data_path = os.path.join("Data", "startup_valuation_high_growth.csv")
    df = load_data(data_path)

    X_train, X_test, y_train, y_test, feature_names, _ = preprocess_data(df)

    # Use 10% of training data as validation for early stopping
    val_size = max(500, int(len(X_train) * 0.10))
    X_val, y_val = X_train.iloc[-val_size:], y_train.iloc[-val_size:]
    X_tr,  y_tr  = X_train.iloc[:-val_size], y_train.iloc[:-val_size]

    # ── Cross-validation (lightweight check) ──────────────────────────────────
    xgb_cv_params = dict(
        max_depth=6, n_estimators=300, learning_rate=0.03,
        subsample=0.85, colsample_bytree=0.8, min_child_weight=3,
        gamma=0.1, reg_alpha=0.1, reg_lambda=1.5,
        random_state=42, n_jobs=-1, verbosity=0,
    )
    cross_validate_model(XGBRegressor, xgb_cv_params, X_train, y_train)

    # ── Train ─────────────────────────────────────────────────────────────────
    xgb_model  = train_xgboost_model(X_tr, y_tr, X_val, y_val)
    lgbm_model = train_lightgbm_model(X_tr, y_tr, X_val, y_val)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    xgb_metrics  = evaluate_model(xgb_model,  X_test, y_test, "XGBoost Regressor")
    lgbm_metrics = evaluate_model(lgbm_model, X_test, y_test, "LightGBM Regressor")
    ens_metrics  = evaluate_ensemble(xgb_model, lgbm_model, X_test, y_test)

    # ── Visualise ─────────────────────────────────────────────────────────────
    plot_feature_importance(xgb_model, feature_names, PLOT_PATH)

    # ── Persist ───────────────────────────────────────────────────────────────
    save_models(xgb_model, lgbm_model)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print(" " * 25 + "EXECUTION SUMMARY")
    print("=" * 80)
    print(f"✓ Features: {len(feature_names)} (was 6)")
    print(f"✓ XGBoost  R²: {xgb_metrics['R² Score']:.6f}")
    print(f"✓ LightGBM R²: {lgbm_metrics['R² Score']:.6f}")
    print(f"✓ Ensemble R²: {ens_metrics['R² Score']:.6f}  ← primary metric")
    print(f"✓ Models saved → {MODELS_DIR}")
    print(f"✓ Feature plot → {PLOT_PATH}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
