# Schedully RAG Implementation

This document details the exact technical implementation, libraries, algorithms, and data flows used in Schedully's Retrieval-Augmented Generation (RAG) system.

---

## 1. Document Ingestion & Parsing (`corpus_engineer.py`)
The system supports `.pdf`, `.docx`, `.xlsx`, `.md`, and `.txt` files up to a size limit of **20 MB**. Document ingestion converts raw file binaries into unified text chunks.

### Supported Parsers & Libraries
- **PDF Extraction**: Done via `pypdf` (`PdfReader`). Scanned PDFs (lacking an embeddable text layer) are rejected.
- **DOCX Extraction**: Done via `python-docx` (`DocxDocument`), extracting text paragraphs and cell-level content from tables.
- **XLSX Extraction**: Done via `openpyxl`. XLSX files (typically generated from the Node.js report-service) are converted from raw cell blocks into readable natural-language sentences.
  - *Mechanism*: The sheet's columns are treated as headers. Each row is parsed into a structured, key-value sentence (e.g., `"Provider Name: Dr. Smith, Specialization: Dentist, Location: Hyderabad, Average Rating: 4.5"`). This format allows both the BM25 retriever and the generation LLM to perform semantic reasoning over tabular structures.

---

## 2. Text Normalization, Chunking & Deduplication

### Canonicalization
Whitespace is normalized: carriage returns are replaced with single newlines, three or more consecutive newlines are compressed to double newlines, spaces/tabs are collapsed, and page-number-only lines are removed.

### Text Splitting
- **Library**: `langchain_text_splitters.RecursiveCharacterTextSplitter`.
- **Hyperparameters**:
  - `CHUNK_SIZE`: **8000 characters** (optimized for long-context semantic blocks).
  - `CHUNK_OVERLAP`: **800 characters** (prevents loss of context at chunk boundaries).
  - `SEPARATORS`: `["\n\n", "\n", " ", ""]` (splits on paragraphs first, then sentences/words).

### Double-Tier Deduplication
1. **Document-Level Deduplication**: The system computes a SHA-256 fingerprint of the normalized text. If an identical document exists in the index for the same `tenant_id`, the entire ingestion is bypassed.
2. **Chunk-Level Deduplication**: Each chunk's text is hashed. If the chunk hash already exists for that `tenant_id`, it is skipped, preventing redundant embedding operations.

---

## 3. Vector Database & Storage
- **Embedding Model**: `SentenceTransformer("all-MiniLM-L6-v2")` running locally.
  - Dimensions: **384**
  - Type: `float32`
- **Vector Index**: FAISS (`faiss.IndexFlatL2`), which performs L2 (Euclidean) distance search.
- **Metadata Persistence**:
  - `faiss.index`: Holds raw dense embeddings on disk.
  - `chunks.json`: A JSON list containing block details:
    ```json
    {
      "source": "filename.pdf",
      "chunk_index": 0,
      "text": "...",
      "fingerprint": "sha256_hash",
      "doc_id": "document_hash",
      "tenant_id": "tenant_or_shared_kb_id",
      "ingest_ts": 1780582825,
      "faiss_id": 0
    }
    ```

---

## 4. The Retrieval Pipeline (`hybrid_retriever.py`)
Retrieval is scoped strictly to either a specific workspace `tenant_id` (for provider-specific document Q&A) or the shared database `SCHEDULLY_KB` (for customer-facing platform policy/FAQs).

### Step 1: BM25 (Keyword Retrieval)
- **Library**: `rank_bm25.BM25Okapi` wrapped in a custom `PositiveBM25` class.
- **IDF Formula**: To prevent negative IDF weights (common in default BM25 implementation for terms occurring in >50% of documents), a modified positive IDF function is applied:
  $$\text{IDF}(q_i) = \ln\left(1.0 + \frac{N - n(q_i) + 0.5}{n(q_i) + 0.5}\right)$$
- **Tokenization**: Lowercases, strips punctuation (preserving hyphens and underscores to keep names/dates intact), and splits by whitespace.
- **Top Candidates**: Returns the top $K$ scoring chunks ($K$ defaults to 8).

### Step 2: Dense Semantic Retrieval (FAISS)
- **Mechanism**: The user's query is embedded using `all-MiniLM-L6-v2`.
- **Post-Filtering**: Since FAISS `IndexFlatL2` lacks native metadata filtering, the system retrieves $3 \times K$ candidates and post-filters them in memory to only include chunks matching the active `tenant_id`. It keeps the top $K$ filtered candidates.

---

## 5. Fusion & Reranking (`reranker.py`)

- **Reciprocal Rank Fusion (RRF)**: To merge keyword matches and semantic matches, the system calculates an RRF score for each unique chunk:
  $$\text{RRF\_Score}(d \in D) = \sum_{m \in M} \frac{1}{k + \text{rank}_m(d)}$$
  - Constant ($k$): **60**
  - Candidates Evaluated: The top **36** candidates sorted by RRF score are forwarded to the cross-encoder.
- **Cross-Encoder Reranking**:
  - **Model**: `cross-encoder/ms-marco-MiniLM-L-6-v2` (runs locally, no external API key).
  - **Function**: Takes the query and candidate chunk text pairs, predicts the semantic relevance score, and sorts the chunks.
  - **Output**: The top **24** reranked chunks are returned to the generator as context.
