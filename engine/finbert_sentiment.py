"""
engine/finbert_sentiment.py
============================
IntelliStake — FinBERT Transformer Sentiment Pipeline (Domain 2, GenAI)

Replaces VADER with ProsusAI/finbert — a finance-tuned BERT model that
distinguishes between contextually-positive/negative financial phrasing
(e.g. "debt reduction" = positive, "market correction" = negative).

Key differences vs VADER:
  - Contextual understanding (transformer attention, not keyword lookup)
  - Finance-domain fine-tuned on financial phrase bank corpus
  - Produces a Contextual Financial Score (CFS) in [-1, +1]

Input:
  unified_data/3_enriched/sentiment_mentions_raw.parquet
    (5,000 scraped news headlines)

Output:
  unified_data/4_production/finbert_sentiment_scores.json
    - per headline: label, confidence, CFS, vs legacy VADER delta

Fallback: If transformers/torch not installed, falls back to VADER.

Usage:
  python engine/finbert_sentiment.py              # process all mentions
  python engine/finbert_sentiment.py --sample 20  # quick test on 20 headlines
  python engine/finbert_sentiment.py --text "Zepto raised $350M at $5B valuation"
"""

import os
import sys
import json
import argparse
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED  = BASE_DIR / "unified_data"
PROD_DIR = UNIFIED / "4_production"
PROD_DIR.mkdir(parents=True, exist_ok=True)

# Input paths (try numbered tiers first, fall back to legacy names)
SENTIMENT_PATHS = [
    UNIFIED / "3_enriched" / "sentiment_mentions_raw.parquet",
    UNIFIED / "enriched"   / "sentiment_mentions_raw.parquet",
]

# ── FinBERT Loader ────────────────────────────────────────────────────────────

FINBERT_MODEL = "ProsusAI/finbert"
_pipeline     = None   # singleton
_using_vader  = False


def _load_finbert():
    global _pipeline, _using_vader
    if _pipeline is not None:
        return _pipeline

    try:
        from transformers import pipeline as hf_pipeline
        import torch

        device = 0 if torch.cuda.is_available() else -1
        print(f"  Loading FinBERT ({FINBERT_MODEL}) … device={'GPU' if device==0 else 'CPU'}")
        _pipeline = hf_pipeline(
            "text-classification",
            model=FINBERT_MODEL,
            tokenizer=FINBERT_MODEL,
            device=device,
            top_k=None,           # return all 3 class scores
            truncation=True,
            max_length=512,
        )
        print("  ✓ FinBERT loaded successfully.")
        _using_vader = False
        return _pipeline

    except (ImportError, OSError, Exception) as e:
        print(f"  [WARNING] FinBERT unavailable ({e}). Using VADER fallback.")
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        _pipeline = SentimentIntensityAnalyzer()
        _using_vader = True
        return _pipeline


# ── Scoring Functions ─────────────────────────────────────────────────────────

def _score_finbert(texts: list) -> list:
    """Return list of {label, confidence, cfs, positive, negative, neutral} per text."""
    pipe = _load_finbert()
    results = []

    # Batch inference for efficiency
    BATCH = 32
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        try:
            raw = pipe(batch, batch_size=BATCH)
        except Exception as e:
            # Per-item fallback
            raw = [pipe([t], batch_size=1)[0] for t in batch]

        for item_scores in raw:
            if isinstance(item_scores, list):
                # top_k=None → list of {label, score}
                score_map = {s["label"].lower(): s["score"] for s in item_scores}
            else:
                # Single result
                score_map = {item_scores["label"].lower(): item_scores["score"]}

            pos = score_map.get("positive", 0.0)
            neg = score_map.get("negative", 0.0)
            neu = score_map.get("neutral",  0.0)

            # Contextual Financial Score: positive − negative (weighted by confidence)
            cfs = float(pos - neg)

            label = max(score_map, key=score_map.get)
            conf  = float(score_map[label])

            results.append({
                "label":      label,
                "confidence": round(conf, 4),
                "cfs":        round(cfs, 4),
                "positive":   round(pos, 4),
                "negative":   round(neg, 4),
                "neutral":    round(neu, 4),
                "model":      "FinBERT",
            })
    return results


def _score_vader(texts: list) -> list:
    """Fallback VADER scoring — maps compound to CFS format."""
    pipe = _load_finbert()  # returns VADER SIA
    results = []
    for text in texts:
        vs = pipe.polarity_scores(str(text))
        comp = vs["compound"]
        if comp >= 0.05:
            label, conf = "positive", vs["pos"]
        elif comp <= -0.05:
            label, conf = "negative", vs["neg"]
        else:
            label, conf = "neutral", vs["neu"]
        results.append({
            "label":      label,
            "confidence": round(max(conf, abs(comp)), 4),
            "cfs":        round(comp, 4),
            "positive":   round(vs["pos"], 4),
            "negative":   round(vs["neg"], 4),
            "neutral":    round(vs["neu"], 4),
            "model":      "VADER (fallback)",
        })
    return results


def score_texts(texts: list) -> list:
    _load_finbert()
    if _using_vader:
        return _score_vader(texts)
    return _score_finbert(texts)


# ── VADER comparison (legacy compound scores) ─────────────────────────────────

def vader_compound(texts: list) -> list:
    """Compute legacy VADER compound scores for delta comparison."""
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        sia = SentimentIntensityAnalyzer()
        return [round(sia.polarity_scores(str(t))["compound"], 4) for t in texts]
    except ImportError:
        return [0.0] * len(texts)


# ── Data Loader ───────────────────────────────────────────────────────────────

def load_mentions(sample: int = None) -> pd.DataFrame:
    for p in SENTIMENT_PATHS:
        if p.exists():
            df = pd.read_parquet(p)
            print(f"  Loaded {len(df):,} mentions from {p.name}")
            if sample:
                df = df.head(sample)
                print(f"  Sampled to {len(df)} rows")
            return df

    # No parquet found — create synthetic demo data
    print("  [INFO] sentiment_mentions_raw.parquet not found. Using synthetic demo data.")
    demo_headlines = [
        "Zepto raises $350M at $5B valuation in latest funding round",
        "Razorpay faces regulatory scrutiny over AML compliance gaps",
        "BYJU's debt restructuring plan rejected by lenders",
        "Groww reaches 10M active users with strong revenue growth",
        "Nykaa reports declining margins amid increasing competition",
        "PhonePe secures SEBI approval for IPO filing",
        "SoftBank writes down Oyo to $2.7B from $9.6B peak valuation",
        "Meesho achieves profitability milestone for the first time",
        "Paytm stock hits 52-week low after RBI action on payments bank",
        "Swiggy Instamart expands dark store network to 500 cities",
        "Ola Electric misses Q3 delivery targets amid quality issues",
        "CRED announces strategic investment in Indian crypto startup",
        "Slice Bank merger approved by RBI with conditions",
        "Delhivery logistics revenue surges 34% YoY",
        "Unacademy reduces headcount by 20% in third round of layoffs",
        "BharatPe co-founder legal dispute reaches Supreme Court",
        "Freshworks exceeds analyst expectations with 25% revenue growth",
        "Polygon raises $450M for India expansion plans",
        "InMobi achieves EBITDA breakeven after decade of losses",
        "Snapdeal acquisition by Flipkart deal collapses again",
    ]
    return pd.DataFrame({"headline": demo_headlines, "source": ["Demo"] * len(demo_headlines)})


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def run(sample: int = None, single_text: str = None):
    print("\n" + "=" * 60)
    print("  IntelliStake — FinBERT Sentiment Pipeline")
    print("=" * 60)

    # Single-text mode (CLI --text flag)
    if single_text:
        print(f"\n  Input: \"{single_text}\"")
        _load_finbert()
        result = score_texts([single_text])[0]
        vader_c = vader_compound([single_text])[0]
        print(f"\n  Model:      {result['model']}")
        print(f"  Label:      {result['label'].upper()}")
        print(f"  CFS:        {result['cfs']:+.4f}")
        print(f"  Confidence: {result['confidence']:.4f}")
        print(f"  VADER Delta:{result['cfs'] - vader_c:+.4f} vs VADER compound {vader_c:+.4f}")
        return result

    # Batch pipeline
    print("\n[1] Loading mentions …")
    df = load_mentions(sample=sample)

    headline_col = next((c for c in ["headline", "text", "title", "content"] if c in df.columns), df.columns[0])
    texts = df[headline_col].fillna("").tolist()

    print(f"\n[2] Scoring {len(texts)} headlines …")
    scores = score_texts(texts)
    vader_scores = vader_compound(texts)

    # Assemble output records
    records = []
    for i, (text, score, vd) in enumerate(zip(texts, scores, vader_scores)):
        record = {
            "idx":               i,
            "headline":          str(text),
            "source":            str(df["source"].iloc[i]) if "source" in df.columns else "unknown",
            "startup_name":      str(df["startup_name"].iloc[i]) if "startup_name" in df.columns else "general",
            "finbert_label":     score["label"],
            "finbert_confidence":score["confidence"],
            "cfs":               score["cfs"],
            "finbert_positive":  score["positive"],
            "finbert_negative":  score["negative"],
            "finbert_neutral":   score["neutral"],
            "vader_compound":    vd,
            "cfs_vs_vader_delta":round(score["cfs"] - vd, 4),
            "model_used":        score["model"],
        }
        records.append(record)

    # Aggregate statistics
    cfs_arr = np.array([r["cfs"] for r in records])
    label_counts = pd.Series([r["finbert_label"] for r in records]).value_counts().to_dict()
    avg_conf = float(np.mean([r["finbert_confidence"] for r in records]))
    agreement = sum(
        1 for r in records
        if (r["cfs"] >= 0 and r["vader_compound"] >= 0) or (r["cfs"] < 0 and r["vader_compound"] < 0)
    ) / len(records)

    output = {
        "meta": {
            "generated_at":       datetime.now(timezone.utc).isoformat(),
            "model":              scores[0]["model"],
            "finbert_model_id":   FINBERT_MODEL,
            "total_headlines":    len(records),
            "sample_mode":        sample is not None,
        },
        "aggregate_stats": {
            "label_distribution": label_counts,
            "avg_cfs":            round(float(cfs_arr.mean()), 4),
            "avg_confidence":     round(avg_conf, 4),
            "vader_agreement_pct":round(agreement * 100, 1),
            "positive_count":     label_counts.get("positive", 0),
            "negative_count":     label_counts.get("negative", 0),
            "neutral_count":      label_counts.get("neutral", 0),
        },
        "scores": records,
    }

    out_path = PROD_DIR / "finbert_sentiment_scores.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n  ✓ Output written → {out_path}")
    print(f"  Positive: {label_counts.get('positive', 0)} | "
          f"Negative: {label_counts.get('negative', 0)} | "
          f"Neutral: {label_counts.get('neutral', 0)}")
    print(f"  Avg CFS: {cfs_arr.mean():+.4f} | VADER agreement: {agreement*100:.1f}%")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliStake FinBERT Sentiment Pipeline")
    parser.add_argument("--sample", type=int, default=None, help="Process only N headlines (quick test)")
    parser.add_argument("--text",   type=str, default=None, help="Score a single headline string")
    args = parser.parse_args()
    run(sample=args.sample, single_text=args.text)
