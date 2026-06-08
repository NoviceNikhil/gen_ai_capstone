---
name: rag-builder-skill
description: Technical instructions and patterns for constructing and modifying the Schedully RAG (Retrieval-Augmented Generation) pipeline. Includes document parsing, recursive character chunking, double-tier deduplication, FAISS indexing, hybrid BM25 + vector search, and RRF + Cross-Encoder reranking.
license: MIT
---

# RAG Builder Skill

Guidelines and patterns for building or refactoring the Schedully RAG pipeline.

## 1. Document Parsing & Text Extraction
Support multiple file formats up to a strict limit of **20 MB** per upload.
- **PDF Extraction**: Use `pypdf.PdfReader`. Reject scanned PDFs lacking extractable text with a descriptive validation error.
- **DOCX Extraction**: Use `python-docx` for paragraphs and cell-level table extraction.
- **XLSX Extraction**: Use `openpyxl`. Convert tabular sheets into readable key-value sentences (e.g., `"ColumnA: Value, ColumnB: Value"`) for natural-language semantic match.
- **Text/Markdown**: Read directly using UTF-8 decoding.

## 2. Text Normalization, Chunking & Deduplication
- **Whitespace Normalization**: Normalize line endings (`\r\n` to `\n`), collapse consecutive spacing/tabs, and strip lone page numbers.
- **Text Splitting**: Use `langchain_text_splitters.RecursiveCharacterTextSplitter`.
  - Set `chunk_size` to **8000** characters and `chunk_overlap` to **800** characters.
  - Set separators to `["\n\n", "\n", " ", ""]`.
- **Double-Tier Deduplication (Scoped by Tenant)**:
  1. Compute a SHA-256 fingerprint of the entire document. If it exists in the index for the same `tenant_id`, skip the entire upload.
  2. Compute a SHA-256 fingerprint for each individual chunk. Skip redundant chunk insertions for the same `tenant_id`.

## 3. Storage and Embeddings
- **Vector Embeddings**: Use the local `all-MiniLM-L6-v2` model (384 dimensions, float32 vectors).
- **Index**: Use FAISS (`faiss.IndexFlatL2`) to index dense vectors.
- **Persistence**: Store the indexed vectors in a binary `faiss.index` file and map metadata/raw text in a JSON structured `chunks.json` file.

## 4. Hybrid Retrieval Pipeline
Query execution must retrieve candidate context matching the query keywords and semantic context:
- **BM25 Search**: Use `rank_bm25.BM25Okapi` with Jaccard tokenization. Wrap in a custom retriever that overrides the IDF formula to ensure positive results:
  $$\text{IDF}(q_i) = \ln\left(1.0 + \frac{N - n(q_i) + 0.5}{n(q_i) + 0.5}\right)$$
- **FAISS Vector Search**: Encode the query, perform L2 search, and post-filter candidates in memory to only include chunks matching the active `tenant_id`.
- **RRF (Reciprocal Rank Fusion)**: Merge BM25 and FAISS results using the formula:
  $$\text{RRF\_Score}(d) = \sum_{m \in \text{RetrievalMethods}} \frac{1}{k + \text{rank}_m(d)}$$
  - Set constant $k = 60$.
  - Pull the top **36** candidates sorted by RRF score for reranking.
- **Cross-Encoder Reranking**: Run the top 36 candidates through `cross-encoder/ms-marco-MiniLM-L-6-v2` against the main sub-query. Return the top **24** chunks as final context.
