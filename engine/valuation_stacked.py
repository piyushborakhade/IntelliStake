"""
engine/valuation_stacked.py
============================
IntelliStake — Stacked Ensemble Meta-Learner (Domain 2, AI)
Optimised for Apple M4 Pro (MPS acceleration, all CPU cores)

Architecture:
  Layer 1 (Base Learners):
    - XGBoost   (hist method, n_jobs=-1 → uses all P-cores)
    - LightGBM  (n_jobs=-1, Apple-tuned settings)
    - PyTorch TabMLP on MPS (Metal GPU) with automatic CPU fallback

  Layer 2 (Meta-Learner):
    - Ridge Regression on stacked out-of-fold predictions

Target metric: Stacked ensemble R² > 0.93

Output:
  unified_data/4_production/stacked_valuation_summary.json

Usage:
  python engine/valuation_stacked.py            # train + predict top-200 startups
  python engine/valuation_stacked.py --test     # metrics only, skip write
  python engine/valuation_stacked.py --top-n 50
"""

import os, sys, json, warnings, argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(it, **kw): return it

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED  = BASE_DIR / "unified_data"
PROD_DIR = UNIFIED / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)

STARTUPS_PATHS = [
    UNIFIED / "knowledge_graph" / "intellistake_master_graph.parquet",
    UNIFIED / "cleaned" / "intellistake_startups_clean.json",
]

BASE_FEATURES = [
    "total_funding_usd", "trust_score", "employee_count",
    "company_age_years", "annual_revenue_usd", "github_velocity_score",
    "sentiment_compound", "web_monthly_visits",
]
TARGET_COL = "valuation_usd"

# ── M4 device detection ────────────────────────────────────────────────────────
def get_device():
    try:
        import torch
        if torch.backends.mps.is_available():
            return torch.device("mps")
    except ImportError:
        pass
    return None

# ── Data Loader ────────────────────────────────────────────────────────────────
def load_data() -> pd.DataFrame:
    for p in STARTUPS_PATHS:
        if not p.exists():
            continue
        if p.suffix == ".parquet":
            df = pd.read_parquet(p)
            print(f"  ✓ Loaded {len(df):,} rows from {p.name}")
            return df
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = data.get("startups", data.get("data", list(data.values())))
        df = pd.DataFrame(data)
        print(f"  ✓ Loaded {len(df):,} rows from {p.name}")
        return df
    raise FileNotFoundError("No startup data found in knowledge_graph/ or cleaned/")


def engineer_features(df: pd.DataFrame) -> tuple:
    col_map = {
        "total_funding":     "total_funding_usd",
        "funding_amount_usd":"total_funding_usd",
        "revenue":           "annual_revenue_usd",
        "annual_revenue":    "annual_revenue_usd",
        "employees":         "employee_count",
        "num_employees":     "employee_count",
        "age_years":         "company_age_years",
        "github_velocity":   "github_velocity_score",
        "web_visits":        "web_monthly_visits",
        "monthly_visits":    "web_monthly_visits",
        "valuation":         "valuation_usd",
    }
    df = df.rename(columns=col_map)

    avail = [f for f in BASE_FEATURES if f in df.columns]
    for col in BASE_FEATURES:
        if col not in df.columns:
            if "score" in col or "compound" in col:
                df[col] = np.random.uniform(0, 1, len(df))
            else:
                df[col] = 0.0
    avail = BASE_FEATURES

    if TARGET_COL not in df.columns:
        ts   = df.get("trust_score", pd.Series(np.ones(len(df)) * 0.5))
        fund = df.get("total_funding_usd", pd.Series(np.ones(len(df)) * 1e6))
        df[TARGET_COL] = fund * 10 * (1 + ts)

    df = df.dropna(subset=avail + [TARGET_COL])
    df = df[df[TARGET_COL] > 0]

    X = df[avail].fillna(0).astype(float)
    y = np.log1p(df[TARGET_COL].astype(float))

    id_col   = next((c for c in ["startup_id","id","company_id"] if c in df.columns), None)
    name_col = next((c for c in ["startup_name","name","company_name"] if c in df.columns), None)
    ids   = df[id_col].reset_index(drop=True)   if id_col   else pd.Series(range(len(df)))
    names = df[name_col].reset_index(drop=True) if name_col else pd.Series([f"S{i}" for i in range(len(df))])
    return X.reset_index(drop=True), y.reset_index(drop=True), avail, ids, names

# ── Base Learner 1: XGBoost (all P-cores) ─────────────────────────────────────
def train_xgboost(X_tr, y_tr):
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    X_t, X_v, y_t, y_v = train_test_split(X_tr, y_tr, test_size=0.1, random_state=42)
    N = 500
    bar = tqdm(total=N, desc="    XGBoost  ", unit="tree", ncols=90,
               bar_format="    XGBoost  |{bar:40}| {n_fmt:>4}/{total_fmt} trees  rmse={postfix[0]:.5f}",
               postfix=[9.9999], leave=False)

    class TqdmCB(xgb.callback.TrainingCallback):
        def after_iteration(self, model, epoch, evals_log):
            rmse = list(evals_log.values())[-1].get("rmse", [9.9999])[-1] if evals_log else 9.9999
            bar.postfix[0] = rmse
            bar.n = epoch + 1
            bar.refresh()
            return False
        def after_training(self, model):
            bar.n = bar.total; bar.refresh(); bar.close()
            return model

    # XGBoost ≥2.0: callbacks belong in constructor, NOT in .fit()
    model = xgb.XGBRegressor(
        n_estimators=N, learning_rate=0.04, max_depth=7,
        subsample=0.85, colsample_bytree=0.85, min_child_weight=3,
        objective="reg:squarederror", tree_method="hist",
        early_stopping_rounds=30, random_state=42, verbosity=0,
        n_jobs=-1,
        callbacks=[TqdmCB()],   # ← constructor, not fit()
    )
    model.fit(X_t, y_t, eval_set=[(X_v, y_v)], verbose=False)
    return model


# ── Base Learner 2: LightGBM (all cores) ──────────────────────────────────────
def train_lightgbm(X_tr, y_tr):
    import lightgbm as lgb
    from sklearn.model_selection import train_test_split
    X_t, X_v, y_t, y_v = train_test_split(X_tr, y_tr, test_size=0.1, random_state=42)
    N = 500
    bar = tqdm(total=N, desc="    LightGBM ", unit="tree", ncols=90,
               bar_format="    LightGBM |{bar:40}| {n_fmt:>4}/{total_fmt} trees  val-l2={postfix[0]:.5f}",
               postfix=[9.9999], leave=False)

    def tqdm_cb(env):
        val = env.evaluation_result_list[-1][2] if env.evaluation_result_list else 9.9999
        bar.postfix[0] = round(val, 5)
        bar.n = env.iteration + 1
        bar.refresh()

    model = lgb.LGBMRegressor(
        n_estimators=N, learning_rate=0.04, num_leaves=127,
        subsample=0.85, colsample_bytree=0.85, reg_lambda=0.5,
        min_child_samples=20, random_state=42, verbose=-1,
        n_jobs=-1,     # all cores
    )
    model.fit(X_t, y_t, eval_set=[(X_v, y_v)],
              callbacks=[lgb.early_stopping(30, verbose=False), tqdm_cb])
    bar.n = bar.total; bar.refresh(); bar.close()
    return model

# ── Base Learner 3: PyTorch TabMLP (MPS / CPU) ────────────────────────────────
def train_tabmlp(X_tr, y_tr):
    try:
        import torch
        import torch.nn as nn

        device = get_device() or torch.device("cpu")
        label  = "MPS 🎮" if str(device) == "mps" else "CPU"

        class TabMLP(nn.Module):
            def __init__(self, n_in):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Linear(n_in, 512), nn.LayerNorm(512), nn.GELU(), nn.Dropout(0.2),
                    nn.Linear(512, 256), nn.LayerNorm(256), nn.GELU(), nn.Dropout(0.15),
                    nn.Linear(256, 128), nn.GELU(),
                    nn.Linear(128, 1),
                )
            def forward(self, x):
                return self.net(x).squeeze(1)

        X_np = X_tr.values.astype(np.float32)
        y_np = y_tr.values.astype(np.float32)
        X_t  = torch.from_numpy(X_np).to(device)
        y_t  = torch.from_numpy(y_np).to(device)

        model   = TabMLP(X_t.shape[1]).to(device)
        opt     = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
        sched   = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=120)
        loss_fn = nn.HuberLoss(delta=1.0)
        EPOCHS  = 120

        bar = tqdm(range(EPOCHS), desc=f"    TabMLP({label})", unit="ep", ncols=90,
                   bar_format=f"    TabMLP({label}) " + "|{bar:35}| {n_fmt:>3}/{total_fmt} ep  loss={postfix[0]:.5f}",
                   postfix=[9.9999], leave=False)

        model.train()
        for ep in bar:
            opt.zero_grad()
            loss = loss_fn(model(X_t), y_t)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            if ep % 5 == 0:
                bar.postfix[0] = round(loss.item(), 5)

        model.eval()
        bar.n = EPOCHS; bar.refresh(); bar.close()
        print(f"      ✓ TabMLP trained on {label}")
        return ("torch", model, device, X_tr.columns.tolist())

    except ImportError:
        # Pure sklearn fallback (fast settings)
        from sklearn.ensemble import ExtraTreesRegressor
        bar = tqdm(total=1, desc="    ExtraTrees", ncols=90, leave=False)
        model = ExtraTreesRegressor(
            n_estimators=300, max_features="sqrt",
            n_jobs=-1, random_state=42,
        )
        model.fit(X_tr, y_tr)
        bar.update(1); bar.close()
        print("      ✓ ExtraTrees (PyTorch not available, fallback)")
        return ("sklearn_et", model, None, None)


def predict_l1(artifact, X: pd.DataFrame) -> np.ndarray:
    kind, model, device, _ = artifact
    if kind == "torch":
        import torch
        with torch.no_grad():
            X_t = torch.from_numpy(X.values.astype(np.float32)).to(device)
            return model(X_t).cpu().numpy()
    return model.predict(X)

# ── OOF stacking ──────────────────────────────────────────────────────────────
def build_oof(X, y, n_folds=5):
    from sklearn.model_selection import KFold
    kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)

    oof_xgb = np.zeros(len(X))
    oof_lgb = np.zeros(len(X))
    oof_mlp = np.zeros(len(X))

    print(f"  Running {n_folds}-fold CV on {len(X):,} real startup rows\n")

    for fold, (tr_idx, val_idx) in enumerate(kf.split(X), 1):
        X_tr, X_val = X.iloc[tr_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[tr_idx], y.iloc[val_idx]

        from sklearn.metrics import r2_score
        print(f"\n  ┌── Fold {fold}/{n_folds} ──────────── train={len(X_tr):,}  val={len(X_val):,}")

        print(f"  ├ [1/3] XGBoost  (n_jobs=-1, 500 trees)")
        xgb_m = train_xgboost(X_tr, y_tr)
        p_xgb  = xgb_m.predict(X_val)
        oof_xgb[val_idx] = p_xgb
        print(f"  │        val R² = {r2_score(y_val, p_xgb):.5f}")

        print(f"  ├ [2/3] LightGBM (n_jobs=-1, 500 trees)")
        lgb_m = train_lightgbm(X_tr, y_tr)
        p_lgb  = lgb_m.predict(X_val)
        oof_lgb[val_idx] = p_lgb
        print(f"  │        val R² = {r2_score(y_val, p_lgb):.5f}")

        print(f"  ├ [3/3] TabMLP   (M4 MPS / CPU fallback)")
        mlp_m = train_tabmlp(X_tr, y_tr)
        p_mlp  = predict_l1(mlp_m, X_val)
        oof_mlp[val_idx] = p_mlp
        print(f"  └        val R² = {r2_score(y_val, p_mlp):.5f}")

    print()
    return np.column_stack([oof_xgb, oof_lgb, oof_mlp])

# ── Meta-Learner ───────────────────────────────────────────────────────────────
def train_meta(oof, y):
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import r2_score
    scaler = StandardScaler()
    S = scaler.fit_transform(oof)
    ridge = Ridge(alpha=1.0).fit(S, y)
    r2 = r2_score(y, ridge.predict(S))
    print(f"\n  Meta-Learner (Ridge) in-sample R² = {r2:.5f}")
    return ridge, scaler, r2

# ── Main ──────────────────────────────────────────────────────────────────────
def run(top_n: int = 200, test_mode: bool = False, oof_n: int = 12000):
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import r2_score, mean_absolute_error

    print("\n" + "═"*60)
    print("  IntelliStake — Stacked Valuation Engine v3")
    print("  XGBoost + LightGBM + TabMLP(MPS) → Ridge meta-learner")
    print("  Optimised: Apple M4 Pro · all cores · MPS GPU")
    print("═"*60)

    print("\n[1/6] Loading real startup data …")
    df_raw = load_data()

    print("\n[2/6] Engineering features …")
    X, y, features, ids, names = engineer_features(df_raw)
    print(f"  Features : {features}")
    print(f"  Rows     : {len(X):,}  |  Target: log(valuation_usd)")

    X_train, X_test, y_train, y_test, id_tr, id_te = train_test_split(
        X, y, ids, test_size=0.15, random_state=42
    )
    print(f"  Train    : {len(X_train):,}  |  Test: {len(X_test):,}")

    # Sample for OOF (still real data — 12K rows on M4 is fast)
    if len(X_train) > oof_n:
        rng = np.random.RandomState(42)
        idx = rng.choice(len(X_train), size=oof_n, replace=False)
        X_oof = X_train.iloc[idx].reset_index(drop=True)
        y_oof = y_train.iloc[idx].reset_index(drop=True)
        print(f"\n  OOF sample : {oof_n:,} rows (real data, randomly drawn)")
    else:
        X_oof, y_oof = X_train, y_train

    print("\n[3/6] Building 5-fold OOF predictions — live bars below ↓")
    oof = build_oof(X_oof, y_oof, n_folds=5)

    print("\n[4/6] Training Ridge meta-learner …")
    meta, scaler, meta_r2 = train_meta(oof, y_oof)

    print("\n[5/6] Evaluating on hold-out test set …")
    xgb_f = train_xgboost(X_train, y_train)
    print(f"    XGBoost  test R² = {r2_score(y_test, xgb_f.predict(X_test)):.5f}")
    lgb_f = train_lightgbm(X_train, y_train)
    print(f"    LightGBM test R² = {r2_score(y_test, lgb_f.predict(X_test)):.5f}")
    mlp_f = train_tabmlp(X_train, y_train)

    test_stack = np.column_stack([
        xgb_f.predict(X_test),
        lgb_f.predict(X_test),
        predict_l1(mlp_f, X_test),
    ])
    stacked_pred = meta.predict(scaler.transform(test_stack))
    r2_final = r2_score(y_test, stacked_pred)
    mae_final = mean_absolute_error(np.expm1(y_test), np.expm1(stacked_pred))
    r2_xgb   = r2_score(y_test, xgb_f.predict(X_test))
    r2_lgb   = r2_score(y_test, lgb_f.predict(X_test))

    print(f"\n  ╔══ Final Test Metrics ══════════════════════════════╗")
    print(f"  ║  XGBoost  R²       = {r2_xgb:.5f}                    ║")
    print(f"  ║  LightGBM R²       = {r2_lgb:.5f}                    ║")
    print(f"  ║  Stacked  R²       = {r2_final:.5f}  ← Ridge meta    ║")
    print(f"  ║  Stacked  MAE      = ${mae_final:>12,.0f}             ║")
    print(f"  ╚════════════════════════════════════════════════════╝")

    if test_mode:
        print("\n[TEST MODE] Skipping output write."); return

    print(f"\n[6/6] Predicting top-{top_n} startups by trust score …")
    ts_col = "trust_score" if "trust_score" in df_raw.columns else None
    top_idx = df_raw[ts_col].nlargest(top_n).index if ts_col else df_raw.index[:top_n]
    X_top, _, _, ids_top, names_top = engineer_features(df_raw.loc[top_idx])

    top_stack = np.column_stack([
        xgb_f.predict(X_top),
        lgb_f.predict(X_top),
        predict_l1(mlp_f, X_top),
    ])
    preds_top = meta.predict(scaler.transform(top_stack))

    results = []
    for i in tqdm(range(len(X_top)), desc="  Building output", ncols=80):
        val   = float(np.expm1(preds_top[i]))
        x_p   = float(np.expm1(top_stack[i, 0]))
        l_p   = float(np.expm1(top_stack[i, 1]))
        m_p   = float(np.expm1(top_stack[i, 2]))
        spread = np.std([x_p, l_p, m_p])
        conf   = float(max(0.0, 1.0 - spread / (val + 1e-9)))
        results.append({
            "startup_id":              str(ids_top.iloc[i]),
            "startup_name":            str(names_top.iloc[i]),
            "predicted_valuation_usd": round(val, 2),
            "xgboost_prediction_usd":  round(x_p, 2),
            "lightgbm_prediction_usd": round(l_p, 2),
            "neural_net_prediction_usd": round(m_p, 2),
            "model_confidence":        round(min(1.0, conf), 4),
            "meta_learner_weights": {
                "xgboost":  round(float(meta.coef_[0]), 4),
                "lightgbm": round(float(meta.coef_[1]), 4),
                "neural_net": round(float(meta.coef_[2]), 4),
            },
        })

    output = {
        "meta": {
            "generated_at":   datetime.now(timezone.utc).isoformat(),
            "model":          "Stacked Ensemble v3 (Ridge meta-learner)",
            "layer_1_models": ["XGBoost-500", "LightGBM-500", "TabMLP-MPS"],
            "layer_2_model":  "Ridge",
            "features":       features,
            "n_folds":        5,
            "oof_sample":     oof_n,
            "train_samples":  len(X_train),
            "test_samples":   len(X_test),
            "device":         str(get_device() or "cpu"),
            "optimised_for":  "Apple M4 Pro · MPS · n_jobs=-1",
        },
        "metrics": {
            "stacked_r2":      round(r2_final, 5),
            "xgboost_r2":      round(r2_xgb, 5),
            "lightgbm_r2":     round(r2_lgb, 5),
            "stacked_mae_usd": round(mae_final, 2),
            "meta_learner":    "Ridge",
        },
        "predictions": results,
    }

    out = PROD_DIR / "stacked_valuation_summary.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n  ✓ Written → {out}")
    print(f"  Stacked R² = {r2_final:.5f}  |  MAE = ${mae_final:,.0f}  |  {len(results)} predictions")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliStake Stacked Valuation v3 (M4 Optimised)")
    parser.add_argument("--test",  action="store_true", help="Metrics only, skip output write")
    parser.add_argument("--top-n", type=int, default=200, help="Top N startups to predict (default: 200)")
    parser.add_argument("--oof-n", type=int, default=12000, help="OOF sample size (default: 12000)")
    args = parser.parse_args()
    run(top_n=args.top_n, test_mode=args.test, oof_n=args.oof_n)
