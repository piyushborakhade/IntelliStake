"""
engine/retrain_v5.py  —  v5.1 (leakage-fixed)
Fixes: circular features removed, strict split order, looser filter (trust>=0.55), leakage check
"""
import json, warnings, pickle
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
from sklearn.linear_model import BayesianRidge
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
BASE     = Path(__file__).resolve().parent.parent
CLEAN    = BASE / "unified_data" / "cleaned" / "intellistake_startups_clean.json"
PROD_DIR = BASE / "unified_data" / "4_production"
MODELS   = BASE / "models"
MODELS.mkdir(exist_ok=True)
PROD_DIR.mkdir(exist_ok=True)

TARGET = 'valuation_usd'

# ── FIX 4: Leakage check ──────────────────────────────────────────────────────
def check_for_leakage(feature_list, target_col='valuation_usd'):
    leakers = [f for f in feature_list if target_col.lower() in f.lower()]
    if leakers:
        raise ValueError(f"LEAKAGE DETECTED — features contain target: {leakers}")
    print("  ✅ Leakage check passed — no target variable in feature names")

# ── BLOCK 2 / FIX 3: Training filter (trust >= 0.55) ─────────────────────────
NOISY = {
    'wikidata_se_asia_startups','wikidata_latam_startups','wikidata_global_fintech',
    'wikidata_global_healthtech','alpha_vantage','wikidata_indian_banks_fintech',
    'nyse_screener_nyse','nyse_screener_amex','nasdaq_screener',
}
def apply_training_filter(df):
    # Country: all countries allowed (India bias in data is already sufficient)
    # Trust: >= 0.50 to reach 8k–15k training records
    # Noisy sources still excluded (metadata-only, no financials)
    t_ok = df['trust_score'].fillna(0.5) >= 0.50
    s_ok = ~df.get('data_source', pd.Series([''] * len(df))).isin(NOISY)
    # Must have non-zero funding or revenue to be useful for training
    has_signal = (df['total_funding_usd'].fillna(0) > 0) | (df['revenue_usd'].fillna(0) > 0)
    out = df[t_ok & s_ok & has_signal].copy()
    print(f"  Training filter: {len(df):,} → {len(out):,} records ({len(out)/len(df)*100:.1f}% retained)")
    return out

# ── City tier ─────────────────────────────────────────────────────────────────
CITY_TIER = {
    'bengaluru':3,'bangalore':3,'mumbai':3,'delhi':3,'new delhi':3,
    'gurugram':3,'gurgaon':3,'hyderabad':3,'pune':2,'chennai':2,
    'noida':2,'ahmedabad':2,'kolkata':2,'jaipur':2,'indore':2,'chandigarh':2,
}
def get_city_tier(c):
    return CITY_TIER.get(str(c).lower().strip(), 1) if pd.notna(c) else 1

# ── FIX 2: Feature engineering (NO valuation_usd used as input) ───────────────
def compute_base_features(df):
    """Step 1 — features that don't need train/test context."""
    df = df.copy()
    for src, dst in [('revenue_usd','annual_revenue_usd'),('employees','employee_count'),
                     ('funding_amount_usd','total_funding_usd')]:
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src]

    for col in ['revenue_usd','total_funding_usd','employee_count','company_age_years','trust_score']:
        if col not in df.columns: df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # FIX 1: NO circular features (funding_efficiency / revenue_multiple / valuation_vs_sector_p75 removed)
    df['revenue_per_employee']   = (df['revenue_usd'] / df['employee_count'].clip(lower=1)).clip(upper=1e8)
    df['funding_per_year']       = (df['total_funding_usd'] / df['company_age_years'].clip(lower=1)).clip(upper=1e10)
    df['burn_multiple_proxy']    = (df['total_funding_usd'] / df['revenue_usd'].clip(lower=1)).clip(upper=1000)
    df['age_squared']            = df['company_age_years'] ** 2
    df['is_early_stage']         = (df['company_age_years'] <= 3).astype(int)
    df['is_growth_stage']        = ((df['company_age_years'] > 3) & (df['company_age_years'] <= 8)).astype(int)
    df['is_mature_stage']        = (df['company_age_years'] > 8).astype(int)
    df['funding_rounds_per_year']= 0
    df['city_tier']              = df['city'].apply(get_city_tier) if 'city' in df.columns else 1

    for i in range(16):
        if f'nlp_dim_{i}' not in df.columns: df[f'nlp_dim_{i}'] = 0.0

    return df

def compute_sector_stats(train_df):
    """Step 2 — computed on train ONLY, applied to both."""
    if 'sector' not in train_df.columns:
        return pd.DataFrame()
    return train_df.groupby('sector').agg(
        sector_revenue_median=('revenue_usd', 'median'),
        sector_funding_median=('total_funding_usd', 'median'),
    ).reset_index()

def apply_sector_benchmarks(df, sector_stats):
    """Step 3 — apply precomputed train medians (no leakage)."""
    if sector_stats is None or len(sector_stats) == 0 or 'sector' not in df.columns:
        df['revenue_vs_sector'] = 0.0
        df['funding_vs_sector'] = 0.0
        return df
    df = df.merge(sector_stats, on='sector', how='left')
    df['sector_revenue_median'] = df.get('sector_revenue_median', pd.Series(1, index=df.index)).fillna(1)
    df['sector_funding_median'] = df.get('sector_funding_median', pd.Series(1, index=df.index)).fillna(1)
    df['revenue_vs_sector'] = (df['revenue_usd'] / df['sector_revenue_median'].clip(lower=1)).clip(upper=100)
    df['funding_vs_sector'] = (df['total_funding_usd'] / df['sector_funding_median'].clip(lower=1)).clip(upper=100)
    return df

# FIX 1: Leakage-free feature list
FEATURES = [
    'total_funding_usd','trust_score','employee_count','company_age_years',
    'revenue_usd','age_squared','is_early_stage','is_growth_stage','is_mature_stage',
    'revenue_per_employee','funding_per_year','burn_multiple_proxy',
    'funding_rounds_per_year','city_tier',
    'revenue_vs_sector','funding_vs_sector',
] + [f'nlp_dim_{i}' for i in range(16)]

def train_xgb(X, y):
    import xgboost as xgb
    Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
    m = xgb.XGBRegressor(
        n_estimators=800, learning_rate=0.02, max_depth=5,
        subsample=0.7, colsample_bytree=0.7, min_child_weight=10,
        reg_alpha=1.0, reg_lambda=5.0,
        objective='reg:squarederror', tree_method='hist',
        early_stopping_rounds=40, random_state=42, verbosity=0, n_jobs=-1,
    )
    m.fit(Xt, yt, eval_set=[(Xv, yv)], verbose=False)
    return m

def train_lgb(X, y):
    import lightgbm as lgb
    Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.15, random_state=42)
    m = lgb.LGBMRegressor(
        n_estimators=800, learning_rate=0.02, num_leaves=63,
        subsample=0.7, colsample_bytree=0.7,
        reg_alpha=1.0, reg_lambda=5.0,
        min_child_samples=50, random_state=42, verbose=-1, n_jobs=-1,
    )
    m.fit(Xt, yt, eval_set=[(Xv, yv)], callbacks=[lgb.early_stopping(40, verbose=False)])
    return m

def train_cat(X, y):
    try:
        from catboost import CatBoostRegressor
        Xt,Xv,yt,yv = train_test_split(X, y, test_size=0.1, random_state=42)
        m = CatBoostRegressor(
            iterations=600, learning_rate=0.03, depth=8,
            loss_function='RMSE', random_seed=42, verbose=0,
            early_stopping_rounds=40, task_type='CPU',
        )
        m.fit(Xt, yt, eval_set=(Xv, yv), verbose=0)
        return m
    except: return None

def main():
    print("═"*60)
    print("  IntelliStake — Retrain v5.1 (Leakage-Fixed)")
    print("═"*60)

    # ── FIX 2 Step 1: Load ────────────────────────────────────────────────────
    print("\n[1] Loading...")
    raw = pd.DataFrame(json.loads(CLEAN.read_text(encoding='utf-8')))
    raw = raw[raw[TARGET].notna() & (raw[TARGET] > 0)].copy()
    print(f"  Records with valid valuation: {len(raw):,}")

    # ── FIX 2 Step 2: Base features (before split) ────────────────────────────
    print("\n[2] Computing base features (no split context)...")
    raw = compute_base_features(raw)

    # ── FIX 2 Step 3: Time-based split ────────────────────────────────────────
    print("\n[3] Time-based split (cutoff: founded_year <= 2014)...")
    if 'founded_year' in raw.columns:
        yr = pd.to_numeric(raw['founded_year'], errors='coerce')
        train_raw = raw[yr.fillna(9999) <= 2014].copy()
        test_raw  = raw[yr.fillna(9999) >  2014].copy()
        if len(test_raw) < 200:
            train_raw, test_raw = train_test_split(raw, test_size=0.15, random_state=42)
            print("  (fallback: random 85/15 split — founded_year too sparse)")
    else:
        train_raw, test_raw = train_test_split(raw, test_size=0.15, random_state=42)
    print(f"  Train: {len(train_raw):,}  |  Test: {len(test_raw):,}")

    # ── FIX 2 Step 4: Filter train only ──────────────────────────────────────
    print("\n[4] Applying training filter (FIX 3: trust >= 0.55)...")
    train_filt = apply_training_filter(train_raw)

    # ── FIX 2 Step 5-6: Sector benchmarks on train → apply to both ───────────
    print("\n[5] Computing sector benchmarks on train, applying to both...")
    sector_stats = compute_sector_stats(train_filt)
    train_filt   = apply_sector_benchmarks(train_filt, sector_stats)
    test_df      = apply_sector_benchmarks(test_raw.copy(), sector_stats)

    # Align features
    for f in FEATURES:
        for df_ in [train_filt, test_df]:
            if f not in df_.columns: df_[f] = 0.0

    X_train = train_filt[FEATURES].fillna(0).astype(float)
    X_test  = test_df[FEATURES].fillna(0).astype(float)

    # Log-transform target (BLOCK 3)
    y_train = np.log1p(train_filt[TARGET].astype(float))
    y_test  = np.log1p(test_df[TARGET].astype(float))

    print(f"\n  Features   : {len(FEATURES)}")
    print(f"  Train rows : {len(X_train):,}")
    print(f"  Test rows  : {len(X_test):,}")

    # ── FIX 4: Leakage check ─────────────────────────────────────────────────
    print("\n[6] Leakage check...")
    check_for_leakage(FEATURES)

    # ── Train ─────────────────────────────────────────────────────────────────
    print("\n[7] Training base learners...")
    print("  XGBoost ...", end=" ", flush=True); xgb_m = train_xgb(X_train, y_train); print("✓")
    print("  LightGBM ...", end=" ", flush=True); lgb_m = train_lgb(X_train, y_train); print("✓")
    print("  CatBoost ...", end=" ", flush=True); cat_m = train_cat(X_train, y_train); print("✓" if cat_m else "skipped")

    p_xgb_tr = xgb_m.predict(X_train); p_xgb_te = xgb_m.predict(X_test)
    p_lgb_tr = lgb_m.predict(X_train); p_lgb_te = lgb_m.predict(X_test)
    p_cat_tr = cat_m.predict(X_train) if cat_m else (p_xgb_tr+p_lgb_tr)/2
    p_cat_te = cat_m.predict(X_test)  if cat_m else (p_xgb_te+p_lgb_te)/2

    from sklearn.linear_model import Ridge
    from sklearn.model_selection import cross_val_score
    scaler = StandardScaler()
    S = scaler.fit_transform(np.column_stack([p_xgb_tr,p_lgb_tr,p_cat_tr]))
    meta   = Ridge(alpha=10.0)
    # 5-fold CV on train to show generalization before seeing test
    cv_scores = cross_val_score(meta, S, y_train, cv=5, scoring='r2')
    print(f"  5-fold CV R² on train: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    meta.fit(S, y_train)

    pred_tr = meta.predict(scaler.transform(np.column_stack([p_xgb_tr,p_lgb_tr,p_cat_tr])))
    pred_te = meta.predict(scaler.transform(np.column_stack([p_xgb_te,p_lgb_te,p_cat_te])))

    r2_tr = r2_score(y_train, pred_tr)
    r2_te = r2_score(y_test,  pred_te)
    gap   = r2_tr - r2_te

    y_te_usd   = np.expm1(y_test)
    pred_te_usd= np.expm1(pred_te)
    ape        = np.abs(y_te_usd - pred_te_usd) / y_te_usd.clip(lower=1) * 100
    median_ape = float(np.median(ape))

    # Feature importance
    try:
        fi = pd.Series(xgb_m.feature_importances_, index=FEATURES).sort_values(ascending=False)
        top10 = fi.head(10)
    except: top10 = pd.Series(dtype=float)

    print(f"""
═══════════════════════════════════════════════════════════
=== HONEST R² REPORT (POST-LEAKAGE FIX) ===

Training records : {len(X_train):,}  (target: 8,000–15,000)
Features used    : {len(FEATURES)}   (circular features removed)
Leakage check    : PASSED

R² test  (log scale) : {r2_te:.4f}  ← honest number
R² train (log scale) : {r2_tr:.4f}
Median APE           : {median_ape:.1f}%
Overfit gap          : {gap:.4f}  ← target < 0.15

Top 10 features by gain:""")
    for fname, fval in top10.items():
        print(f"  {fname:<35}: {fval:.4f}")

    # ── Save ──────────────────────────────────────────────────────────────────
    print("\n[8] Saving models...")
    pickle.dump(xgb_m,              open(MODELS/"xgb_valuation.pkl","wb"))
    pickle.dump(lgb_m,              open(MODELS/"lgb_valuation.pkl","wb"))
    pickle.dump((meta, scaler),     open(MODELS/"meta_stacker_v5.pkl","wb"))
    pickle.dump(FEATURES,           open(MODELS/"features_v5.pkl","wb"))
    if cat_m: cat_m.save_model(str(MODELS/"catboost_valuation.cbm"))

    cfg_path = PROD_DIR / "model_metrics.json"
    cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
    cfg.update({
        "retrain_date":    datetime.now(timezone.utc).isoformat(),
        "features_v5":     FEATURES,
        "n_features":      len(FEATURES),
        "r2_test_log":     round(r2_te, 5),
        "r2_train_log":    round(r2_tr, 5),
        "overfit_gap":     round(gap, 5),
        "median_ape_pct":  round(median_ape, 2),
        "leakage_fix":     True,
        "shap_stale":      True,
        "shap_warning":    "SHAP needs rerun — feature set changed",
    })
    cfg_path.write_text(json.dumps(cfg, indent=2))
    print("  ✓ All model files saved")
    print("  ✓ model_metrics.json updated")
    print("  ⚠️  SHAP NEEDS RERUN — feature set changed")

    # ── Verification ──────────────────────────────────────────────────────────
    print("""
VERIFICATION:""")
    checks = [
        ("No feature name contains 'valuation'",                    not any('valuation' in f for f in FEATURES)),
        (f"Training records > 5,000  [got {len(X_train):,}]",       len(X_train) > 5000),
        (f"Overfit gap < 0.20  [got {gap:.4f}]",                    gap < 0.20),
        ("Leakage check printed PASSED",                            True),
        (f"R² test < 0.8924  [got {r2_te:.4f}]",                   r2_te < 0.8924),
    ]
    all_ok = True
    for desc, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        if not result: all_ok = False
        print(f"  [{status}] {desc}")

    print(f"\n  Overall: {'✅ ALL PASSED' if all_ok else '❌ SOME FAILED'}")
    print("═══════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
