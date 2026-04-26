"""
Wire nlp_compact features into the startup dataset so the trust score
endpoint can use them. Adds 3 new fields per startup:
  - nlp_compact_0..7  (8-dim MiniLM projection)
  - description_richness
  - sector_similarity_score
"""
import json
from pathlib import Path

BASE = Path("/Users/piyushborakhade/Desktop/Capstone/IntelliStake_Final")
CLEANED = BASE / "unified_data" / "cleaned"
PROD = BASE / "unified_data" / "4_production"

print("Loading NLP features...")
nlp = json.load(open(PROD / "nlp_features.json"))
features = nlp["features"]

# Build index by startup_name
nlp_idx = {}
for f in features:
    name = f.get("startup_name", "").strip().lower()
    if name:
        nlp_idx[name] = f

print(f"NLP index built: {len(nlp_idx)} entries")

print("Loading startup dataset...")
startups = json.load(open(CLEANED / "intellistake_startups_clean.json"))
items = startups if isinstance(startups, list) else list(startups.values())

matched = 0
for item in items:
    name = (item.get("startup_name") or "").strip().lower()
    nlp_data = nlp_idx.get(name)
    if nlp_data:
        compact = nlp_data.get("nlp_compact") or []
        # Add compact dims as individual features
        for i, v in enumerate(compact[:8]):
            item[f"nlp_dim_{i}"] = round(float(v), 6)
        item["description_richness"] = round(float(nlp_data.get("description_richness") or 0), 4)
        item["sector_similarity_score"] = round(float(nlp_data.get("sector_similarity") or 0), 4)
        item["has_nlp_features"] = True
        matched += 1
    else:
        # Fill with zeros so model doesn't break on missing
        for i in range(8):
            item[f"nlp_dim_{i}"] = 0.0
        item["description_richness"] = 0.0
        item["sector_similarity_score"] = 0.0
        item["has_nlp_features"] = False

print(f"Matched: {matched}/{len(items)} startups ({matched/len(items)*100:.1f}%)")

# Save enriched dataset
out_path = CLEANED / "intellistake_startups_clean.json"
with open(out_path, "w") as f:
    json.dump(items, f, separators=(",", ":"))
print(f"Saved enriched dataset to {out_path}")

# Save a summary for the defense
summary = {
    "nlp_model": nlp.get("model"),
    "embedding_dim": nlp.get("embedding_dim"),
    "compact_dim": nlp.get("compact_dim"),
    "total_startups": len(items),
    "matched_with_nlp": matched,
    "match_rate_pct": round(matched / len(items) * 100, 1),
    "new_features": [f"nlp_dim_{i}" for i in range(8)] + ["description_richness", "sector_similarity_score"],
    "defense_note": (
        f"all-MiniLM-L6-v2 embeddings (384-dim) projected to {nlp.get('compact_dim')}-dim "
        f"via PCA. Enriched {matched} of {len(items)} startups. Features added to trust "
        f"score model as semantic signal alongside structured features."
    )
}
with open(PROD / "nlp_enrichment_summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print("NLP enrichment summary:", summary["defense_note"])
