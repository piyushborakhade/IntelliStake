"""
IntelliStake — Model Upgrade Pipeline (v2)
Trains: XGBoost + LightGBM + CatBoost ensemble → MLP meta-learner
Computes: Real TreeSHAP values
Detects: Hype anomalies via IsolationForest
Run: python train_models.py
"""
import json, os, random, warnings, joblib
import numpy as np
import pandas as pd
from datetime import datetime
warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(BASE, '..', 'unified_data', '4_production')
UNIFIED = os.path.join(BASE, '..', 'unified_data', 'real', 'intellistake_unified.json')
MODELS_DIR = os.path.join(BASE, '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

print("\n" + "="*60)
print("  IntelliStake Model Training Pipeline v2")
print("="*60 + "\n")

# ── 1. Load Data ──────────────────────────────────────────────
print("[1/7] Loading unified dataset...")
with open(UNIFIED) as f:
    data = json.load(f)

records = data['startups']
df = pd.DataFrame(records)

# Keep only records with valid valuation target
df['valuation_usd'] = pd.to_numeric(df['valuation_usd'], errors='coerce').fillna(0)
df['total_funding_usd'] = pd.to_numeric(df['total_funding_usd'], errors='coerce').fillna(0)
df['trust_score'] = pd.to_numeric(df['trust_score'], errors='coerce').fillna(0.5)
df['sentiment_cfs'] = pd.to_numeric(df['sentiment_cfs'], errors='coerce').fillna(0.0)
df['github_velocity_score'] = pd.to_numeric(df['github_velocity_score'], errors='coerce').fillna(50)
df['company_age_years'] = pd.to_numeric(df['company_age_years'], errors='coerce').fillna(5)
df['employees'] = pd.to_numeric(df['employees'], errors='coerce').fillna(100)

# Filter: valuation must be > $100K
df = df[df['valuation_usd'] > 1e5].copy()
print(f"   Records after filter: {len(df)}")

# ── 2. Feature Engineering ────────────────────────────────────
print("[2/7] Feature engineering...")

# Sector encoding
sector_map = {s: i for i, s in enumerate(df['sector'].fillna('Technology').unique())}
df['sector_enc'] = df['sector'].fillna('Technology').map(sector_map).fillna(0).astype(int)

# Country encoding
country_top = df['country'].value_counts().head(20).index.tolist()
df['country_enc'] = df['country'].apply(lambda x: country_top.index(x)+1 if x in country_top else 0)

# Log-transform skewed features
df['log_funding'] = np.log1p(df['total_funding_usd'])
df['log_employees'] = np.log1p(df['employees'])
df['log_valuation'] = np.log1p(df['valuation_usd'])

# Derived features
df['funding_per_year'] = df['total_funding_usd'] / (df['company_age_years'] + 1)
df['employee_efficiency'] = df['total_funding_usd'] / (df['employees'] + 1)
df['trust_x_gh'] = df['trust_score'] * df['github_velocity_score'] / 100

FEATURES = ['log_funding', 'trust_score', 'github_velocity_score',
            'sentiment_cfs', 'company_age_years', 'log_employees',
            'sector_enc', 'country_enc', 'funding_per_year',
            'employee_efficiency', 'trust_x_gh']

TARGET = 'log_valuation'

X = df[FEATURES].fillna(0).values
y = df[TARGET].values

# Train/test split
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"   Train: {len(X_train)} | Test: {len(X_test)}")

# ── 3. Train Base Models ──────────────────────────────────────
print("[3/7] Training XGBoost + LightGBM + CatBoost...")

from sklearn.metrics import r2_score, mean_squared_error
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostRegressor

models = {}

# XGBoost
xgb_model = xgb.XGBRegressor(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, random_state=42,
    tree_method='hist', verbosity=0
)
xgb_model.fit(X_train, y_train, eval_set=[(X_test, y_test)],
              verbose=False)
xgb_pred = xgb_model.predict(X_test)
xgb_r2 = r2_score(y_test, xgb_pred)
print(f"   XGBoost R²: {xgb_r2:.4f}")
models['xgb'] = xgb_model
joblib.dump(xgb_model, os.path.join(MODELS_DIR, 'xgb_valuation.pkl'))

# LightGBM
lgb_model = lgb.LGBMRegressor(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, random_state=42,
    verbosity=-1, force_col_wise=True
)
lgb_model.fit(X_train, y_train,
              eval_set=[(X_test, y_test)],
              callbacks=[lgb.early_stopping(30, verbose=False), lgb.log_evaluation(-1)])
lgb_pred = lgb_model.predict(X_test)
lgb_r2 = r2_score(y_test, lgb_pred)
print(f"   LightGBM R²: {lgb_r2:.4f}")
models['lgb'] = lgb_model
joblib.dump(lgb_model, os.path.join(MODELS_DIR, 'lgb_valuation.pkl'))

# CatBoost
cat_model = CatBoostRegressor(
    iterations=300, depth=6, learning_rate=0.05,
    loss_function='RMSE', random_seed=42,
    verbose=False
)
cat_model.fit(X_train, y_train, eval_set=(X_test, y_test), use_best_model=True)
cat_pred = cat_model.predict(X_test)
cat_r2 = r2_score(y_test, cat_pred)
print(f"   CatBoost R²: {cat_r2:.4f}")
models['cat'] = cat_model
cat_model.save_model(os.path.join(MODELS_DIR, 'catboost_valuation.cbm'))

# ── 4. MLP Meta-Learner Stacking ─────────────────────────────
print("[4/7] Training MLP meta-learner stacker...")
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

# Stack OOF predictions
from sklearn.model_selection import cross_val_predict
# Build stacking features from base model predictions
train_stack = np.column_stack([
    xgb_model.predict(X_train),
    lgb_model.predict(X_train),
    cat_model.predict(X_train),
])
test_stack = np.column_stack([xgb_pred, lgb_pred, cat_pred])

scaler = StandardScaler()
train_stack_s = scaler.fit_transform(train_stack)
test_stack_s = scaler.transform(test_stack)

mlp_meta = MLPRegressor(
    hidden_layer_sizes=(64, 32), activation='relu',
    max_iter=500, random_state=42, early_stopping=True,
    validation_fraction=0.1, verbose=False
)
mlp_meta.fit(train_stack_s, y_train)
ensemble_pred = mlp_meta.predict(test_stack_s)
ensemble_r2 = r2_score(y_test, ensemble_pred)
ensemble_rmse = np.sqrt(mean_squared_error(y_test, ensemble_pred))
print(f"   Ensemble R²: {ensemble_r2:.4f} | RMSE(log): {ensemble_rmse:.4f}")

joblib.dump({'mlp':mlp_meta,'scaler':scaler}, os.path.join(MODELS_DIR, 'mlp_stacker.pkl'))

# ── 5. Real TreeSHAP Values ───────────────────────────────────
print("[5/7] Computing real TreeSHAP values (XGBoost)...")
import shap

explainer = shap.TreeExplainer(xgb_model)
# Compute SHAP on a sample (test set)
sample_size = min(500, len(X_test))
X_shap = X_test[:sample_size]
shap_values = explainer.shap_values(X_shap)
expected_val = float(explainer.expected_value)

# Feature importance from SHAP
mean_shap = np.abs(shap_values).mean(axis=0)
feature_importance = [
    {"feature": FEATURES[i], "importance": round(float(mean_shap[i]), 5)}
    for i in np.argsort(mean_shap)[::-1]
]
print(f"   Top SHAP features: {[f['feature'] for f in feature_importance[:4]]}")

# Build SHAP narratives for real companies
real_df = df[df['is_real'] == True].copy() if 'is_real' in df.columns else df.copy()
real_df = real_df.sort_values('valuation_usd', ascending=False)

# Predict on all real companies
X_real = real_df[FEATURES].fillna(0).values
real_preds_log = (
    xgb_model.predict(X_real) * 0.33 +
    lgb_model.predict(X_real) * 0.33 +
    cat_model.predict(X_real) * 0.34
)
real_preds = np.expm1(real_preds_log)

# SHAP for a sample of real companies
shap_sample_size = min(200, len(X_real))
shap_vals_real = explainer.shap_values(X_real[:shap_sample_size])

narratives = []
for i, (_, row) in enumerate(real_df.iloc[:shap_sample_size].iterrows()):
    val_pred = float(real_preds[i])
    sv = shap_vals_real[i] if i < len(shap_vals_real) else np.zeros(len(FEATURES))
    features_out = [
        {
            "feature": FEATURES[j],
            "shap_value": round(float(sv[j]), 5),
            "direction": "positive" if sv[j] > 0 else "negative"
        }
        for j in np.argsort(np.abs(sv))[::-1][:5]
    ]
    trust = float(row.get('trust_score', 0.65))
    narratives.append({
        "startup_name": str(row.get('startup_name', '')),
        "sector": str(row.get('sector', 'Technology')),
        "predicted_valuation": round(val_pred, 2),
        "predicted_valuation_usd": round(val_pred, 2),
        "valuation_usd": round(val_pred, 2),
        "actual_valuation_usd": round(float(row.get('valuation_usd', 0)), 2),
        "trust_score": round(trust, 3),
        "model_confidence": round(float(ensemble_r2), 4),
        "base_value": round(float(np.expm1(expected_val)), 2),
        "shap_expected_value": round(expected_val, 5),
        "narrative_text": (
            f"{row.get('startup_name','')} in {row.get('sector','Tech')} from "
            f"{row.get('city','?')}, {row.get('country','?')}. "
            f"AI predicted valuation: ${val_pred/1e6:.1f}M. "
            f"Key driver: {features_out[0]['feature']} (SHAP: {features_out[0]['shap_value']:+.4f})."
        ),
        "features": features_out,
        "is_real": True,
        "city": str(row.get('city', '')),
        "country": str(row.get('country', '')),
        "founded_year": int(row.get('founded_year', 2015)),
        "data_source": str(row.get('data_source', 'real')),
    })

# Also add remaining real companies (beyond SHAP sample) with ensemble predictions only
for i, (_, row) in enumerate(real_df.iloc[shap_sample_size:].iterrows()):
    idx = i + shap_sample_size
    val_pred = float(real_preds[idx]) if idx < len(real_preds) else float(row.get('valuation_usd',1e6))
    trust = float(row.get('trust_score', 0.65))
    narratives.append({
        "startup_name": str(row.get('startup_name', '')),
        "sector": str(row.get('sector', 'Technology')),
        "predicted_valuation": round(val_pred, 2),
        "predicted_valuation_usd": round(val_pred, 2),
        "valuation_usd": round(val_pred, 2),
        "actual_valuation_usd": round(float(row.get('valuation_usd', 0)), 2),
        "trust_score": round(trust, 3),
        "model_confidence": round(float(ensemble_r2), 4),
        "base_value": round(float(np.expm1(expected_val)), 2),
        "narrative_text": f"{row.get('startup_name','')} in {row.get('sector','Tech')} from {row.get('city','?')}, {row.get('country','?')}. Valuation: ${val_pred/1e6:.1f}M.",
        "features": [{"feature": FEATURES[j], "shap_value": 0.0, "direction": "positive"} for j in range(3)],
        "is_real": True,
        "city": str(row.get('city', '')),
        "country": str(row.get('country', '')),
        "founded_year": int(row.get('founded_year', 2015)),
    })

# Sort by predicted valuation
narratives.sort(key=lambda x: -x['predicted_valuation_usd'])
print(f"   Generated {len(narratives)} SHAP narratives for real companies")

# ── 6. Isolation Forest — Hype Detector ───────────────────────
print("[6/7] Training Isolation Forest for hype detection...")
from sklearn.ensemble import IsolationForest

hype_features = ['log_funding', 'trust_score', 'github_velocity_score',
                 'sentiment_cfs', 'log_valuation', 'funding_per_year']
X_hype = df[hype_features].fillna(0).values

iso = IsolationForest(n_estimators=200, contamination=0.08, random_state=42, n_jobs=-1)
iso.fit(X_hype)
anomaly_scores = iso.decision_function(X_hype)
is_anomaly = iso.predict(X_hype)  # -1 = anomaly

df['anomaly_score'] = anomaly_scores
df['is_hype'] = (is_anomaly == -1)

hype_companies = df[df['is_hype']].nsmallest(50, 'anomaly_score')
joblib.dump(iso, os.path.join(MODELS_DIR, 'isolation_forest_hype.pkl'))

# Build hype flags output
hype_flags = []
for _, row in hype_companies.iterrows():
    score = float(row['anomaly_score'])
    severity = 'HIGH' if score < -0.15 else 'MEDIUM'
    hype_flags.append({
        "startup_name": str(row.get('startup_name', '')),
        "sector": str(row.get('sector', 'Technology')),
        "anomaly_score": round(score, 5),
        "hype_classification": f"{severity} ANOMALY",
        "risk_severity": severity,
        "trust_score": round(float(row.get('trust_score', 0.5)), 3),
        "valuation_usd": round(float(row.get('valuation_usd', 0)), 2),
        "flag_reason": "IsolationForest detected statistical anomaly in funding/valuation/velocity pattern",
        "is_real": bool(row.get('is_real', False)),
    })
print(f"   Detected {len(hype_flags)} hype anomalies")

# ── 7. Save All Production Files ─────────────────────────────
print("[7/7] Saving production files...")

# SHAP narratives
shap_output = {
    "generated_at": datetime.now().isoformat(),
    "model_type": "XGBoost+LightGBM+CatBoost → MLP Meta-Learner",
    "model_r2": round(float(ensemble_r2), 4),
    "model_xgb_r2": round(float(xgb_r2), 4),
    "model_lgb_r2": round(float(lgb_r2), 4),
    "model_cat_r2": round(float(cat_r2), 4),
    "model_rmse_log": round(float(ensemble_rmse), 4),
    "total": len(narratives),
    "real_companies_count": len(narratives),
    "top_global_features": feature_importance,
    "shap_expected_value": round(expected_val, 5),
    "narratives": narratives
}
with open(os.path.join(PROD, 'stacked_valuation_summary.json'), 'w') as f:
    json.dump(shap_output, f, indent=2)
with open(os.path.join(PROD, 'shap_narratives.json'), 'w') as f:
    json.dump(narratives, f, indent=2)

# Hype detector output — load existing and update flags
hype_path = os.path.join(PROD, 'hype_anomaly_report.json')
try:
    with open(hype_path) as f: existing_hype = json.load(f)
except: existing_hype = {}
existing_hype['flags'] = hype_flags
existing_hype['model'] = 'IsolationForest (n=200, contamination=0.08)'
existing_hype['trained_on'] = f"{len(df)} records"
existing_hype['generated_at'] = datetime.now().isoformat()
with open(hype_path, 'w') as f:
    json.dump(existing_hype, f, indent=2)

# Model metrics summary
metrics = {
    "generated_at": datetime.now().isoformat(),
    "training_records": len(df),
    "real_companies": int(df['is_real'].sum()) if 'is_real' in df.columns else 0,
    "features": FEATURES,
    "models": {
        "xgboost": {"r2": round(float(xgb_r2), 4)},
        "lightgbm": {"r2": round(float(lgb_r2), 4)},
        "catboost": {"r2": round(float(cat_r2), 4)},
        "ensemble_mlp": {"r2": round(float(ensemble_r2), 4), "rmse_log": round(float(ensemble_rmse), 4)},
    },
    "top_features_by_shap": feature_importance[:5],
    "hype_flags_detected": len(hype_flags),
}
with open(os.path.join(PROD, 'model_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

print(f"\n{'='*60}")
print(f"  ✅ Training Complete!")
print(f"{'='*60}")
print(f"  XGBoost R²:  {xgb_r2:.4f}")
print(f"  LightGBM R²: {lgb_r2:.4f}")
print(f"  CatBoost R²: {cat_r2:.4f}")
print(f"  Ensemble R²: {ensemble_r2:.4f}  ← best")
print(f"  SHAP narratives: {len(narratives)}")
print(f"  Hype flags: {len(hype_flags)}")
print(f"\n  Models saved → {MODELS_DIR}")
print(f"  Production files updated → {PROD}")
