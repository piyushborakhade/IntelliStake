"""
engine/rag_chatbot.py
======================
IntelliStake — VC Auditor RAG Chatbot (Domain 4, GenAI)

A local Retrieval-Augmented Generation (RAG) chatbot that lets users
query the 3.2M-point IntelliStake data lake using natural language.
No cloud API required — runs entirely on-device with Ollama.

Architecture:
  Vector Store:  ChromaDB (local, persistent, no cloud needed)
  Embeddings:    sentence-transformers/all-MiniLM-L6-v2
  LLM:           Ollama (llama3 or mistral — auto-detected)
  RAG flow:      User query → embed → ChromaDB retrieval (top-5) → LLM prompt → answer

Data Sources Indexed:
  - intellistake_startups_clean.json         (startup fundamentals)
  - finbert_sentiment_scores.json            (FinBERT CFS scores)
  - shap_narratives.json                     (SHAP reasoning narratives)
  - hype_anomaly_flags.json                  (anomaly labels)
  - stacked_valuation_summary.json           (AI valuation predictions)
  - backtest_results.json                    (portfolio performance)

Usage:
  # Interactive CLI mode
  python engine/rag_chatbot.py

  # Single query mode
  python engine/rag_chatbot.py --query "Which fintech startups have trust score above 0.8?"

  # Re-index all data (force rebuild vector store)
  python engine/rag_chatbot.py --reindex

  # Change LLM model
  python engine/rag_chatbot.py --model mistral

Requirements:
  pip install chromadb sentence-transformers
  brew install ollama && ollama pull llama3   (or mistral)
"""

import os
import sys
import json
import argparse
import warnings
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
UNIFIED  = BASE_DIR / "unified_data"
PROD_DIR = UNIFIED / "4_production"
CHROMA_DIR = BASE_DIR / ".chroma_db"   # persistent local vector store
SESSION_LOG = PROD_DIR / "chatbot_session_log.json"
PROD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_MODEL  = "llama3"
EMBED_MODEL    = "sentence-transformers/all-MiniLM-L6-v2"
COLLECTION_NAME = "intellistake_kb"
TOP_K          = 5      # documents to retrieve per query
MAX_CHUNK_LEN  = 500    # characters per chunk

# ── Source Documents to Index ─────────────────────────────────────────────────

INDEX_SOURCES = {
    "startups": [
        UNIFIED / "2_cleaned"  / "intellistake_startups_clean.json",
        UNIFIED / "cleaned"    / "intellistake_startups_clean.json",
    ],
    "finbert":  [PROD_DIR / "finbert_sentiment_scores.json"],
    "shap":     [PROD_DIR / "shap_narratives.json"],
    "hype":     [PROD_DIR / "hype_anomaly_flags.json"],
    "stacked":  [PROD_DIR / "stacked_valuation_summary.json"],
    "backtest": [PROD_DIR / "backtest_results.json"],
}

# ── Embedding Model ───────────────────────────────────────────────────────────

_embedder = None

def get_embedder():
    global _embedder
    if _embedder is not None:
        return _embedder
    try:
        from sentence_transformers import SentenceTransformer
        print(f"  Loading embeddings ({EMBED_MODEL}) …")
        _embedder = SentenceTransformer(EMBED_MODEL)
        print("  ✓ Embeddings loaded")
        return _embedder
    except ImportError:
        raise ImportError(
            "sentence-transformers not installed.\n"
            "Run: pip install sentence-transformers"
        )

def embed(texts: list) -> list:
    model = get_embedder()
    return model.encode(texts, batch_size=32, show_progress_bar=False).tolist()

# ── ChromaDB Setup ────────────────────────────────────────────────────────────

_chroma_client = None
_collection    = None

def get_collection(reset: bool = False):
    global _chroma_client, _collection
    if _collection is not None and not reset:
        return _collection
    try:
        import chromadb
        from chromadb.config import Settings
    except ImportError:
        raise ImportError(
            "chromadb not installed.\n"
            "Run: pip install chromadb"
        )

    _chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    if reset and COLLECTION_NAME in [c.name for c in _chroma_client.list_collections()]:
        _chroma_client.delete_collection(COLLECTION_NAME)
        print("  Existing collection deleted. Re-indexing …")

    _collection = _chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection

# ── Document Chunking ─────────────────────────────────────────────────────────

def _chunk_text(text: str, max_len: int = MAX_CHUNK_LEN) -> list:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks, chunk = [], []
    for w in words:
        chunk.append(w)
        if len(" ".join(chunk)) >= max_len:
            chunks.append(" ".join(chunk))
            chunk = chunk[-20:]   # 20-word overlap
    if chunk:
        chunks.append(" ".join(chunk))
    return chunks


def _startup_to_text(record: dict) -> str:
    """Convert a startup dict to a rich text document for indexing."""
    fields = [
        ("startup_name", "Startup"),
        ("startup_id",   "ID"),
        ("sector",       "Sector"),
        ("country",      "Country"),
        ("trust_score",  "Trust Score"),
        ("risk_severity","Risk Severity"),
        ("total_funding_usd", "Total Funding USD"),
        ("annual_revenue_usd","Annual Revenue USD"),
        ("github_velocity_score", "GitHub Velocity Score"),
        ("sentiment_compound", "Sentiment Score"),
        ("company_age_years",  "Company Age (years)"),
        ("employee_count",     "Employees"),
        ("portfolio_action",   "Portfolio Action"),
        ("classification",     "Hype Label"),
        ("predicted_valuation_usd", "AI Predicted Valuation USD"),
        ("narrative_text",     "SHAP Reasoning"),
        ("cfs",               "FinBERT CFS Score"),
        ("finbert_label",     "FinBERT Sentiment"),
    ]
    parts = []
    for key, label in fields:
        v = record.get(key)
        if v is not None and str(v).strip() not in ("", "nan", "NONE", "null"):
            parts.append(f"{label}: {v}")
    return " | ".join(parts)


def _doc_id(source: str, idx: int, text: str) -> str:
    """Stable document ID."""
    h = hashlib.md5(f"{source}_{idx}_{text[:60]}".encode()).hexdigest()[:12]
    return f"{source}_{idx}_{h}"


# ── Indexing Pipeline ─────────────────────────────────────────────────────────

def _load_json_records(paths: list, key_hints: list = None) -> list:
    """Load records from the first existing path."""
    for p in paths:
        if not p.exists():
            continue
        with open(p) as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if key_hints:
                for key in key_hints:
                    if key in data and isinstance(data[key], list):
                        return data[key]
            # Return the first list-valued key
            for v in data.values():
                if isinstance(v, list) and len(v) > 0:
                    return v
    return []


def build_index(force: bool = False):
    """
    Index all source documents into ChromaDB.
    Skips if collection already has data (unless force=True).
    """
    coll = get_collection(reset=force)

    existing = coll.count()
    if existing > 0 and not force:
        print(f"  Vector store already has {existing:,} chunks. Use --reindex to rebuild.")
        return

    print("\n[INDEXING] Building IntelliStake knowledge base …")
    all_docs, all_ids, all_metas = [], [], []

    # 1. Startups
    startups = _load_json_records(INDEX_SOURCES["startups"], ["startups", "data"])
    print(f"  Startups: {len(startups):,} records")
    for i, rec in enumerate(startups[:5000]):   # cap at 5k for speed
        text = _startup_to_text(rec)
        source_meta = {
            "source":   "startups_clean",
            "startup_name": str(rec.get("startup_name", f"Startup_{i}")),
            "trust_score":  str(rec.get("trust_score", "")),
            "sector":       str(rec.get("sector", "")),
        }
        for j, chunk in enumerate(_chunk_text(text)):
            all_docs.append(chunk)
            all_ids.append(_doc_id("startup", i * 10 + j, chunk))
            all_metas.append(source_meta)

    # 2. FinBERT scores
    scores = _load_json_records(INDEX_SOURCES["finbert"], ["scores"])
    print(f"  FinBERT: {len(scores):,} records")
    for i, rec in enumerate(scores[:2000]):
        text = (f"Headline: {rec.get('headline', '')} | "
                f"Startup: {rec.get('startup_name', 'general')} | "
                f"FinBERT Label: {rec.get('finbert_label', '')} | "
                f"CFS: {rec.get('cfs', '')} | "
                f"VADER Compound: {rec.get('vader_compound', '')}")
        all_docs.append(text)
        all_ids.append(_doc_id("finbert", i, text))
        all_metas.append({"source": "finbert", "startup_name": str(rec.get("startup_name", ""))})

    # 3. SHAP narratives
    narratives = _load_json_records(INDEX_SOURCES["shap"], ["narratives"])
    print(f"  SHAP: {len(narratives):,} records")
    for i, rec in enumerate(narratives):
        text = (f"Startup: {rec.get('startup_name', '')} | "
                f"Trust Score: {rec.get('trust_score', '')} | "
                f"AI Valuation: ${rec.get('predicted_valuation_usd', 0):,.0f} | "
                f"SHAP Reasoning: {rec.get('narrative_text', '')}")
        all_docs.append(text)
        all_ids.append(_doc_id("shap", i, text))
        all_metas.append({"source": "shap", "startup_name": str(rec.get("startup_name", ""))})

    # 4. Hype anomaly flags
    flags = _load_json_records(INDEX_SOURCES["hype"], ["flags"])
    print(f"  Hype flags: {len(flags):,} records")
    for i, rec in enumerate(flags):
        label = rec.get("classification", "UNKNOWN")
        text = (f"Startup: {rec.get('startup_name', '')} | "
                f"Anomaly Classification: {label} | "
                f"Disconnect Ratio: {rec.get('disconnect_ratio', '')} | "
                f"Trust Score: {rec.get('trust_score', '')} | "
                f"GitHub Velocity: {rec.get('github_velocity', '')} | "
                f"Alert: {rec.get('alert', 'None')}")
        all_docs.append(text)
        all_ids.append(_doc_id("hype", i, text))
        all_metas.append({"source": "hype", "startup_name": str(rec.get("startup_name", "")), "label": label})

    # 5. Stacked valuation predictions
    preds = _load_json_records(INDEX_SOURCES["stacked"], ["predictions"])
    print(f"  Stacked predictions: {len(preds):,} records")
    for i, rec in enumerate(preds):
        text = (f"Startup: {rec.get('startup_name', '')} | "
                f"Stacked AI Valuation: ${rec.get('predicted_valuation_usd', 0):,.0f} | "
                f"XGBoost: ${rec.get('xgboost_prediction_usd', 0):,.0f} | "
                f"LightGBM: ${rec.get('lightgbm_prediction_usd', 0):,.0f} | "
                f"Model Confidence: {rec.get('model_confidence', '')}")
        all_docs.append(text)
        all_ids.append(_doc_id("pred", i, text))
        all_metas.append({"source": "stacked", "startup_name": str(rec.get("startup_name", ""))})

    if not all_docs:
        print("  [WARN] No documents loaded — check data paths.")
        return

    # Batch embed + upsert
    print(f"\n  Embedding {len(all_docs):,} chunks (batch=32) …")
    BATCH = 128
    for i in range(0, len(all_docs), BATCH):
        b_docs  = all_docs[i : i + BATCH]
        b_ids   = all_ids[i : i + BATCH]
        b_metas = all_metas[i : i + BATCH]
        b_embs  = embed(b_docs)
        coll.upsert(ids=b_ids, documents=b_docs, embeddings=b_embs, metadatas=b_metas)
        if (i // BATCH) % 10 == 0:
            print(f"  … {min(i + BATCH, len(all_docs)):,}/{len(all_docs):,} chunks indexed")

    print(f"\n  ✓ Index built: {coll.count():,} chunks stored in ChromaDB")


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve(query: str, top_k: int = TOP_K) -> list:
    """Retrieve top-k relevant chunks from the vector store."""
    coll   = get_collection()
    q_emb  = embed([query])
    result = coll.query(query_embeddings=q_emb, n_results=top_k, include=["documents", "metadatas", "distances"])
    docs   = result["documents"][0]
    metas  = result["metadatas"][0]
    dists  = result["distances"][0]
    return [{"text": d, "meta": m, "score": round(1 - dist, 4)} for d, m, dist in zip(docs, metas, dists)]


# ── LLM via Ollama ────────────────────────────────────────────────────────────

def _ollama_chat(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Send a prompt to local Ollama and return the response."""
    try:
        import ollama
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.1, "num_ctx": 4096},
        )
        return response["message"]["content"].strip()
    except ImportError:
        return _ollama_http(prompt, model)
    except Exception as e:
        return f"[Ollama error: {e}]\n\nContext was available but LLM is offline. Install Ollama: brew install ollama && ollama pull {model}"


def _ollama_http(prompt: str, model: str) -> str:
    """HTTP fallback for Ollama (no Python client needed)."""
    import json as _json
    try:
        import urllib.request
        data = _json.dumps({"model": model, "prompt": prompt, "stream": False}).encode()
        req  = urllib.request.Request(
            "http://localhost:11434/api/generate",
            data=data, method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            body = _json.loads(r.read())
            return body.get("response", "").strip()
    except Exception as e:
        return f"[Ollama HTTP error: {e}] — Is Ollama running? Run: ollama serve"


# ── RAG Pipeline ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the IntelliStake VC Auditor AI — a financial intelligence assistant
for the IntelliStake investment platform. You have access to data about:
- 50,000 Indian tech startups (trust scores, valuations, GitHub velocity, funding rounds)
- R.A.I.S.E. risk audit results (NONE/LOW/MEDIUM/HIGH severity)
- FinBERT sentiment analysis on 5,000 news headlines
- SHAP explainability narratives (why the AI scored each startup)
- Hype anomaly detection (HYPE_ANOMALY / LEGITIMATE / STAGNANT labels)
- Black-Litterman portfolio weights

Answer questions about the data clearly and concisely. Always ground your answers
in the provided context. If confidence is low, say so.
"""

def rag_answer(query: str, model: str = DEFAULT_MODEL) -> dict:
    """Full RAG pipeline: retrieve → augment prompt → LLM → return."""
    chunks = retrieve(query)
    context_text = "\n\n---\n\n".join(
        f"[Source: {c['meta'].get('source', '?')} | Relevance: {c['score']:.2f}]\n{c['text']}"
        for c in chunks
    )

    prompt = f"""{SYSTEM_PROMPT}

RETRIEVED CONTEXT (from IntelliStake knowledge base):
{context_text}

USER QUESTION:
{query}

Answer based on the above context. Be specific with startup names, numbers, and percentages.
"""

    answer = _ollama_chat(prompt, model=model)
    return {
        "query":    query,
        "answer":   answer,
        "sources":  [c["meta"].get("source", "?") for c in chunks],
        "chunks_used": len(chunks),
        "model":    model,
        "timestamp":datetime.now(timezone.utc).isoformat(),
    }


# ── Session Logger ────────────────────────────────────────────────────────────

_session_log = []

def log_qa(qa: dict):
    _session_log.append(qa)
    SESSION_LOG.write_text(json.dumps(_session_log, indent=2))


# ── CLI Interface ─────────────────────────────────────────────────────────────

def interactive_loop(model: str = DEFAULT_MODEL):
    print("\n" + "=" * 60)
    print("  IntelliStake VC Auditor Chatbot")
    print(f"  Model: {model} via Ollama | Vector store: ChromaDB")
    print("  Type 'quit' or 'exit' to stop | 'clear' to clear screen")
    print("=" * 60)
    print("\nExample questions:")
    print("  • Which fintech startups have trust score above 0.8?")
    print("  • Why was Zepto flagged by SHAP?")
    print("  • Show me hype anomaly startups with high disconnect ratios")
    print("  • What is the AI predicted valuation for the top portfolio startup?")
    print("  • Which startup had the most negative FinBERT sentiment?\n")

    while True:
        try:
            query = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n  Goodbye!")
            break

        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            print("  Goodbye!")
            break
        if query.lower() == "clear":
            os.system("clear")
            continue

        print("\nAI Auditor: ", end="", flush=True)
        qa = rag_answer(query, model=model)
        print(qa["answer"])
        print(f"\n  [Sources: {', '.join(set(qa['sources']))} | Chunks: {qa['chunks_used']}]\n")
        log_qa(qa)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="IntelliStake VC Auditor RAG Chatbot")
    parser.add_argument("--query",   type=str, default=None, help="Single query (non-interactive mode)")
    parser.add_argument("--model",   type=str, default=DEFAULT_MODEL, help=f"Ollama model (default: {DEFAULT_MODEL})")
    parser.add_argument("--reindex", action="store_true", help="Force rebuild the vector index")
    args = parser.parse_args()

    # Build/load index
    build_index(force=args.reindex)

    coll = get_collection()
    if coll.count() == 0:
        print("\n  [ERROR] Vector store is empty. Check data files exist in unified_data/")
        sys.exit(1)

    print(f"\n  Knowledge base ready: {coll.count():,} chunks indexed")

    if args.query:
        # Single-query mode
        print(f"\nQuery: {args.query}\n")
        qa = rag_answer(args.query, model=args.model)
        print(f"Answer:\n{qa['answer']}")
        print(f"\n[Sources: {', '.join(set(qa['sources']))} | Model: {qa['model']}]")
        log_qa(qa)
    else:
        # Interactive mode
        interactive_loop(model=args.model)


if __name__ == "__main__":
    main()
