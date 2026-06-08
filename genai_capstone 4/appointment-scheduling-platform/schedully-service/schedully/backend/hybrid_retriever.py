"""
Stage 3a — Hybrid Retriever
Runs BM25 (keyword) + FAISS (semantic) retrieval for each sub-query,
scoped strictly to the current tenant's chunks.
Deduplication and RRF fusion happen downstream in reranker.py.
"""

from dataclasses import dataclass

import faiss
import numpy as np
import math
from rank_bm25 import BM25Okapi

class PositiveBM25(BM25Okapi):
    def _calc_idf(self, nd):
        for word, freq in nd.items():
            self.idf[word] = math.log(1.0 + (self.corpus_size - freq + 0.5) / (freq + 0.5))

from schedully.backend.corpus_engineer import (
    load_or_create_index,
    get_embed_model,
    EMBEDDING_DIM,
)

# Shared KB tenant — product knowledge base accessible to all users
SHARED_KB_TENANT = "SCHEDULLY_KB"


@dataclass
class RetrievalResult:
    source: str
    text: str
    score: float
    retrieval_method: str   # "bm25" | "faiss"
    chunk_index: int = 0
    doc_id: str = ""
    tenant_id: str = ""


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + lowercase + strip punctuation tokenizer for BM25."""
    import re
    # Remove punctuation except hyphens/underscores to preserve keys/dates
    clean_text = re.sub(r"[^\w\s-]", " ", text.lower())
    return clean_text.split()


def hybrid_retrieve(
    sub_queries: list[str],
    tenant_id: str,
    top_k: int = 8,
) -> list[RetrievalResult]:
    """
    Run BM25 and FAISS retrieval for each sub-query, scoped to tenant_id.

    Returns raw (un-fused) results from both methods for all sub-queries.
    RRF fusion and cross-encoder reranking happen in reranker.py.
    """
    index, all_chunks = load_or_create_index()

    # Scope chunks strictly based on mode (SHARED_KB_TENANT for normal, custom tenant for RAG)
    if tenant_id == SHARED_KB_TENANT:
        tenant_chunks = [
            c for c in all_chunks
            if c.get("tenant_id") == SHARED_KB_TENANT
        ]
    else:
        tenant_chunks = [
            c for c in all_chunks
            if c.get("tenant_id") == tenant_id
        ]
    if not tenant_chunks:
        return []

    results: list[RetrievalResult] = []

    for query in sub_queries:
        # ── BM25 ───────────────────────────────────────────────────────────────
        corpus = [_tokenize(c["text"]) for c in tenant_chunks]
        bm25 = PositiveBM25(corpus)
        bm25_scores = bm25.get_scores(_tokenize(query))

        top_bm25_indices = np.argsort(bm25_scores)[::-1][:top_k]
        for idx in top_bm25_indices:
            score = float(bm25_scores[idx])
            if score <= 0:
                continue
            c = tenant_chunks[idx]
            results.append(RetrievalResult(
                source=c["source"],
                text=c["text"],
                score=score,
                retrieval_method="bm25",
                chunk_index=c.get("chunk_index", 0),
                doc_id=c.get("doc_id", ""),
                tenant_id=c.get("tenant_id", ""),
            ))

        # ── FAISS vector search ────────────────────────────────────────────────
        # Full search then post-filter by tenant_id (IndexFlatL2 doesn't support
        # native filtered search)
        model = get_embed_model()
        query_vec = model.encode([query]).astype("float32")

        k_search = min(top_k * 3, index.ntotal)
        if k_search == 0:
            continue

        distances, faiss_ids = index.search(query_vec, k_search)

        # Build lookup: faiss_id → chunk
        faiss_id_to_chunk = {c.get("faiss_id", i): c for i, c in enumerate(all_chunks)}

        faiss_count = 0
        for j, fid in enumerate(faiss_ids[0]):
            if fid < 0:
                continue
            chunk = faiss_id_to_chunk.get(int(fid))
            if chunk is None:
                continue
            if tenant_id == SHARED_KB_TENANT:
                if chunk.get("tenant_id") != SHARED_KB_TENANT:
                    continue
            else:
                if chunk.get("tenant_id") != tenant_id:
                    continue
            results.append(RetrievalResult(
                source=chunk["source"],
                text=chunk["text"],
                score=float(distances[0][j]),   # L2 distance — lower = better
                retrieval_method="faiss",
                chunk_index=chunk.get("chunk_index", 0),
                doc_id=chunk.get("doc_id", ""),
                tenant_id=chunk.get("tenant_id", ""),
            ))
            faiss_count += 1
            if faiss_count >= top_k:
                break

    return results
