# Schedully RAG Chatbot Skill

## Overview
This skill captures all knowledge, decisions, patterns, and gotchas from building the Schedully RAG chatbot inside the SIGCAL appointment scheduling platform. Use this when working on, extending, or debugging the chatbot.

---

## Project Structure

```
appointment-scheduling-platform/
├── schedully/                          ← ALL chatbot code lives here (self-contained)
│   ├── __init__.py
│   ├── requirements.txt
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── corpus_engineer.py          ← Stage 0: parse/chunk/embed/FAISS
│   │   ├── planner.py                  ← Stage 1: intent classify via OpenRouter
│   │   ├── orchestrator.py             ← Stage 2: parallel dispatch + repair loop
│   │   ├── hybrid_retriever.py         ← Stage 3a: BM25 + FAISS dual search
│   │   ├── tool_layer.py               ← Stage 3b: live GET calls to platform API
│   │   ├── reranker.py                 ← Stage 4: RRF fusion + cross-encoder
│   │   ├── verifier.py                 ← Stage 5: grounding/coverage checks
│   │   ├── generator.py                ← Stage 6: GLM-4.7-flash + citations
│   │   ├── memory.py                   ← Session memory, 20-turn cap, 1hr TTL
│   │   ├── router.py                   ← FastAPI endpoints + ACL
│   │   ├── kb_loader.py                ← Ingests KB at startup
│   │   ├── kb/schedully_kb.md          ← Product knowledge base
│   │   ├── index/.gitkeep             ← faiss.index + chunks.json written at runtime
│   │   └── uploads/.gitkeep           ← Temp staging, deleted after ingest
│   └── frontend/
│       └── SchedullyChatWidget.jsx     ← Original source (do NOT import from here)
│
├── frontend/src/components/
│   └── SchedullyChatWidget.jsx         ← ACTUAL widget used by the app (correct imports)
│
└── backend/                            ← Existing app — minimal touches only
    ├── main.py                         ← 3 chatbot additions (marked with comments)
    ├── config/settings.py              ← 3 new env vars added
    ├── requirements.txt                ← 8 new deps added
    └── .env                            ← 3 new API key entries added
```

---

## Architecture: RAG Pipeline

```
User Query
  → Memory (session context carry-forward)
  → Stage 1: Planner (intent classify, sub-query decompose)
  → Stage 2: Orchestrator (parallel dispatch)
       ├── Stage 3a: Hybrid Retriever (BM25 + FAISS)  ← runs in parallel
       └── Stage 3b: Tool Layer (live API GET calls)   ← runs in parallel
  → Stage 4: Fuse + Rerank (RRF + cross-encoder)
  → Stage 5: Verify (grounding/contradiction/coverage)
       └── IF weak → repair loop (widen top_k, retry, max 2 times)
  → Stage 6: Generate + Cite ([Source N] citations)
  → Final Answer
```

---

## Critical Bug: API Key Not Found

**Root Cause:** `planner.py` and `generator.py` use `os.environ.get("OPENROUTER_API_KEY")`. But pydantic's `Settings` class uses `@lru_cache` and is instantiated before the schedully modules load, so `os.environ` never gets populated with values from `.env`.

**Fix — read .env directly:**

```python
# In both planner.py and generator.py
def _get_api_key() -> str:
    env_path = Path(__file__).resolve().parents[2] / "backend" / ".env"
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENROUTER_API_KEY="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return os.environ.get("OPENROUTER_API_KEY", "")
```

The path `parents[2]` from `schedully/backend/planner.py` resolves to `appointment-scheduling-platform/`, then `/ "backend" / ".env"` points to the correct file.

**Never use `os.environ.get()` directly for API keys in schedully modules.** Always use `_get_api_key()`.

---

## Critical Bug: Module Not Found (`schedully`)

**Root Cause:** `main.py` is in `backend/`. Python only searches `backend/` for imports. `schedully/` is a sibling of `backend/`, not inside it.

**Fix — add to sys.path in main.py before the import:**

```python
# ── chatbot changes start ─────────────────────────────────────────────────────
import sys
from pathlib import Path as _Path
_schedully_parent = str(_Path(__file__).resolve().parents[1])
if _schedully_parent not in sys.path:
    sys.path.insert(0, _schedully_parent)
from schedully.backend.router import router as schedully_router
# ── chatbot changes end ───────────────────────────────────────────────────────
```

`parents[1]` from `backend/main.py` = `appointment-scheduling-platform/`, which is the parent of `schedully/`.

---

## Critical Bug: Widget Not Visible / Page Reload Required

**Root Cause:** The widget file in `schedully/frontend/SchedullyChatWidget.jsx` had the import:
```js
import api from "../../frontend/src/services/axios";
```
This path is wrong when Vite bundles it. The import fails silently, crashes the component, and React's error recovery only resolves on hard reload.

**Fix:** The widget must live inside `frontend/src/components/` and use a simple relative import:
```js
import api from "../services/axios";
```

The file `frontend/src/components/SchedullyChatWidget.jsx` is the authoritative copy. The file in `schedully/frontend/` is just a reference backup — **never import from it in App.jsx**.

**App.jsx import (correct):**
```jsx
import SchedullyChatWidget from "./components/SchedullyChatWidget";
```

---

## Installing Dependencies

All chatbot Python deps must go into the **myenv virtualenv**, NOT the system Python.

```bash
# Always use the venv's pip explicitly:
myenv/bin/pip install faiss-cpu pypdf python-docx openpyxl sentence-transformers langchain-text-splitters "rank-bm25==0.2.2" openai httpx

# Or via the requirements file:
myenv/bin/pip install -r ../schedully/requirements.txt
```

**Why this matters:** Running `pip install` without `myenv/bin/pip` installs into the system Python at `/Library/Frameworks/Python.framework/...`. uvicorn uses `myenv`, so it will never find system-installed packages.

---

## Existing Files Touched — Change Markers

Every change to an existing file is wrapped with comment markers for easy identification and reversal:

```python
# ── chatbot changes start ─────────────────────────────────────────────────────
<added code>
# ── chatbot changes end ───────────────────────────────────────────────────────
```

**Files modified:**
| File | What was added |
|---|---|
| `backend/main.py` | sys.path fix + router import, KB loader in lifespan, app.include_router |
| `backend/config/settings.py` | OPENROUTER_API_KEY, NVIDIA_API_KEY, PLATFORM_BASE_URL fields |
| `backend/requirements.txt` | 8 new pip packages |
| `backend/.env` | 3 new API key entries |
| `frontend/src/App.jsx` | Widget import + `<SchedullyChatWidget />` mount |
| `frontend/vite.config.js` | `@schedully` alias (for reference — not actively used) |

---

## Seeding: No Drop Required

The existing `backend/seeding/seed.py` does NOT require dropping the database. Use `--reset-demo` flag instead:

```bash
python seeding/seed.py --reset-demo
```

- `--reset-demo` deletes only demo-tagged data (emails ending in `@app-demo.com`, appointments with `[DEMO:` marker in notes)
- Without the flag: upserts everything safely — no duplicates
- Drop DB only needed after SQLAlchemy model schema changes

---

## API Endpoints (All Confirmed Against Real Routers)

### Chatbot endpoints (new)
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/schedully/chat` | all | Main chat |
| POST | `/api/schedully/ingest` | provider, admin | Upload + ingest PDF/DOCX/XLSX |
| GET | `/api/schedully/provider/certificates` | provider | Auto-ingest cert files from onboarding |
| GET | `/api/schedully/history` | all | Load conversation history |
| GET | `/api/schedully/kb/list` | all | List ingested docs |
| DELETE | `/api/schedully/kb/doc/{doc_id}` | all | Delete a doc |

### Platform endpoints used by tool layer (confirmed from actual routers)
| Tool | Provider | Admin | Customer |
|---|---|---|---|
| get_appointments | GET /api/provider/appointments | GET /api/admin/appointments | GET /api/customer/appointments |
| get_providers | GET /api/customer/providers | GET /api/admin/providers | GET /api/customer/providers |
| get_slots | GET /api/provider/slots?date= | — | — |
| get_dashboard | GET /api/provider/dashboard | GET /api/admin/dashboard | GET /api/customer/dashboard |
| get_availability | GET /api/availability | — | — |
| get_reviews | GET /api/provider/reviews | — | — |

**Query params confirmed:**
- Appointments: `status`, `from_date`, `to_date`, `page`, `limit`
- Providers: `search`, `category_id`, `location`, `min_rating`, `page`, `limit`

---

## Response Envelope

All chatbot endpoints return the standard platform envelope:
```json
{ "success": true, "message": "...", "data": {...}, "error": null }
```

Use `success_response(data, message)` and `error_response(message, status_code)` from `utils/response.py`.

---

## Auth Pattern

```python
from middleware.auth import get_current_user

# JWT payload: { "id": "<uuid>", "role": "provider|admin|customer|organization", "email": "..." }
current_user: dict = Depends(get_current_user)
```

Token is read from `Authorization: Bearer <token>` header first, then `token` httpOnly cookie as fallback.

---

## Tenant Isolation

Every FAISS chunk has `tenant_id = current_user["id"]`. Retrieval filters to:
- `tenant_id == current_user["id"]` (user's own ingested docs)
- `tenant_id == "SCHEDULLY_KB"` (shared product knowledge base)

The API never accepts `tenant_id` from request body — always from decoded JWT.

---

## Session Memory: Per-User Scoping

Sessions are scoped per user in the router:
```python
user_session_key = f"user:{user_id}:{body.session_id}"
memory = get_or_create_memory(user_session_key)
```

History is stored in-process (Python dict). **For multi-worker uvicorn (`--workers > 1`), replace with Redis using `REDIS_URL` from settings.**

---

## Certificate Ingestion — Security Rules

`GET /api/schedully/provider/certificates`:
- Reads ONLY `certificates_urls` from `provider_onboarding` table
- **Never reads** `identity_proof_url` or `profile_photo_url`
- Files resolved via `Path(url).name` to prevent path traversal
- Files must exist under `backend/uploads/provider_onboarding/`
- Role check: provider only (403 for all other roles)

---

## XLSX Report Parsing

The Node.js report-service exports these XLSX sheets (confirmed from `reportService.js`):

| Sheet name | Key columns |
|---|---|
| All Appointments | appointment_id, customer_name, provider_name, appointment_date, time_slot, status, fee_inr |
| Users | id, full_name, email, phone, role, is_active |
| Service Providers | id, provider_name, specialization, avg_rating, consultation_fee |
| Schedule_M_Y | appointment_date, time_slot, customer_name, status, fee_inr |
| Appointment History | appointment_date, provider_name, status, fee_inr, cancellation_reason |

Each row is converted to a `"key: value, key: value"` sentence for BM25/LLM reasoning.

---

## Redux State Shape (Frontend)

```js
// store/authSlice.js
{
  user:            null | { /* full profile */ },
  token:           null | "<jwt string>",
  role:            null | "customer" | "provider" | "admin" | "organization",
  isAuthenticated: false,
  loading:         false,
  profileLoading:  false,
  error:           null,
  otpEmail:        null,
  otpType:         null   // "signup" | "forgot" | "admin"
}
```

Widget uses: `const { isAuthenticated, role } = useSelector((s) => s.auth)`

---

## Role-Based Widget Behavior

| Role | Widget visible | Upload panel | Live API tools | Certificate ingest |
|---|---|---|---|---|
| customer | ✅ | ❌ | ❌ (intent downgraded to KB) | ❌ |
| provider | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ❌ |
| organization | ❌ | — | — | — |
| unauthenticated | ❌ | — | — | — |

---

## Starting the App

```bash
# 1. Install chatbot deps (one time only)
myenv/bin/pip install -r ../schedully/requirements.txt

# 2. Backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 5000

# 3. Report service (for XLSX exports)
cd report-service
node app.js

# 4. Frontend
cd frontend
npm run dev
```

On first backend start:
- `[schedully] KB loaded: X chunks indexed` appears in console
- `schedully/backend/index/faiss.index` and `chunks.json` are created

---

## What Is and Is Not Implemented (vs the RAG Architecture Diagram)

### ✅ Implemented
- Stage 0: Parse, Canonicalize, Dedup, Structure-aware chunking, Version tags, Hybrid Index (FAISS)
- Stage 1: Understand + Plan (intent classify, sub-query decompose)
- Stage 2: Orchestrate (parallel dispatch, repair loop)
- Stage 3: BM25 + FAISS + Tools/APIs
- Stage 4: RRF fusion + Cross-encoder rerank
- Stage 5: Grounding check, Contradiction check, Coverage check, Repair loop
- Stage 6: Generate + Cite
- Memory: Session memory + Context carry-forward

### ❌ Not Implemented (optional, v2)
- Profile memory (user preferences persisted across sessions)
- Durable memory (long-term facts about the user)
- Stage 3: Exact match search (BM25 covers this partially)
- Session eviction background task (sessions auto-expire after 1 hour TTL anyway)
- Redis-backed sessions for multi-worker deployments

---

## Key Design Decisions

1. **FAISS not ChromaDB** — self-contained, no external server, works offline, matches genaiday5 precedent
2. **Hybrid BM25 + FAISS** — BM25 for exact terms, FAISS for semantic variations, RRF to fuse
3. **schedully/ as sibling not child of backend/** — keeps chatbot completely isolated, requires sys.path fix in main.py
4. **Widget in frontend/src/components/** — Vite resolves imports relative to the file's location; putting it outside src/ breaks relative imports
5. **Direct .env file read for API key** — pydantic lru_cache is populated at startup before schedully modules load, so os.environ is empty; reading the file directly bypasses this
6. **Per-user session key** — `user:{userId}:{sessionId}` ensures history never leaks between users
