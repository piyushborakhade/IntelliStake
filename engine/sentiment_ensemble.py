"""
engine/sentiment_ensemble.py
=============================
IntelliStake — 5-Model Sentiment Ensemble (Domain 2, AI Upgrade 2D)

Upgrades from single FinBERT to weighted 5-model ensemble:

  Model              Weight   HuggingFace ID
  ─────────────────  ──────   ──────────────────────────────────────────────
  FinBERT            30 %     ProsusAI/finbert
  FinBERT-tone       25 %     yiyanghkust/finbert-tone
  Twitter-RoBERTa    20 %     cardiffnlp/twitter-roberta-base-sentiment-latest
  DeBERTa-fin        15 %     mrm8488/deberta-v3-small-finetuned-finance-text-classification
  VADER              10 %     (rule-based, always available)

Each model outputs a score in [-1, +1]:
  positive class probability − negative class probability

Ensemble CFS = weighted sum of individual scores.

Caching:
  Results cached per startup per 24h in unified_data/4_production/sentiment_cache.json

API usage (imported by chatbot_api.py and valuation routes):
  from engine.sentiment_ensemble import score_ensemble
  result = score_ensemble(["Zepto raised $350M at $5B valuation"])
  # → [{"cfs": 0.72, "label": "positive", "confidence": 0.81, "model_breakdown": {...}}]

Standalone:
  python engine/sentiment_ensemble.py --text "Razorpay faces RBI scrutiny"
  python engine/sentiment_ensemble.py --startup "Zepto"
"""

import os
import json
import time
import hashlib
import warnings
import numpy as np
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

BASE_DIR  = Path(__file__).resolve().parent.parent
PROD_DIR  = BASE_DIR / "unified_data" / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)
CACHE_FILE = PROD_DIR / "sentiment_cache.json"

# ── Model registry ────────────────────────────────────────────────────────────
MODELS = [
    {
        "id":     "finbert",
        "hf_id":  "ProsusAI/finbert",
        "weight": 0.30,
        "labels": {"positive": 1.0, "negative": -1.0, "neutral": 0.0},
        "task":   "text-classification",
    },
    {
        "id":     "finbert_tone",
        "hf_id":  "yiyanghkust/finbert-tone",
        "weight": 0.25,
        "labels": {"positive": 1.0, "negative": -1.0, "neutral": 0.0},
        "task":   "text-classification",
    },
    {
        "id":     "twitter_roberta",
        "hf_id":  "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "weight": 0.20,
        "labels": {"positive": 1.0, "negative": -1.0, "neutral": 0.0},
        "task":   "text-classification",
    },
    {
        "id":     "deberta_fin",
        "hf_id":  "mrm8488/deberta-v3-small-finetuned-finance-text-classification",
        "weight": 0.15,
        "labels": {"positive": 1.0, "negative": -1.0, "neutral": 0.0},
        "task":   "text-classification",
    },
]

VADER_WEIGHT = 0.10   # always available, fills remaining 10%

_pipelines: dict = {}  # loaded lazily, singleton per model


# ── Cache helpers ─────────────────────────────────────────────────────────────
def _load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text())
        except Exception:
            pass
    return {}

def _save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2))

def _cache_key(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()

TTL = 86_400  # 24 hours


# ── Model loader ──────────────────────────────────────────────────────────────
def _load_pipeline(model_cfg: dict):
    mid = model_cfg["id"]
    if mid in _pipelines:
        return _pipelines[mid]
    try:
        from transformers import pipeline as hf_pipeline
        import torch
        device = 0 if torch.cuda.is_available() else -1
        print(f"  [Sentiment] Loading {mid} ({model_cfg['hf_id']}) …")
        pipe = hf_pipeline(
            model_cfg["task"],
            model=model_cfg["hf_id"],
            tokenizer=model_cfg["hf_id"],
            device=device,
            top_k=None,
            truncation=True,
            max_length=512,
        )
        _pipelines[mid] = pipe
        print(f"  [Sentiment] ✓ {mid} loaded")
        return pipe
    except Exception as e:
        print(f"  [Sentiment] ✗ {mid} unavailable: {e}")
        _pipelines[mid] = None
        return None


def _score_one_model(pipe, text: str, label_map: dict) -> float:
    """Score a single text with a HF pipeline. Returns CFS in [-1, +1]."""
    try:
        raw = pipe([text], batch_size=1)[0]
        if isinstance(raw, list):
            score_map = {r["label"].lower(): r["score"] for r in raw}
        else:
            score_map = {raw["label"].lower(): raw["score"]}
        cfs = 0.0
        for label, mult in label_map.items():
            cfs += score_map.get(label, 0.0) * mult
        return float(np.clip(cfs, -1.0, 1.0))
    except Exception:
        return 0.0


def _score_vader(text: str) -> float:
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        sia = SentimentIntensityAnalyzer()
        return float(sia.polarity_scores(str(text))["compound"])
    except ImportError:
        return 0.0


# ── Public API ────────────────────────────────────────────────────────────────
def score_ensemble(texts: list[str], use_cache: bool = True) -> list[dict]:
    """
    Score a list of texts with the 5-model ensemble.

    Returns a list of dicts:
      {
        "cfs":           float  [-1, +1]  ensemble weighted score
        "label":         str    "positive" | "neutral" | "negative"
        "confidence":    float  [0, 1]    abs(cfs) → proxy for confidence
        "model_breakdown": {model_id: float, ...}
        "cached":        bool
      }
    """
    cache = _load_cache() if use_cache else {}
    now   = time.time()

    results = []
    cache_dirty = False

    for text in texts:
        key = _cache_key(text)

        # Check cache
        if use_cache and key in cache:
            entry = cache[key]
            if now - entry.get("ts", 0) < TTL:
                results.append({**entry["result"], "cached": True})
                continue

        breakdown: dict[str, float] = {}
        total_weight = 0.0
        weighted_sum = 0.0

        # HuggingFace models
        for cfg in MODELS:
            pipe = _load_pipeline(cfg)
            if pipe is not None:
                score = _score_one_model(pipe, text, cfg["labels"])
            else:
                # Model unavailable — redistribute its weight to VADER
                score = _score_vader(text)
            breakdown[cfg["id"]] = round(score, 4)
            weighted_sum  += cfg["weight"] * score
            total_weight  += cfg["weight"]

        # VADER (always)
        vader_score = _score_vader(text)
        breakdown["vader"] = round(vader_score, 4)
        weighted_sum += VADER_WEIGHT * vader_score
        total_weight += VADER_WEIGHT

        # Normalise (handles missing models gracefully)
        cfs = float(weighted_sum / total_weight) if total_weight > 0 else 0.0
        cfs = float(np.clip(cfs, -1.0, 1.0))

        if cfs >= 0.05:
            label = "positive"
        elif cfs <= -0.05:
            label = "negative"
        else:
            label = "neutral"

        result = {
            "cfs":             round(cfs, 4),
            "label":           label,
            "confidence":      round(abs(cfs), 4),
            "model_breakdown": breakdown,
            "cached":          False,
        }
        results.append(result)

        if use_cache:
            cache[key] = {"ts": now, "result": result}
            cache_dirty = True

    if cache_dirty:
        _save_cache(cache)

    return results


def score_startup_news(startup_name: str, headlines: list[str]) -> dict:
    """
    Aggregate ensemble scores for a startup's news headlines.
    Returns a summary dict suitable for API response.
    """
    if not headlines:
        return {"startup_name": startup_name, "cfs": 0.0, "label": "neutral", "headline_count": 0}

    scores = score_ensemble(headlines)
    cfs_arr = np.array([s["cfs"] for s in scores])

    avg_cfs = float(cfs_arr.mean())
    if avg_cfs >= 0.05:
        label = "positive"
    elif avg_cfs <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {
        "startup_name":    startup_name,
        "cfs":             round(avg_cfs, 4),
        "label":           label,
        "confidence":      round(float(np.abs(cfs_arr).mean()), 4),
        "headline_count":  len(headlines),
        "positive_pct":    round(sum(1 for s in scores if s["label"] == "positive") / len(scores) * 100, 1),
        "negative_pct":    round(sum(1 for s in scores if s["label"] == "negative") / len(scores) * 100, 1),
        "neutral_pct":     round(sum(1 for s in scores if s["label"] == "neutral")  / len(scores) * 100, 1),
        "model_weights": {m["id"]: m["weight"] for m in MODELS} | {"vader": VADER_WEIGHT},
        "per_headline":    [{"headline": h[:120], **s} for h, s in zip(headlines, scores)],
        "generated_at":    datetime.now(timezone.utc).isoformat(),
    }


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="IntelliStake 5-Model Sentiment Ensemble")
    parser.add_argument("--text",    type=str, help="Score a single text")
    parser.add_argument("--startup", type=str, help="Score demo headlines for a startup name")
    args = parser.parse_args()

    if args.text:
        results = score_ensemble([args.text])
        r = results[0]
        print(f"\n  Input:      {args.text}")
        print(f"  Label:      {r['label'].upper()}")
        print(f"  CFS:        {r['cfs']:+.4f}")
        print(f"  Confidence: {r['confidence']:.4f}")
        print(f"\n  Model breakdown:")
        for model_id, score in r["model_breakdown"].items():
            print(f"    {model_id:<20} {score:+.4f}")

    elif args.startup:
        demo_headlines = [
            f"{args.startup} raises $200M at record valuation",
            f"{args.startup} faces regulatory scrutiny from SEBI",
            f"{args.startup} achieves profitability milestone",
            f"Investors concerned about {args.startup} burn rate",
            f"{args.startup} expands to 50 new cities",
        ]
        result = score_startup_news(args.startup, demo_headlines)
        print(f"\n  {args.startup} Sentiment Summary")
        print(f"  CFS: {result['cfs']:+.4f}  Label: {result['label'].upper()}  ({result['headline_count']} headlines)")
        print(f"  Positive: {result['positive_pct']}%  Negative: {result['negative_pct']}%  Neutral: {result['neutral_pct']}%")
    else:
        parser.print_help()
