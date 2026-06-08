"""
Stage 4 — Fuse + Rerank
RRF (Reciprocal Rank Fusion) combines BM25 and FAISS ranked lists.
Cross-encoder reranks the top-N candidates for final precision.
Model: cross-encoder/ms-marco-MiniLM-L-6-v2 (local CPU, ~80 MB, no API key).
"""

from collections import defaultdict
from typing import Optional

from sentence_transformers import CrossEncoder

from schedully.backend.hybrid_retriever import RetrievalResult

# ── Cross-encoder singleton ────────────────────────────────────────────────────
_cross_encoder: Optional[CrossEncoder] = None
CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# ── Tuning constants ───────────────────────────────────────────────────────────
RRF_K         = 60   # standard RRF constant
TOP_N_RERANK  = 36   # candidates passed to cross-encoder
FINAL_TOP_K   = 24   # chunks returned to generator


def get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        _cross_encoder = CrossEncoder(CROSS_ENCODER_MODEL, max_length=512)
    return _cross_encoder


def rrf_score(rank: int, k: int = RRF_K) -> float:
    """Reciprocal Rank Fusion score: 1 / (k + rank)."""
    return 1.0 / (k + rank)


def fuse_and_rerank(
    retrieval_results: list[RetrievalResult],
    sub_queries: list[str],
) -> list[dict]:
    """
    Stage 4: RRF fusion of BM25 + FAISS results, then cross-encoder rerank.

    Returns list of context-item dicts compatible with tool_layer output:
        {source, text, score, retrieval_method, doc_id, tenant_id}
    """
    if not retrieval_results:
        return []

    # Separate by method and sort (BM25: higher=better; FAISS L2: lower=better)
    bm25_sorted  = sorted(
        [r for r in retrieval_results if r.retrieval_method == "bm25"],
        key=lambda r: r.score,
        reverse=True,
    )
    faiss_sorted = sorted(
        [r for r in retrieval_results if r.retrieval_method == "faiss"],
        key=lambda r: r.score,
        reverse=False,
    )

    # RRF: accumulate scores keyed by first 100 chars of text (dedup key)
    rrf_scores: dict[str, float]         = defaultdict(float)
    chunk_by_key: dict[str, RetrievalResult] = {}

    for rank, result in enumerate(bm25_sorted):
        key = result.text[:100]
        rrf_scores[key] += rrf_score(rank)
        chunk_by_key[key] = result

    for rank, result in enumerate(faiss_sorted):
        key = result.text[:100]
        rrf_scores[key] += rrf_score(rank)
        if key not in chunk_by_key:
            chunk_by_key[key] = result

    # Sort by RRF score and take top-N for cross-encoder
    ranked_keys    = sorted(rrf_scores.keys(), key=lambda k: rrf_scores[k], reverse=True)
    top_candidates = [chunk_by_key[k] for k in ranked_keys[:TOP_N_RERANK]]

    if not top_candidates:
        return []

    # Cross-encoder rerank using the primary sub-query
    rerank_query = sub_queries[0] if sub_queries else ""
    encoder  = get_cross_encoder()
    pairs    = [(rerank_query, c.text) for c in top_candidates]
    ce_scores = encoder.predict(pairs)   # numpy array of floats

    scored = sorted(zip(top_candidates, ce_scores), key=lambda x: x[1], reverse=True)

    return [
        {
            "source":           r.source,
            "text":             r.text,
            "score":            float(ce),
            "retrieval_method": "reranked",
            "doc_id":           r.doc_id,
            "tenant_id":        r.tenant_id,
        }
        for r, ce in scored[:FINAL_TOP_K]
    ]
