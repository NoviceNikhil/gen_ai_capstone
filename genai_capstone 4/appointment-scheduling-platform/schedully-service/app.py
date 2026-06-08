"""
Schedully RAG Chatbot — Standalone FastAPI service for Hugging Face Spaces.

This is a self-contained deployment of the Schedully chatbot that runs
independently from the main backend. The main backend proxies
/api/schedully/* requests here.

Auth: Validates JWT tokens using the same secret as the main backend.
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add parent so we can import schedully package
sys.path.insert(0, str(Path(__file__).resolve().parent))

from auth import get_current_user
from response import success_response, error_response

# ── Schedully imports ──────────────────────────────────────────────────────────
from schedully.backend.orchestrator import chat
from schedully.backend.memory import get_or_create_memory, get_user_sessions, delete_user_session
from schedully.backend.corpus_engineer import (
    ingest_file, list_documents, delete_document, STAGING_DIR,
)
from schedully.backend.kb_loader import load_kb


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load KB on startup."""
    load_kb()
    print("  Schedully service ready")
    yield
    print("  Schedully service shutting down")


app = FastAPI(
    title="Schedully RAG Chatbot Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request schemas ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str
    mode: str = "normal"


# ── Endpoints (mirror the original router paths) ──────────────────────────────

@app.post("/api/schedully/chat")
async def schedully_chat(
    body: ChatRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if not body.message or not body.message.strip():
        return error_response("Message cannot be empty", 400)
    if len(body.message) > 2000:
        return error_response("Message too long (max 2000 characters)", 400)
    if not body.session_id or len(body.session_id) > 128:
        return error_response("Invalid session_id", 400)

    auth_header = request.headers.get("Authorization", "")
    bearer_token = (
        auth_header.split(" ")[1] if auth_header.startswith("Bearer ") else ""
    )
    if not bearer_token:
        bearer_token = request.cookies.get("token", "")

    tenant_id = current_user["id"]
    user_id = current_user["id"]
    user_role = current_user.get("role", "customer")
    mode = body.mode if body.mode in ("normal", "rag") else "normal"

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


@app.get("/api/schedully/sessions")
def list_sessions_endpoint(
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    sessions = get_user_sessions(current_user["id"], mode)
    return success_response({"sessions": sessions}, "Sessions listed")


@app.get("/api/schedully/history")
def get_history(
    session_id: str,
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    user_session_key = f"user:{user_id}:{session_id}:{mode}"
    get_or_create_memory(user_session_key)
    from schedully.backend.memory import _sessions, _lock
    with _lock:
        session = _sessions.get(user_session_key)
        turns = list(session["turns"]) if session else []
    return success_response({"turns": turns}, "History fetched")


@app.delete("/api/schedully/sessions/{session_id}")
def delete_session(
    session_id: str,
    mode: str = "normal",
    current_user: dict = Depends(get_current_user),
):
    success = delete_user_session(current_user["id"], session_id, mode)
    if not success:
        return error_response("Session not found", 404)
    return success_response({}, "Conversation history deleted successfully")


@app.get("/api/schedully/kb/list")
def list_kb(current_user: dict = Depends(get_current_user)):
    docs = list_documents(current_user["id"])
    return success_response({"documents": docs}, "Knowledge base documents listed")


@app.delete("/api/schedully/kb/doc/{doc_id}")
def delete_kb_doc(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    chunks_removed = delete_document(doc_id, current_user["id"])
    if chunks_removed == 0:
        return error_response("Document not found in your knowledge base", 404)
    return success_response(
        {"chunks_removed": chunks_removed},
        f"Document deleted ({chunks_removed} chunks removed)",
    )


@app.get("/")
def health():
    return {"status": "ok", "service": "Schedully RAG Chatbot", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
