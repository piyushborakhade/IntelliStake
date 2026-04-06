"""
IntelliStake — Upgrade 8: AutoGluon TabularPredictor
Runs a competition-grade model leaderboard on 37K real startups.
Time limit: 5 minutes. Produces leaderboard + best model predictions.
Run: python3 autogluon_train.py
"""
import json, os, warnings, numpy as np, pandas as pd
from datetime import datetime
warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(BASE, '..', 'unified_data', '4_production')
UNIFIED = os.path.join(BASE, '..', 'unified_data', 'real', 'intellistake_unified.json')
MODELS_DIR = os.path.join(BASE, '..', 'models', 'autogluon')
os.makedirs(MODELS_DIR, exist_ok=True)

print("\n" + "="*60)
print("  IntelliStake — AutoGluon Leaderboard (Upgrade 8)")
print("="*60 + "\n")

# ── Load & Prepare ────────────────────────────────────────────
print("[1/4] Loading data...")
with open(UNIFIED) as f: data = json.load(f)

df = pd.DataFrame(data['startups'])
num_cols = ['valuation_usd','total_funding_usd','trust_score','sentiment_cfs',
            'github_velocity_score','company_age_years','employees']
for c in num_cols:
    df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)

df = df[df['valuation_usd'] > 1e5].copy()
df['log_valuation'] = np.log1p(df['valuation_usd'])
df['log_funding'] = np.log1p(df['total_funding_usd'])
df['log_employees'] = np.log1p(df['employees'])
df['funding_per_year'] = df['total_funding_usd'] / (df['company_age_years'].clip(1))

FEATURES = ['log_funding','trust_score','github_velocity_score','sentiment_cfs',
            'company_age_years','log_employees','sector','country',
            'funding_per_year','log_valuation']
TARGET = 'log_valuation'

train_df = df[FEATURES].dropna().copy()
print(f"   Training rows: {len(train_df)}")

# ── AutoGluon Training ────────────────────────────────────────
print("[2/4] Running AutoGluon (5-min time limit, medium quality)...")
from autogluon.tabular import TabularPredictor

predictor = TabularPredictor(
    label=TARGET,
    eval_metric='r2',
    path=MODELS_DIR,
    verbosity=1,
).fit(
    train_df,
    time_limit=300,        # 5 minutes
    presets='medium_quality',
    excluded_model_types=['FASTAI'],  # skip neural net — too slow
)

# ── Leaderboard ───────────────────────────────────────────────
print("\n[3/4] Building leaderboard...")
lb = predictor.leaderboard(train_df, silent=True)

leaderboard_rows = []
for _, row in lb.iterrows():
    leaderboard_rows.append({
        "model": str(row['model']),
        "r2_score": round(float(row['score_val']), 4),
        "fit_time_sec": round(float(row.get('fit_time', 0)), 1),
        "pred_time_sec": round(float(row.get('pred_time_val', 0)), 3),
    })
    print(f"   {row['model']:<35} R²={row['score_val']:.4f}")

best_model = lb.iloc[0]['model']
best_r2 = float(lb.iloc[0]['score_val'])
print(f"\n   🏆 Best model: {best_model}  R²={best_r2:.4f}")

# ── Save ─────────────────────────────────────────────────────
print("[4/4] Saving leaderboard to production...")
ag_out = {
    "generated_at": datetime.now().isoformat(),
    "training_records": len(train_df),
    "time_limit_sec": 300,
    "best_model": best_model,
    "best_r2": round(best_r2, 4),
    "leaderboard": leaderboard_rows,
    "feature_importance": {},
}

# Feature importance from best model
try:
    fi = predictor.feature_importance(train_df)
    ag_out["feature_importance"] = {str(k): round(float(v),5) for k,v in fi['importance'].head(10).items()}
except: pass

with open(os.path.join(PROD, 'autogluon_leaderboard.json'), 'w') as f:
    json.dump(ag_out, f, indent=2)

# Update model_metrics.json
metrics_path = os.path.join(PROD, 'model_metrics.json')
try:
    with open(metrics_path) as f: metrics = json.load(f)
except: metrics = {}
metrics['autogluon'] = {
    "best_model": best_model, "best_r2": round(best_r2,4),
    "leaderboard_models": len(leaderboard_rows)
}
metrics['generated_at'] = datetime.now().isoformat()
with open(metrics_path,'w') as f: json.dump(metrics, f, indent=2)

print(f"\n{'='*60}")
print(f"  ✅ Upgrade 8 Complete!")
print(f"{'='*60}")
print(f"  Best Model: {best_model}")
print(f"  Best R²:    {best_r2:.4f}")
print(f"  Models in leaderboard: {len(leaderboard_rows)}")
