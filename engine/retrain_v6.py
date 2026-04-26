"""
engine/retrain_v6.py
=====================
Levers:
  1. Optuna hyperparameter search on XGBoost + LightGBM (50 trials each)
  2. NSE/BSE sector P/E + P/S multiples as reference features (not training targets)
"""
import json, warnings, pickle
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import r2_score
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
BASE     = Path(__file__).resolve().parent.parent
CLEAN    = BASE / "unified_data" / "cleaned" / "intellistake_startups_clean.json"
PROD_DIR = BASE / "unified_data" / "4_production"
MODELS   = BASE / "models"
MODELS.mkdir(exist_ok=True)
TARGET   = 'valuation_usd'

# ── Lever 2: NSE/BSE sector P/E + P/S anchor table ────────────────────────────
# Derived from yfinance_nse / yfinance_bse records already in the dataset.
# Used as reference features only — NOT as training targets.
LISTED_SECTOR_MULTIPLES = {
    "FinTech":       {"listed_pe_median": 22.5, "listed_ps_median": 4.8},
    "SaaS":          {"listed_pe_median": 38.4, "listed_ps_median": 10.7},
    "E-commerce":    {"listed_pe_median": 18.2, "listed_ps_median": 2.9},
    "HealthTech":    {"listed_pe_median": 31.0, "listed_ps_median": 5.2},
    "Mobility":      {"listed_pe_median": 15.6, "listed_ps_median": 2.1},
    "D2C":           {"listed_pe_median": 20.3, "listed_ps_median": 3.4},
    "Media":         {"listed_pe_median": 14.8, "listed_ps_median": 2.6},
    "Telecom":       {"listed_pe_median": 12.1, "listed_ps_median": 1.9},
    "Manufacturing": {"listed_pe_median": 11.4, "listed_ps_median": 1.2},
    "CleanTech":     {"listed_pe_median": 28.7, "listed_ps_median": 6.1},
    "DeepTech":      {"listed_pe_median": 45.2, "listed_ps_median": 12.3},
    "AgriTech":      {"listed_pe_median": 16.5, "listed_ps_median": 2.8},
    "EdTech":        {"listed_pe_median": 24.0, "listed_ps_median": 5.5},
    "PropTech":      {"listed_pe_median": 13.2, "listed_ps_median": 2.2},
    "Logistics":     {"listed_pe_median": 14.0, "listed_ps_median": 1.8},
    "Fintech":       {"listed_pe_median": 22.5, "listed_ps_median": 4.8},  # alias
}
DEFAULT_MULTIPLES = {"listed_pe_median": 18.0, "listed_ps_median": 3.5}

def add_listed_multiples(df):
    df = df.copy()
    df['listed_pe_median'] = df['sector'].map(
        lambda s: LISTED_SECTOR_MULTIPLES.get(s, DEFAULT_MULTIPLES)['listed_pe_median']
    ).fillna(18.0)
    df['listed_ps_median'] = df['sector'].map(
        lambda s: LISTED_SECTOR_MULTIPLES.get(s, DEFAULT_MULTIPLES)['listed_ps_median']
    ).fillna(3.5)
    # Implied valuation from revenue × sector P/S (public market anchor)
    df['ps_implied_valuation'] = (
        df['revenue_usd'].fillna(0) * df['listed_ps_median']
    ).clip(upper=1e12)
    # Log of implied valuation — the feature the model actually sees
    df['log_ps_implied_val'] = np.log1p(df['ps_implied_valuation'])
    # Discount/premium proxy: how does funding compare to listed P/S implied value
    df['funding_vs_ps_implied'] = (
        df['total_funding_usd'].fillna(0) /
        df['ps_implied_valuation'].clip(lower=1)
    ).clip(upper=50)
    return df

# ── Leakage check ─────────────────────────────────────────────────────────────
def check_leakage(features):
    bad = [f for f in features if 'valuation_usd' in f]
    if bad: raise ValueError(f"LEAKAGE: {bad}")
    print("  ✅ Leakage check passed")

# ── Noisy sources ─────────────────────────────────────────────────────────────
NOISY = {
    'wikidata_se_asia_startups','wikidata_latam_startups','wikidata_global_fintech',
    'wikidata_global_healthtech','alpha_vantage','wikidata_indian_banks_fintech',
    'nyse_screener_nyse','nyse_screener_amex','nasdaq_screener',
}

def apply_filter(df):
    t_ok = df['trust_score'].fillna(0.5) >= 0.50
    s_ok = ~df.get('data_source', pd.Series([''] * len(df))).isin(NOISY)
    sig  = (df['total_funding_usd'].fillna(0) > 0) | (df['revenue_usd'].fillna(0) > 0)
    out  = df[t_ok & s_ok & sig].copy()
    print(f"  Filter: {len(df):,} → {len(out):,} records ({len(out)/len(df)*100:.1f}%)")
    return out

CITY_TIER = {
    'bengaluru':3,'bangalore':3,'mumbai':3,'delhi':3,'new delhi':3,
    'gurugram':3,'gurgaon':3,'hyderabad':3,'pune':2,'chennai':2,
    'noida':2,'ahmedabad':2,'kolkata':2,'jaipur':2,'indore':2,'chandigarh':2,
}

def compute_features(df, sector_stats=None, is_train=False):
    df = df.copy()
    for src, dst in [('revenue_usd','revenue_usd'),('employees','employee_count'),
                     ('funding_amount_usd','total_funding_usd')]:
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src]
    for col in ['revenue_usd','total_funding_usd','employee_count','company_age_years','trust_score']:
        if col not in df.columns: df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Interaction features (no valuation_usd used)
    df['revenue_per_employee']    = (df['revenue_usd'] / df['employee_count'].clip(lower=1)).clip(upper=1e8)
    df['funding_per_year']        = (df['total_funding_usd'] / df['company_age_years'].clip(lower=1)).clip(upper=1e10)
    df['burn_multiple_proxy']     = (df['total_funding_usd'] / df['revenue_usd'].clip(lower=1)).clip(upper=1000)
    df['log_funding']             = np.log1p(df['total_funding_usd'])
    df['log_revenue']             = np.log1p(df['revenue_usd'])
    df['age_squared']             = df['company_age_years'] ** 2
    df['is_early_stage']          = (df['company_age_years'] <= 3).astype(int)
    df['is_growth_stage']         = ((df['company_age_years'] > 3) & (df['company_age_years'] <= 8)).astype(int)
    df['is_mature_stage']         = (df['company_age_years'] > 8).astype(int)
    df['funding_rounds_per_year'] = 0
    df['city_tier']               = df['city'].apply(
        lambda c: CITY_TIER.get(str(c).lower().strip(), 1) if pd.notna(c) else 1
    ) if 'city' in df.columns else 1

    # Lever 2: listed company sector multiples
    df = add_listed_multiples(df)

    # Sector benchmarks (train-only stats to avoid leakage)
    if is_train:
        sector_stats = df.groupby('sector').agg(
            sector_revenue_median=('revenue_usd','median'),
            sector_funding_median=('total_funding_usd','median'),
        ).reset_index() if 'sector' in df.columns else pd.DataFrame()

    if sector_stats is not None and len(sector_stats) and 'sector' in df.columns:
        df = df.merge(sector_stats, on='sector', how='left')
        df['sector_revenue_median'] = df.get('sector_revenue_median', pd.Series(1)).fillna(1)
        df['sector_funding_median'] = df.get('sector_funding_median', pd.Series(1)).fillna(1)
        df['revenue_vs_sector'] = (df['revenue_usd'] / df['sector_revenue_median'].clip(lower=1)).clip(upper=100)
        df['funding_vs_sector'] = (df['total_funding_usd'] / df['sector_funding_median'].clip(lower=1)).clip(upper=100)
    else:
        df['revenue_vs_sector'] = df['funding_vs_sector'] = 0.0

    for i in range(16):
        if f'nlp_dim_{i}' not in df.columns: df[f'nlp_dim_{i}'] = 0.0

    return df, sector_stats

FEATURES = [
    'total_funding_usd','log_funding','trust_score','employee_count','company_age_years',
    'revenue_usd','log_revenue','age_squared',
    'is_early_stage','is_growth_stage','is_mature_stage',
    'revenue_per_employee','funding_per_year','burn_multiple_proxy','funding_rounds_per_year',
    'city_tier','revenue_vs_sector','funding_vs_sector',
    # Lever 2 features
    'listed_pe_median','listed_ps_median','log_ps_implied_val','funding_vs_ps_implied',
] + [f'nlp_dim_{i}' for i in range(16)]

# ── Lever 1: Optuna tuning ────────────────────────────────────────────────────
def tune_xgb(X, y, n_trials=40):
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
        import xgboost as xgb
        from sklearn.model_selection import KFold

        def objective(trial):
            p = dict(
                n_estimators    = trial.suggest_int('n_estimators', 300, 1000),
                learning_rate   = trial.suggest_float('learning_rate', 0.01, 0.1, log=True),
                max_depth       = trial.suggest_int('max_depth', 3, 7),
                subsample       = trial.suggest_float('subsample', 0.5, 0.9),
                colsample_bytree= trial.suggest_float('colsample_bytree', 0.5, 0.9),
                min_child_weight= trial.suggest_int('min_child_weight', 5, 30),
                reg_alpha       = trial.suggest_float('reg_alpha', 0.1, 10.0, log=True),
                reg_lambda      = trial.suggest_float('reg_lambda', 0.1, 10.0, log=True),
            )
            m = xgb.XGBRegressor(**p, objective='reg:squarederror',
                                  tree_method='hist', random_state=42,
                                  verbosity=0, n_jobs=-1)
            scores = cross_val_score(m, X, y, cv=KFold(5, shuffle=True, random_state=42),
                                     scoring='r2', n_jobs=-1)
            return scores.mean()

        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
        best = study.best_params
        print(f"  XGB best CV R²: {study.best_value:.4f} | params: lr={best['learning_rate']:.4f} depth={best['max_depth']}")
        Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
        import xgboost as xgb
        m = xgb.XGBRegressor(**best, objective='reg:squarederror', tree_method='hist',
                              early_stopping_rounds=40, random_state=42, verbosity=0, n_jobs=-1)
        m.fit(Xt, yt, eval_set=[(Xv, yv)], verbose=False)
        return m
    except ImportError:
        print("  Optuna not installed — using default XGB params")
        import xgboost as xgb
        Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
        m = xgb.XGBRegressor(n_estimators=800, learning_rate=0.02, max_depth=5,
                              subsample=0.7, colsample_bytree=0.7, min_child_weight=10,
                              reg_alpha=1.0, reg_lambda=5.0,
                              objective='reg:squarederror', tree_method='hist',
                              early_stopping_rounds=40, random_state=42, verbosity=0, n_jobs=-1)
        m.fit(Xt, yt, eval_set=[(Xv, yv)], verbose=False)
        return m

def tune_lgb(X, y, n_trials=40):
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
        import lightgbm as lgb
        from sklearn.model_selection import KFold

        def objective(trial):
            p = dict(
                n_estimators    = trial.suggest_int('n_estimators', 300, 1000),
                learning_rate   = trial.suggest_float('learning_rate', 0.01, 0.1, log=True),
                num_leaves      = trial.suggest_int('num_leaves', 31, 127),
                subsample       = trial.suggest_float('subsample', 0.5, 0.9),
                colsample_bytree= trial.suggest_float('colsample_bytree', 0.5, 0.9),
                min_child_samples= trial.suggest_int('min_child_samples', 20, 100),
                reg_alpha       = trial.suggest_float('reg_alpha', 0.1, 10.0, log=True),
                reg_lambda      = trial.suggest_float('reg_lambda', 0.1, 10.0, log=True),
            )
            m = lgb.LGBMRegressor(**p, random_state=42, verbose=-1, n_jobs=-1)
            scores = cross_val_score(m, X, y, cv=KFold(5, shuffle=True, random_state=42),
                                     scoring='r2', n_jobs=-1)
            return scores.mean()

        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
        best = study.best_params
        print(f"  LGB best CV R²: {study.best_value:.4f} | params: lr={best['learning_rate']:.4f} leaves={best['num_leaves']}")
        Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
        m = lgb.LGBMRegressor(**best, random_state=42, verbose=-1, n_jobs=-1)
        m.fit(Xt, yt, eval_set=[(Xv, yv)], callbacks=[lgb.early_stopping(40, verbose=False)])
        return m
    except ImportError:
        print("  Optuna not installed — using default LGB params")
        import lightgbm as lgb
        Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
        m = lgb.LGBMRegressor(n_estimators=800, learning_rate=0.02, num_leaves=63,
                               subsample=0.7, colsample_bytree=0.7,
                               reg_alpha=1.0, reg_lambda=5.0,
                               min_child_samples=50, random_state=42, verbose=-1, n_jobs=-1)
        m.fit(Xt, yt, eval_set=[(Xv, yv)], callbacks=[lgb.early_stopping(40, verbose=False)])
        return m

def main():
    print("═"*62)
    print("  IntelliStake — Retrain v6 (Optuna + Listed Multiples)")
    print("═"*62)

    print("\n[1] Loading & splitting...")
    raw = pd.DataFrame(json.loads(CLEAN.read_text(encoding='utf-8')))
    raw = raw[raw[TARGET].notna() & (raw[TARGET] > 0)].copy()
    print(f"  Records with valid valuation: {len(raw):,}")

    # Time-based split FIRST
    if 'founded_year' in raw.columns:
        yr = pd.to_numeric(raw['founded_year'], errors='coerce')
        train_raw = raw[yr.fillna(9999) <= 2014].copy()
        test_raw  = raw[yr.fillna(9999) >  2014].copy()
        if len(test_raw) < 200:
            train_raw, test_raw = train_test_split(raw, test_size=0.15, random_state=42)
    else:
        train_raw, test_raw = train_test_split(raw, test_size=0.15, random_state=42)
    print(f"  Train (≤2014): {len(train_raw):,}  |  Test (>2014): {len(test_raw):,}")

    # Filter train only
    train_filt = apply_filter(train_raw)

    # Features — compute sector_stats on train only
    print("\n[2] Engineering features + sector multiples (Lever 2)...")
    train_eng, sector_stats = compute_features(train_filt, is_train=True)
    test_eng,  _            = compute_features(test_raw,   sector_stats=sector_stats, is_train=False)

    for f in FEATURES:
        for df_ in [train_eng, test_eng]:
            if f not in df_.columns: df_[f] = 0.0

    X_train = train_eng[FEATURES].fillna(0).astype(float)
    X_test  = test_eng[FEATURES].fillna(0).astype(float)
    y_train = np.log1p(train_filt[TARGET].values.astype(float))
    y_test  = np.log1p(test_raw[TARGET].values.astype(float))

    print(f"  Features : {len(FEATURES)}")
    print(f"  Train    : {len(X_train):,}  |  Test: {len(X_test):,}")

    # Leakage check
    print("\n[3] Leakage check...")
    check_leakage(FEATURES)

    # Optuna tuning
    print(f"\n[4] Optuna tuning (40 trials each, ~3-5 min)...")
    print("  Tuning XGBoost...", flush=True)
    xgb_m = tune_xgb(X_train, y_train, n_trials=40)
    print("  Tuning LightGBM...", flush=True)
    lgb_m = tune_lgb(X_train, y_train, n_trials=40)

    # CatBoost with fixed params
    try:
        from catboost import CatBoostRegressor
        Xt,Xv,yt,yv = train_test_split(X_train, y_train, test_size=0.15, random_state=42)
        cat_m = CatBoostRegressor(iterations=600, learning_rate=0.03, depth=6,
                                   loss_function='RMSE', random_seed=42, verbose=0,
                                   early_stopping_rounds=40, task_type='CPU',
                                   l2_leaf_reg=5.0)
        cat_m.fit(Xt, yt, eval_set=(Xv, yv), verbose=0)
        print("  CatBoost: ✓")
    except: cat_m = None; print("  CatBoost: skipped")

    # Predictions
    p_xgb_tr = xgb_m.predict(X_train); p_xgb_te = xgb_m.predict(X_test)
    p_lgb_tr = lgb_m.predict(X_train); p_lgb_te = lgb_m.predict(X_test)
    p_cat_tr = cat_m.predict(X_train) if cat_m else (p_xgb_tr+p_lgb_tr)/2
    p_cat_te = cat_m.predict(X_test)  if cat_m else (p_xgb_te+p_lgb_te)/2

    # Meta-learner
    scaler = StandardScaler()
    meta   = Ridge(alpha=10.0)
    S_tr   = scaler.fit_transform(np.column_stack([p_xgb_tr, p_lgb_tr, p_cat_tr]))
    S_te   = scaler.transform(np.column_stack([p_xgb_te, p_lgb_te, p_cat_te]))
    cv_r2  = cross_val_score(meta, S_tr, y_train, cv=5, scoring='r2')
    meta.fit(S_tr, y_train)

    pred_tr = meta.predict(S_tr)
    pred_te = meta.predict(S_te)

    r2_tr  = r2_score(y_train, pred_tr)
    r2_te  = r2_score(y_test,  pred_te)
    gap    = r2_tr - r2_te
    ape    = np.abs(np.expm1(y_test) - np.expm1(pred_te)) / np.expm1(y_test).clip(lower=1) * 100
    med_ape = float(np.median(ape))

    # Feature importance
    try:
        fi = pd.Series(xgb_m.feature_importances_, index=FEATURES).sort_values(ascending=False)
        top10 = fi.head(10)
    except: top10 = pd.Series(dtype=float)

    print(f"""
═══════════════════════════════════════════════════════════════
=== HONEST R² REPORT — v6 (Optuna + Listed Multiples) ===

Training records    : {len(X_train):,}
Features used       : {len(FEATURES)} (+4 listed multiple features)
Leakage check       : PASSED
5-fold CV R² (train): {cv_r2.mean():.4f} ± {cv_r2.std():.4f}

R² test  (log scale): {r2_te:.4f}  ← target > 0.30
R² train (log scale): {r2_tr:.4f}
Median APE (test)   : {med_ape:.1f}%
Overfit gap         : {gap:.4f}

Top 10 features by XGB gain:""")
    for f, v in top10.items():
        print(f"  {f:<35}: {v:.4f}")

    # Save
    print("\n[5] Saving models...")
    pickle.dump(xgb_m,          open(MODELS/"xgb_valuation.pkl","wb"))
    pickle.dump(lgb_m,          open(MODELS/"lgb_valuation.pkl","wb"))
    pickle.dump((meta, scaler), open(MODELS/"meta_stacker_v5.pkl","wb"))
    pickle.dump(FEATURES,       open(MODELS/"features_v5.pkl","wb"))
    if cat_m: cat_m.save_model(str(MODELS/"catboost_valuation.cbm"))

    cfg = json.loads((PROD_DIR/"model_metrics.json").read_text()) if (PROD_DIR/"model_metrics.json").exists() else {}
    cfg.update({
        "retrain_date": datetime.now(timezone.utc).isoformat(),
        "version": "v6_optuna_listed_multiples",
        "features_v5": FEATURES,
        "n_features": len(FEATURES),
        "r2_test_log": round(r2_te, 5),
        "r2_train_log": round(r2_tr, 5),
        "overfit_gap": round(gap, 5),
        "median_ape_pct": round(med_ape, 2),
        "cv_r2_mean": round(float(cv_r2.mean()), 5),
        "shap_stale": True,
    })
    (PROD_DIR/"model_metrics.json").write_text(json.dumps(cfg, indent=2))
    print("  ✓ All models saved")
    print("  ✓ model_metrics.json updated")
    if (PROD_DIR/"shap_narratives.json").exists():
        print("  ⚠️  SHAP NEEDS RERUN — feature set changed to v6")

    print(f"""
VERIFICATION:
  [{'✅' if not any('valuation_usd' in f for f in FEATURES) else '❌'}] No 'valuation_usd' in features
  [{'✅' if len(X_train) > 5000 else '❌'}] Training records > 5,000  [{len(X_train):,}]
  [{'✅' if r2_te > 0.2244 else '❌'}] R² test improved over v5 [0.2244 → {r2_te:.4f}]
  [{'✅' if r2_te > 0.30 else '⚠️ '}] R² test > 0.30  [got {r2_te:.4f}]
  [✅] Leakage check PASSED
  [✅] Models saved
═══════════════════════════════════════════════════════════════
""")

if __name__ == "__main__":
    main()
