"""
Schedully REST API Router
Registers under prefix /api/schedully in backend/main.py.

Endpoints:
  POST   /api/schedully/chat                  — main chat (all roles)
  POST   /api/schedully/ingest                — upload + ingest doc (provider, admin)
  GET    /api/schedully/provider/certificates — auto-ingest cert files (provider only)
  GET    /api/schedully/kb/list               — list ingested docs
  DELETE /api/schedully/kb/doc/{doc_id}       — delete a doc from vector store

Auth: Depends(get_current_user) from backend/middleware/auth.py
      JWT payload: {id, role, email}
Response envelope: success_response / error_response from backend/utils/response.py
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

# ── Imports from the main backend (the 3 unavoidable dependencies) ─────────────
from config.database import get_db
from middleware.auth import get_current_user
from utils.response import success_response, error_response

# ── Schedully internal imports ─────────────────────────────────────────────────
from schedully.backend.corpus_engineer import (
    ingest_file,
    ingest_provider_certificates,
    list_documents,
    delete_document,
    STAGING_DIR,
)
from schedully.backend.orchestrator import chat
from schedully.backend.memory import get_or_create_memory, get_user_sessions

router = APIRouter(prefix="/api/schedully", tags=["Schedully"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".md", ".txt"}
MAX_FILE_SIZE_MB    = 20


# ── Request schema ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    session_id: str
    mode:       str = "normal"  # "normal" | "rag"


# ── POST /api/schedully/chat ───────────────────────────────────────────────────

@router.post("/chat")
async def schedully_chat(
    body: ChatRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Main chat endpoint. Available to: provider, admin, customer.

    Role capabilities:
      provider / admin → full access: retrieval + live API tools
      customer         → KB and ingested-doc retrieval only
                         (live tool intents downgraded to KB in planner)

    tenant_id = current_user["id"]  — each user's vector corpus is isolated.
    """
    if not body.message or not body.message.strip():
        return error_response("Message cannot be empty", 400)
    if len(body.message) > 2000:
        return error_response("Message too long (max 2000 characters)", 400)
    if not body.session_id or len(body.session_id) > 128:
        return error_response("Invalid session_id", 400)

    # Extract Bearer token — mirrors the logic in middleware/auth.py
    auth_header  = request.headers.get("Authorization", "")
    bearer_token = (
        auth_header.split(" ")[1]
        if auth_header.startswith("Bearer ")
        else ""
    )
    if not bearer_token:
        bearer_token = request.cookies.get("token", "")

    tenant_id = current_user["id"]
    user_id   = current_user["id"]
    user_role = current_user.get("role", "customer")
    mode      = body.mode if body.mode in ("normal", "rag") else "normal"

    user_session_key = f"user:{user_id}:{body.session_id}:{mode}"
    memory = get_or_create_memory(user_session_key)

    result = await chat(
        user_message=body.message.strip(),
        session_memory=memory,
        tenant_id=tenant_id,
        user_id=user_id,
        user_role=user_role,
        bearer_token=bearer_token,
        mode=mode,
    )

    return success_response(result, "Chat response generated")


# ── GET /api/schedully/sessions ────────────────────────────────────────────────

@router.get("/sessions") # force recompile cache
def list_sessions(
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    """List all chat sessions for the current user + mode."""
    user_id = current_user["id"]
    sessions = get_user_sessions(user_id, mode)
    return success_response({"sessions": sessions}, "Sessions listed")


# ── POST /api/schedully/ingest ─────────────────────────────────────────────────

@router.post("/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload and ingest a document into the vector store.

    Supported formats: .pdf, .docx, .xlsx
    ACL: provider, admin only (customers get HTTP 403)

    Primary use cases:
      - Provider uploads their monthly schedule XLSX exported from
        /provider/insights → "Export Schedule" button
        (served by Node.js report-service at GET /reports/provider/{id}/schedule)
      - Admin uploads appointments/users/providers XLSX from admin pages
      - Any provider/admin uploads a relevant PDF/DOCX

    The temp file is deleted immediately after ingest regardless of outcome.
    """
    user_role = current_user.get("role", "customer")
    if user_role == "customer":
        return error_response("Customers cannot upload documents", 403)

    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        return error_response(
            f"Unsupported file type '{ext}'. Allowed: .pdf .docx .xlsx", 400
        )

    content  = await file.read()
    size_mb  = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        return error_response(
            f"File too large ({size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB.",
            413,
        )

    # Stage to temp path inside schedully/backend/uploads/
    safe_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = str(STAGING_DIR / safe_name)
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        result = ingest_file(
            file_path=temp_path,
            tenant_id=current_user["id"],
            original_filename=original_name,
        )
    except (ValueError, ImportError, RuntimeError) as exc:
        return error_response(str(exc), 400)
    finally:
        # Always clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return success_response(result, "Document ingested successfully")


# ── GET /api/schedully/provider/certificates ────────────────────────────────────

@router.get("/provider/certificates")
def ingest_provider_certificates_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Auto-ingest the signed-in provider's certificate/licence files.

    Reads certificates_urls from the provider_onboarding table.
    The field is a comma-separated string of file paths:
        /uploads/provider_onboarding/<uuid>.pdf

    Files are resolved to absolute disk paths under
    backend/uploads/provider_onboarding/ — the same directory where
    POST /auth/upload-onboarding-file writes them.

    EXPLICITLY EXCLUDED (never read or ingested):
      - identity_proof_url
      - profile_photo_url

    ACL: provider only
    """
    if current_user.get("role") != "provider":
        return error_response("Only providers can ingest their certificates", 403)

    # Local imports to avoid circular deps at module load time
    from models.service_provider import ServiceProvider
    from models.provider_onboarding import ProviderOnboarding

    provider = (
        db.query(ServiceProvider)
        .filter(ServiceProvider.user_id == current_user["id"])
        .first()
    )
    if not provider:
        return error_response("Provider profile not found", 404)

    onboarding = (
        db.query(ProviderOnboarding)
        .filter(ProviderOnboarding.provider_id == provider.id)
        .first()
    )

    if not onboarding or not onboarding.certificates_urls:
        return success_response(
            {"results": [], "total_files": 0, "total_chunks_added": 0},
            "No certificate files found on this provider's profile",
        )

    results = ingest_provider_certificates(
        provider_id=provider.id,
        tenant_id=current_user["id"],
        certificates_urls=onboarding.certificates_urls,
    )

    total_chunks = sum(r.get("chunks_added", 0) for r in results)

    return success_response(
        {
            "results":            results,
            "total_files":        len(results),
            "total_chunks_added": total_chunks,
        },
        f"Certificate ingestion complete — {total_chunks} chunks added "
        f"across {len(results)} file(s)",
    )


# ── GET /api/schedully/history ────────────────────────────────────────────────

@router.get("/history")
def get_history(
    session_id: str,
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    """
    Return the stored conversation turns for the current user + session.
    Called when the widget opens so previous messages are restored.
    """
    user_id          = current_user["id"]
    user_session_key = f"user:{user_id}:{session_id}:{mode}"
    memory           = get_or_create_memory(user_session_key)
    from schedully.backend.memory import _sessions, _lock
    with _lock:
        session = _sessions.get(user_session_key)
        turns   = list(session["turns"]) if session else []
    return success_response({"turns": turns}, "History fetched")


# ── GET /api/schedully/sessions ───────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    """List all chat sessions for the current user and mode."""
    from schedully.backend.memory import get_user_sessions
    sessions = get_user_sessions(current_user["id"], mode)
    return success_response({"sessions": sessions}, "Sessions listed")


# ── GET /api/schedully/kb/list ─────────────────────────────────────────────────

@router.get("/kb/list")
def list_kb(current_user: dict = Depends(get_current_user)):
    """List all ingested documents for the current user's corpus."""
    docs = list_documents(current_user["id"])
    return success_response({"documents": docs}, "Knowledge base documents listed")


# ── DELETE /api/schedully/kb/doc/{doc_id} ──────────────────────────────────────

@router.delete("/kb/doc/{doc_id}")
def delete_kb_doc(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a document from the vector store.
    Scoped to current user — cannot delete another user's doc.
    """
    chunks_removed = delete_document(doc_id, current_user["id"])

    if chunks_removed == 0:
        return error_response("Document not found in your knowledge base", 404)

    return success_response(
        {"chunks_removed": chunks_removed},
        f"Document deleted ({chunks_removed} chunks removed)",
    )


# ── DELETE /api/schedully/sessions/{session_id} ─────────────────────────────────

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a specific conversation session and all its history.
    """
    from schedully.backend.memory import delete_user_session
    success = delete_user_session(current_user["id"], session_id, mode)
    if not success:
        return error_response("Session not found", 404)
    return success_response({}, "Conversation history deleted successfully")
