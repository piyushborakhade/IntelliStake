"""
IntelliStake — Upgrade 5: Survival Analysis
Kaplan-Meier + Cox Proportional Hazards for startup longevity.
Produces: survival probability per startup at 1y, 3y, 5y horizons.
Run: python3 survival_analysis.py
"""
import json, os, warnings, numpy as np, pandas as pd
from datetime import datetime
warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(BASE, '..', 'unified_data', '4_production')
UNIFIED = os.path.join(BASE, '..', 'unified_data', 'real', 'intellistake_unified.json')

print("\n" + "="*60)
print("  IntelliStake — Survival Analysis (Upgrade 5)")
print("="*60 + "\n")

# ── 1. Load + Prepare ─────────────────────────────────────────
print("[1/4] Preparing survival dataset...")
with open(UNIFIED) as f:
    data = json.load(f)

df = pd.DataFrame(data['startups'])
df['valuation_usd']      = pd.to_numeric(df['valuation_usd'],      errors='coerce').fillna(0)
df['total_funding_usd']  = pd.to_numeric(df['total_funding_usd'],  errors='coerce').fillna(0)
df['trust_score']        = pd.to_numeric(df['trust_score'],        errors='coerce').fillna(0.5)
df['company_age_years']  = pd.to_numeric(df['company_age_years'],  errors='coerce').fillna(5)
df['github_velocity_score'] = pd.to_numeric(df['github_velocity_score'], errors='coerce').fillna(50)
df['employees']          = pd.to_numeric(df['employees'],          errors='coerce').fillna(50)
df['sentiment_cfs']      = pd.to_numeric(df['sentiment_cfs'],      errors='coerce').fillna(0)

# Survival model needs:
# T = duration (company_age_years) — time observed
# E = event (1 = "survived to funding Series B+", 0 = censored/early stage)
# We infer "event" from stage and funding
def infer_event(row):
    stage = str(row.get('stage', '')).lower()
    funding = float(row.get('total_funding_usd', 0))
    mature_stages = ['series b','series c','series d','series e','series f',
                     'ipo','unicorn','acquired','series g','series h','series i']
    if any(s in stage for s in mature_stages): return 1
    if funding > 5e6: return 1
    return 0

df['event'] = df.apply(infer_event, axis=1)
df['duration'] = df['company_age_years'].clip(lower=0.5)

# filter: keep rows with valid duration
df = df[df['duration'] > 0].copy()
print(f"   Records: {len(df)} | Survived to B+: {df['event'].sum()} ({df['event'].mean()*100:.1f}%)")

# ── 2. Kaplan-Meier by Sector ────────────────────────────────
print("[2/4] Fitting Kaplan-Meier curves by sector...")
from lifelines import KaplanMeierFitter

kmf = KaplanMeierFitter()
sector_survival = {}
top_sectors = df['sector'].value_counts().head(12).index.tolist()

for sector in top_sectors:
    mask = df['sector'] == sector
    sub = df[mask]
    if len(sub) < 10: continue
    kmf.fit(sub['duration'], sub['event'], label=sector)
    # Survival probability at 1y, 3y, 5y
    s1 = float(kmf.predict(1))
    s3 = float(kmf.predict(3))
    s5 = float(kmf.predict(5))
    sector_survival[sector] = {
        "survival_1yr": round(s1, 4),
        "survival_3yr": round(s3, 4),
        "survival_5yr": round(s5, 4),
        "median_survival_yrs": round(float(kmf.median_survival_time_), 2) if not np.isinf(kmf.median_survival_time_) else None,
        "n_companies": int(mask.sum()),
        "pct_survived_to_series_b": round(df[mask]['event'].mean() * 100, 1),
    }
    print(f"   {sector:<20} 1y:{s1:.2%} 3y:{s3:.2%} 5y:{s5:.2%}")

# ── 3. Cox PH — Company-Level Survival Probability ───────────
print("\n[3/4] Fitting Cox Proportional Hazards model...")
from lifelines import CoxPHFitter

cox_features = ['duration', 'event', 'trust_score', 'github_velocity_score',
                'sentiment_cfs', 'company_age_years', 'employees']

# Add log features
df['log_funding'] = np.log1p(df['total_funding_usd'])
df['log_employees'] = np.log1p(df['employees'])
cox_features += ['log_funding', 'log_employees']

cox_df = df[cox_features + ['startup_name', 'sector', 'valuation_usd']].dropna().copy()
# Normalize numeric features
for col in ['trust_score','github_velocity_score','sentiment_cfs','log_funding','log_employees']:
    mean, std = cox_df[col].mean(), cox_df[col].std()
    if std > 0:
        cox_df[col] = (cox_df[col] - mean) / std

cph = CoxPHFitter(penalizer=0.1)
cph.fit(cox_df[['duration','event','trust_score','github_velocity_score',
                'sentiment_cfs','log_funding','log_employees']],
        duration_col='duration', event_col='event')

# Print summary (concordance)
print(f"   Cox C-index (concordance): {cph.concordance_index_:.4f}")
print(f"   Key hazard ratios:")
for feat in ['trust_score','log_funding','github_velocity_score']:
    hr = float(np.exp(cph.params_[feat]))
    print(f"     {feat}: HR={hr:.3f} ({'protective' if hr<1 else 'increases survival'})")

# Predict survival at 3yr for each real company in our dataset
print("\n[4/4] Computing survival scores for all real companies...")
predict_df = cox_df[['trust_score','github_velocity_score','sentiment_cfs',
                      'log_funding','log_employees']].copy()

# Batch survival prediction at 3yr
survival_probs = cph.predict_survival_function(predict_df, times=[1,3,5])

survival_results = []
for i, (idx, row) in enumerate(cox_df.iterrows()):
    if i >= len(survival_probs.columns): break
    col = survival_probs.columns[i]
    s1 = float(survival_probs.loc[1, col])
    s3 = float(survival_probs.loc[3, col])
    s5 = float(survival_probs.loc[5, col])
    median_s = df.loc[idx, 'company_age_years'] if idx in df.index else 5
    survival_results.append({
        "startup_name": str(row.get('startup_name','') if hasattr(row,'get') else cox_df.loc[idx,'startup_name']),
        "survival_1yr": round(s1, 4),
        "survival_3yr": round(s3, 4),
        "survival_5yr": round(s5, 4),
        "survival_score": round(s3, 4),  # 3yr is the primary score
        "sector": str(cox_df.loc[idx,'sector']) if idx in cox_df.index else '',
    })

print(f"   Computed survival for {len(survival_results)} companies")

# ── Save outputs ─────────────────────────────────────────────
survival_out = {
    "generated_at": datetime.now().isoformat(),
    "model": "Cox Proportional Hazards + Kaplan-Meier",
    "concordance_index": round(float(cph.concordance_index_), 4),
    "total_analyzed": len(df),
    "event_definition": "Survived to Series B+ funding or age>5yrs",
    "hazard_ratios": {
        feat: round(float(np.exp(cph.params_[feat])), 4)
        for feat in cph.params_.index
    },
    "sector_kaplan_meier": sector_survival,
    "company_survival": survival_results[:5000],  # top 5K
}
with open(os.path.join(PROD, 'survival_analysis.json'), 'w') as f:
    json.dump(survival_out, f, indent=2)

# Enrich SHAP narratives with survival scores
surv_lookup = {r['startup_name'].lower(): r for r in survival_results}
shap_path = os.path.join(PROD, 'shap_narratives.json')
with open(shap_path) as f: narratives = json.load(f)

enriched = 0
for n in narratives:
    key = n.get('startup_name','').lower()
    if key in surv_lookup:
        s = surv_lookup[key]
        n['survival_1yr'] = s['survival_1yr']
        n['survival_3yr'] = s['survival_3yr']
        n['survival_5yr'] = s['survival_5yr']
        n['survival_score'] = s['survival_score']
        enriched += 1
with open(shap_path,'w') as f: json.dump(narratives, f, indent=2)

# Update stacked summary too
sv_path = os.path.join(PROD, 'stacked_valuation_summary.json')
with open(sv_path) as f: sv = json.load(f)
sv['narratives'] = narratives
sv['survival_model'] = f"Cox PH C-index={cph.concordance_index_:.4f}"
with open(sv_path, 'w') as f: json.dump(sv, f, indent=2)

print(f"\n{'='*60}")
print(f"  ✅ Upgrade 5 Complete!")
print(f"{'='*60}")
print(f"  Cox C-index: {cph.concordance_index_:.4f}")
print(f"  Companies scored: {len(survival_results)}")
print(f"  SHAP narratives enriched: {enriched}")
print(f"  Sector survival curves: {len(sector_survival)} sectors")
print(f"\n  Sector 5yr survival:")
for s,v in sorted(sector_survival.items(), key=lambda x:-x[1]['survival_5yr'])[:5]:
    print(f"    {s:<20}: {v['survival_5yr']:.1%}")
