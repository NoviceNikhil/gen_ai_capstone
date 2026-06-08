"""
KB Loader — ingest schedully_kb.md into the vector store at startup.

Called once from backend/main.py lifespan on the first run.
Subsequent calls are no-ops because ingest_file() checks the doc fingerprint
and skips if it's already indexed.

The KB is stored under a special tenant_id "SCHEDULLY_KB" so it is
accessible to all users during retrieval — hybrid_retriever.py queries
both the user's own corpus AND the shared KB tenant.
"""

from pathlib import Path
from schedully.backend.corpus_engineer import ingest_file

KB_PATH     = Path(__file__).resolve().parent / "kb" / "schedully_kb.md"
KB_TENANT   = "SCHEDULLY_KB"   # shared across all users
KB_FILENAME = "schedully_product_kb.md"


def load_kb() -> None:
    """
    Ingest the product knowledge base markdown file.
    Safe to call multiple times — deduplication skips re-ingestion.
    """
    if not KB_PATH.exists():
        print(f"[schedully] KB file not found at {KB_PATH} — skipping KB load.")
        return

    try:
        result = ingest_file(
            file_path=str(KB_PATH),
            tenant_id=KB_TENANT,
            original_filename=KB_FILENAME,
        )
        if result.get("chunks_added", 0) > 0:
            print(
                f"[schedully] KB loaded: {result['chunks_added']} chunks indexed "
                f"from {KB_FILENAME}"
            )
        else:
            print(f"[schedully] KB already indexed — skipped re-ingestion.")
    except Exception as exc:
        print(f"[schedully] KB load failed: {exc}")
