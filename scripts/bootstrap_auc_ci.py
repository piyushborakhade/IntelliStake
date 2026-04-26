"""
Bootstrap confidence interval on a REAL prediction task.
Uses stacked_valuation_summary.json — actual model predictions vs actual valuations.
Binary task: did the model correctly identify which startup has higher valuation?
This is pairwise ranking AUC — completely independent of trust_score.
"""
import json
import numpy as np
from pathlib import Path
from sklearn.metrics import roc_auc_score

BASE = Path("/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final")
PROD = BASE / "unified_data" / "4_production"

print("Loading stacked valuation summary...")
d = json.load(open(PROD / "stacked_valuation_summary.json"))
narratives = d.get("narratives", d) if isinstance(d, dict) else d
items = narratives if isinstance(narratives, list) else []

# Keep only real companies with both predicted and actual valuation
valid = []
for item in items:
    pred = item.get("predicted_valuation_usd") or item.get("predicted_valuation")
    actual = item.get("actual_valuation_usd") or item.get("valuation_usd")
    is_real = item.get("is_real", True)
    if pred and actual and float(actual) > 0 and float(pred) > 0 and is_real:
        valid.append({
            "pred": float(pred),
            "actual": float(actual),
        })

print(f"Valid real records with predictions: {len(valid)}")
if len(valid) < 100:
    print("ERROR: Not enough valid records. Check stacked_valuation_summary.json structure.")
    import sys
    sys.exit(1)

preds = np.array([v["pred"] for v in valid])
actuals = np.array([v["actual"] for v in valid])

# Binary task: above-median actual valuation (independent of model)
median_actual = np.median(actuals)
labels = (actuals > median_actual).astype(int)

# Normalize predictions to 0-1 for AUC
preds_norm = (preds - preds.min()) / (preds.max() - preds.min() + 1e-9)

auc_point = roc_auc_score(labels, preds_norm)
print(f"Point estimate AUC (model ranking vs actual): {auc_point:.4f}")
print("  (> 0.5 = model ranks high-value startups better than random)")

# Bootstrap
np.random.seed(42)
N_BOOT = 1000
boot_aucs = []
n = len(preds_norm)

for _ in range(N_BOOT):
    idx = np.random.randint(0, n, size=n)
    p_b = preds_norm[idx]
    l_b = labels[idx]
    if len(np.unique(l_b)) < 2:
        continue
    try:
        boot_aucs.append(roc_auc_score(l_b, p_b))
    except Exception:
        continue

boot_aucs = np.array(boot_aucs)
ci_lo = float(np.percentile(boot_aucs, 2.5))
ci_hi = float(np.percentile(boot_aucs, 97.5))
std = float(np.std(boot_aucs))

print(f"\nBootstrap Ranking AUC (n={N_BOOT})")
print(f"  Point estimate : {auc_point:.4f}")
print(f"  95% CI         : [{ci_lo:.4f}, {ci_hi:.4f}]")
print(f"  Std dev        : +/-{std:.4f}")
print(f"  Report as      : {auc_point:.3f} +/- {std:.3f} (95% CI: {ci_lo:.3f}-{ci_hi:.3f})")

# Patch into honest_model_metrics.json
metrics_path = PROD / "honest_model_metrics.json"
metrics = json.load(open(metrics_path))
metrics["auc_roc"] = round(auc_point, 4)
metrics["auc_roc_ci_lo"] = round(ci_lo, 4)
metrics["auc_roc_ci_hi"] = round(ci_hi, 4)
metrics["auc_roc_std"] = round(std, 4)
metrics["auc_roc_n_boot"] = N_BOOT
metrics["auc_roc_task"] = "ranking AUC — model predicted valuation vs actual above-median label"
metrics["auc_roc_report"] = f"{auc_point:.3f} +/- {std:.3f} (95% CI: {ci_lo:.3f}-{ci_hi:.3f})"
metrics["defense_statement"] = (
    f"R2 of {metrics['r2_test']:.3f} on held-out real startups ({metrics['split_type']}). "
    f"Ranking AUC {auc_point:.3f} +/- {std:.3f} (95% CI: {ci_lo:.3f}-{ci_hi:.3f}, "
    f"bootstrap n={N_BOOT}). Task: does the model rank high-valuation startups above "
    f"low-valuation ones? Median APE {metrics['median_ape_pct']}% consistent with "
    f"professional VC disagreement on private market valuations."
)

with open(metrics_path, "w") as f:
    json.dump(metrics, f, indent=2)
print(f"\nPatched: {metrics_path}")
print("AUC task:", metrics["auc_roc_task"])
print("Report:", metrics["auc_roc_report"])
print("Defense:", metrics["defense_statement"])
