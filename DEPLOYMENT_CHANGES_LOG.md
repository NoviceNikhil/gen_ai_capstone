# Deployment Changes Log

All changes made to support free-tier cloud deployment. **None affect local development.**

---

## Summary: Local Run Impact = NONE

Every change is gated behind environment variables that are NOT set locally. Locally your app runs exactly as before.

---

## File-by-File Changes

### 1. `backend/config/settings.py`
**What changed:** Added `SQL_SSL: bool = False` and `SCHEDULLY_SERVICE_URL: str = ""`
**Why:** Enables SSL toggle for TiDB Cloud; enables chatbot proxy URL for HF Spaces.
**Local impact:** Both default to `False`/empty. No behavior change.

---

### 2. `backend/config/database.py`
**What changed:** Added conditional `connect_args` with SSL when `SQL_SSL=True`.
**Why:** TiDB Cloud requires TLS connections.
**Local impact:** `SQL_SSL` defaults to `False` → `connect_args` is empty dict → identical to before.

---

### 3. `backend/config/sql.js` (Node.js Sequelize)
**What changed:** Added SSL `dialectOptions` spread when `SQL_SSL=true`.
**Why:** Node.js backend also connects to TiDB on cloud.
**Local impact:** Env var `SQL_SSL` not set locally → spread is skipped → no change.

---

### 4. `backend/app.js` (Node.js Express)
**What changed:** Added `app.set("trust proxy", 1)`.
**Why:** Required for `express-rate-limit` behind Render's reverse proxy.
**Local impact:** Harmless on localhost. No behavior change.

---

### 5. `backend/routers/auth.py`
**What changed:** All `response.set_cookie()` calls now use `secure=is_prod`, `samesite="none" if is_prod else "lax"` where `is_prod = os.getenv("NODE_ENV") == "production"`.
**Why:** Browsers reject cookies without `secure=true` on HTTPS; `sameSite=none` needed for cross-origin cookie on cloud.
**Local impact:** `NODE_ENV` not set locally → `is_prod=False` → cookies remain `samesite=lax, secure=False` → identical to before.

---

### 6. `backend/services/auth_service.py`
**What changed:** Added `SKIP_OTP` flag. When `true`, signup auto-activates accounts and skips email sending.
**Why:** Render blocks outbound SMTP. OTP emails can't be sent on cloud.
**Local impact:** `SKIP_OTP` defaults to `"false"` → OTP flow unchanged.

---

### 7. `backend/main.py`
**What changed:**
- `ENABLE_CHATBOT` flag (defaults `true`). When `false`, chatbot import is skipped.
- When chatbot disabled + `SCHEDULLY_SERVICE_URL` is set, a proxy router forwards `/api/schedully/*` to HF Spaces.
- KB loading moved to background task (non-blocking).
**Why:** PyTorch/sentence-transformers OOMs on Render's 512MB. Chatbot runs on HF Spaces instead.
**Local impact:** `ENABLE_CHATBOT` defaults to `true` → chatbot imports directly as before. Proxy code never executes. KB loads 1 second after startup (practically unnoticeable).

---

### 8. `backend/start.sh` (NEW)
**What changed:** Created shell script with `uvicorn main:app --host 0.0.0.0 --port ${PORT:-5000}`.
**Why:** Render needs bash to expand `$PORT`. Used as Render's Start Command.
**Local impact:** File just sits there. You still run `uvicorn main:app` or `python main.py` locally.

---

### 9. `backend/requirements-cloud.txt` (NEW)
**What changed:** Same as `requirements.txt` but without chatbot ML deps (torch, sentence-transformers, faiss, etc.).
**Why:** Those packages cause OOM on Render. Only used as Render's build command.
**Local impact:** You still use `requirements.txt` locally. This file is unused.

---

### 10. `report-service/services/reportService.js`
**What changed:** Added SSL option to mysql2 pool when `SQL_SSL=true`.
**Why:** Report service also connects to TiDB on cloud.
**Local impact:** `SQL_SSL` not set → no SSL → no change.

---

### 11. `frontend/public/_redirects` (NEW)
**What changed:** Created file with `/* /index.html 200`.
**Why:** SPA routing on Render static sites — prevents 404 on direct URL access.
**Local impact:** Vite dev server ignores this file completely.

---

### 12. `schedully-service/` folder (NEW - entire folder)
**What changed:** Created a standalone FastAPI app that runs the schedully chatbot independently.
**Why:** Deployed on HF Spaces (16GB RAM free) since it needs PyTorch which doesn't fit in Render's 512MB.
**Local impact:** This folder is never imported or referenced locally. It's a completely separate app.

---

## Architecture (Cloud)

```
Frontend (Render Static Site)
    ↓ API calls
Python Backend (Render Web Service, 512MB, no ML deps)
    ↓ proxies /api/schedully/*
Schedully Chatbot (HF Spaces, 16GB RAM, full ML stack)
    ↓ tool calls back to
Python Backend
    ↓ SQL queries
TiDB Cloud (MySQL-compatible)
    
Report Service (Render Web Service, Node.js)
    ↓ SQL queries
TiDB Cloud
```

## Architecture (Local - unchanged)

```
Frontend (Vite dev server :5173)
    ↓ proxy to
Python Backend (:5000, chatbot loaded directly in-process)
    ↓
Local MySQL
    
Report Service (:4000)
    ↓
Local MySQL
```
