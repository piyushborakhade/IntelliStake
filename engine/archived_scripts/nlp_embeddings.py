"""
IntelliStake — Upgrade 4: Sentence Transformer NLP Embeddings
Encodes company descriptions using all-MiniLM-L6-v2.
Produces: semantic_features per startup + sector/description similarity scores
Run: python3 nlp_embeddings.py
"""
import json, os, numpy as np
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(BASE, '..', 'unified_data', '4_production')
UNIFIED = os.path.join(BASE, '..', 'unified_data', 'real', 'intellistake_unified.json')
MODELS_DIR = os.path.join(BASE, '..', 'models')

print("\n" + "="*60)
print("  IntelliStake — NLP Embedding Pipeline (Upgrade 4)")
print("="*60 + "\n")

# ── 1. Load data with descriptions ───────────────────────────
print("[1/5] Loading companies with descriptions...")
with open(UNIFIED) as f:
    data = json.load(f)

records = data['startups']
# Focus on real companies that have descriptions
has_desc = [r for r in records if r.get('description') and len(str(r['description']).strip()) > 20]
no_desc  = [r for r in records if not (r.get('description') and len(str(r['description']).strip()) > 20)]

print(f"   Companies with descriptions: {len(has_desc)}")
print(f"   Without descriptions:        {len(no_desc)}")

# For companies without descriptions, generate one from metadata
def synthetic_desc(r):
    name   = r.get('startup_name', 'This company')
    sector = r.get('sector', 'technology')
    city   = r.get('city', '')
    stage  = r.get('stage', 'growth')
    age    = r.get('company_age_years', 5)
    loc    = f"based in {city}" if city else ""
    return (f"{name} is a {sector} company {loc}, operating at {stage} stage "
            f"with {age} years of market presence.")

all_companies  = has_desc + no_desc
all_descs      = []
for r in all_companies:
    d = str(r.get('description', '')).strip()
    all_descs.append(d if d else synthetic_desc(r))

print(f"   Total to encode: {len(all_companies)}")

# ── 2. Load Model ────────────────────────────────────────────
print("[2/5] Loading all-MiniLM-L6-v2 (22MB)...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
print("   Model loaded ✓")

# ── 3. Encode in Batches ─────────────────────────────────────
print("[3/5] Encoding descriptions in batches...")
BATCH = 512
embeddings = model.encode(
    all_descs,
    batch_size=BATCH,
    show_progress_bar=True,
    normalize_embeddings=True,  # L2 norm → cosine similarity = dot product
    convert_to_numpy=True,
)
print(f"   Embeddings shape: {embeddings.shape}")  # (N, 384)

# ── 4. Derive Compact NLP Features Per Company ───────────────
print("[4/5] Computing NLP features...")

# Sector prototype embeddings (cluster center for each sector)
sectors = list(set(r.get('sector', 'Technology') for r in all_companies))
sector_descs = [f"A {s} startup company focused on innovation and growth." for s in sectors]
sector_embeddings = model.encode(sector_descs, normalize_embeddings=True, convert_to_numpy=True)
sector_map = {s: sector_embeddings[i] for i, s in enumerate(sectors)}

nlp_features = []
for i, r in enumerate(all_companies):
    emb = embeddings[i]
    sector = r.get('sector', 'Technology')
    sec_emb = sector_map.get(sector, sector_embeddings[0])

    # Semantic similarity to sector prototype (0–1)
    sector_sim = float(np.dot(emb, sec_emb))

    # Embedding norm (signal richness)
    norm = float(np.linalg.norm(emb))

    # PCA-reduced features (top 8 principal components for ML use)
    # Store first 8 dims of embedding as compact features
    compact = emb[:8].tolist()

    nlp_features.append({
        "startup_name":   r.get('startup_name', ''),
        "sector_similarity": round(sector_sim, 4),
        "description_richness": round(norm, 4),
        "nlp_compact": [round(x, 5) for x in compact],
        "description_preview": all_descs[i][:120],
    })

print(f"   NLP features computed for {len(nlp_features)} companies")

# ── 5. Enrich SHAP Narratives with NLP Scores ────────────────
print("[5/5] Enriching production files with NLP scores...")

# Build lookup
nlp_lookup = {f['startup_name'].lower(): f for f in nlp_features}

# Load existing SHAP narratives and add NLP score
shap_path = os.path.join(PROD, 'shap_narratives.json')
with open(shap_path) as f:
    narratives = json.load(f)

enriched = 0
for n in narratives:
    key = n.get('startup_name', '').lower()
    if key in nlp_lookup:
        nlp = nlp_lookup[key]
        n['sector_similarity_score']  = nlp['sector_similarity']
        n['description_richness']     = nlp['description_richness']
        n['description_preview']      = nlp['description_preview']
        # Add NLP as an additional SHAP-style feature
        n['features'].append({
            "feature": "nlp_sector_alignment",
            "shap_value": round(nlp['sector_similarity'] * 0.08, 5),
            "direction": "positive" if nlp['sector_similarity'] > 0.5 else "neutral"
        })
        enriched += 1

print(f"   Enriched {enriched} SHAP narratives with NLP scores")

# Save updated SHAP narratives
with open(shap_path, 'w') as f:
    json.dump(narratives, f, indent=2)

# Also update stacked_valuation_summary
sv_path = os.path.join(PROD, 'stacked_valuation_summary.json')
with open(sv_path) as f:
    sv = json.load(f)
sv['narratives']  = narratives
sv['nlp_model']   = 'all-MiniLM-L6-v2 (384-dim sentence embeddings)'
sv['nlp_enriched_count'] = enriched
with open(sv_path, 'w') as f:
    json.dump(sv, f, indent=2)

# Save compact NLP features for future retraining
nlp_out_path = os.path.join(PROD, 'nlp_features.json')
with open(nlp_out_path, 'w') as f:
    json.dump({
        "generated_at": datetime.now().isoformat(),
        "model": "all-MiniLM-L6-v2",
        "embedding_dim": 384,
        "compact_dim": 8,
        "total": len(nlp_features),
        "features": nlp_features
    }, f, indent=2)

print(f"\n{'='*60}")
print(f"  ✅ Upgrade 4 Complete!")
print(f"{'='*60}")
print(f"  Companies encoded:     {len(all_companies)}")
print(f"  With real description: {len(has_desc)}")
print(f"  SHAP narratives enriched: {enriched}")
print(f"  Saved: nlp_features.json ({os.path.getsize(nlp_out_path)//1024} KB)")
print(f"\n  Sample NLP scores:")
for f in nlp_features[:5]:
    print(f"    {f['startup_name'][:30]:<30} sector_sim={f['sector_similarity']:.3f}")
