# Free Tier Full-Stack Deployment Skill

## Purpose
Guide for deploying Node.js + Python + React full-stack applications to free cloud services (Render, TiDB Cloud, Hugging Face Spaces) with zero cost. Based on real deployment experience — covers all common pitfalls upfront.

---

## Pre-Deployment Checklist (Do ALL of these BEFORE deploying)

### 1. Environment Variables Must Be Configurable
Before touching any cloud service, scan the codebase for hardcoded values:

- **API base URLs**: Must read from env var with localhost fallback
  ```js
  // GOOD
  const API_URL = import.meta.env.VITE_API_BASE_URL || '';
  // BAD
  const API_URL = 'http://localhost:3000';
  ```
- **Database connection strings**: Must come from env vars
- **CORS origins**: Must include an env var for the frontend URL
- **OAuth callback URLs**: Must be configurable via env var
- **Any service-to-service URLs**: (e.g., rule engine URL from backend)
- **Google Client ID in frontend**: Must be `import.meta.env.VITE_GOOGLE_CLIENT_ID` — forgetting this breaks OAuth on cloud

### 2. Fix Known Cloud Compatibility Issues BEFORE Deploying

#### Express behind a proxy (Render, Heroku, Railway)
```js
// MUST add this before any middleware if using express-rate-limit
app.set("trust proxy", 1);
```
Without this, `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

#### Cookie settings for HTTPS
```js
res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",      // true on cloud
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});
```
If `secure: false` on HTTPS, browsers silently reject cookies.

#### SPA routing on Render static sites
The `public/_redirects` file approach is unreliable on Render. Instead:
1. Create `public/_redirects` with `/* /index.html 200` (as a fallback)
2. Also add a **Redirect/Rewrite rule** in Render dashboard: Source `/*` → Destination `/index.html` → Action **Rewrite**
3. In the build command, explicitly copy: `npm install && npm run build && cp public/_redirects dist/_redirects`
4. After adding the rule, do a **Clear Cache & Deploy** to flush stale 404 responses

#### Image/asset imports in Vite/React
```jsx
// BAD — only works in dev mode
<img src="/src/assets/image.jpg" />

// GOOD — works in both dev and production
import myImage from "../assets/image.jpg";
<img src={myImage} />
```

#### MySQL/Sequelize SSL for TiDB Cloud
```js
const sequelize = new Sequelize(db, user, pass, {
  host, port, dialect: "mysql",
  ...(process.env.SQL_SSL === "true" && {
    dialectOptions: { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
  })
});
```

#### Python SQLAlchemy SSL for TiDB Cloud
```python
connect_args = {}
if settings.SQL_SSL:
    connect_args["ssl"] = {"ssl_mode": "VERIFY_IDENTITY"}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
```

### 3. SMTP/Email Will NOT Work on Most Free Tiers
Render, Railway, and most free PaaS block outbound SMTP (ports 465, 587). Solutions:
- **Option A**: Use an HTTP-based email API (Resend, Brevo, SendGrid) instead of SMTP
- **Option B**: Skip email verification on cloud with an env var flag (`SKIP_OTP=true`)
- **Option C**: Accept it won't work and demonstrate email locally

Always build the skip-email path BEFORE deploying to avoid debugging on cloud.

### 4. ML/AI Services Will NOT Fit in 512MB RAM
Render free tier gives 512MB per service. PyTorch alone needs ~400MB. If your app uses:
- `sentence-transformers`
- `torch`
- `faiss-cpu` + embeddings
- Any transformer model

**You MUST deploy these as a separate service** on a platform with more RAM:
- **Hugging Face Spaces (Docker SDK)** — 16GB RAM free, perfect for ML services
- Set up a proxy in your main backend to forward requests to the HF Space

### 5. Render Free Tier Port Binding
- Uvicorn with `$PORT` may not expand correctly. Use a shell wrapper:
  ```bash
  # start.sh
  #!/bin/bash
  uvicorn main:app --host 0.0.0.0 --port ${PORT:-5000}
  ```
- Set Start Command to `bash start.sh`
- Or hardcode: `uvicorn main:app --host 0.0.0.0 --port 10000`
- Render default port is `10000`

### 6. "No Open Ports Detected" Troubleshooting
This means your app crashed before binding. Common causes:
- **Out of Memory** — check if ML deps are installed (remove them, use `requirements-cloud.txt`)
- **Import error** — a module not in requirements
- **DB connection timeout** — blocking startup too long
- **Startup code downloading models** — move to background task

### 7. Virtual Environments Are NOT Portable
If copying a Python project between machines:
- Delete `venv/` entirely
- Recreate: `python3 -m venv venv && pip install -r requirements.txt`
- venvs store absolute paths to the Python binary — they break on move/copy

---

## Recommended Free Tier Stack

| Component | Service | Free Tier Limit |
|-----------|---------|-----------------|
| Frontend (React/Vite) | Render Static Site | Unlimited bandwidth |
| Node.js Backend | Render Web Service | 750 hrs/month shared, spins down after 15 min |
| Python Backend | Render Web Service | Same as above |
| ML/AI Service | Hugging Face Spaces (Docker) | 16GB RAM, 2 vCPU, public only |
| MySQL | TiDB Cloud Serverless | 5GB storage, 50M RU/month |
| Email (if needed) | Resend / Brevo | 100-300 emails/day |

**Note on 750 hours**: Services only count as "running" when awake. They auto-sleep after 15 min of inactivity. For a demo with occasional traffic, 3 services easily fit within 750 hours.

---

## Deployment Order

Always deploy in this order (dependencies first):

1. **Database** (TiDB Cloud) — Create cluster, get connection credentials
2. **Migrate data** — Dump local MySQL, import to TiDB via Node.js script
3. **ML service** (HF Spaces) — If applicable, deploy standalone chatbot/AI service
4. **Backend services** (Python first, then Node.js)
5. **Frontend** (needs backend URL as env var)
6. **Link services** — Add FRONTEND_URL to backend, update OAuth redirect URIs, link services

---

## Database Migration Strategy

### MySQL → TiDB Cloud

**Step 1**: Dump locally
```bash
mysqldump -u root -p'PASSWORD' your_database --no-tablespaces --set-gtid-purged=OFF > /tmp/dump.sql
```

**Step 2**: Strip the mysqldump warning (first line if using `-p` on CLI):
```bash
sed '1,2d' /tmp/dump.sql > /tmp/dump_clean.sql  # Only if warning line exists
```

**Step 3**: Import via Node.js (NOT mysql CLI — auth plugin issues on macOS):
```js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const conn = await mysql.createConnection({
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'YOUR_USER.root',
    password: 'YOUR_PASSWORD',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true,  // KEY — allows full dump import
  });
  await conn.query('CREATE DATABASE IF NOT EXISTS your_database');
  await conn.query('USE your_database');
  const sql = fs.readFileSync('/tmp/dump_clean.sql', 'utf8');
  await conn.query(sql);
  console.log('Import complete!');
  await conn.end();
}
main().catch(console.error);
```

**Important**: Run this script from a directory with `mysql2` installed (e.g., your report-service folder). Do NOT use seed scripts over the internet (too slow row-by-row). Always dump + bulk import.

---

## Hugging Face Spaces Deployment (for ML services)

### Setup
1. Create a Space at huggingface.co/spaces → SDK: **Docker**
2. Structure:
   ```
   your-space/
   ├── Dockerfile
   ├── README.md       # HF metadata (sdk: docker)
   ├── requirements.txt
   ├── app.py          # FastAPI standalone app
   └── your_ml_code/   # Your ML modules
   ```

3. Dockerfile:
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   EXPOSE 7860
   CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
   ```

4. Push requires token auth:
   ```bash
   git remote set-url origin https://USERNAME:hf_TOKEN@huggingface.co/spaces/USERNAME/SPACE_NAME
   git push origin main
   ```

5. Add secrets via HF Space Settings (JWT_SECRET, API keys, etc.)

### Proxy Pattern (main backend → HF Space)
```python
# In main backend, when ML service is disabled locally
@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_ml_service(path: str, request: Request):
    url = f"{ML_SERVICE_URL}/api/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method=request.method, url=url, headers=headers,
            content=body, params=dict(request.query_params),
        )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)
```

### Common HF Spaces Issues
- **`python-multipart` not installed** — Add to requirements.txt if using file uploads (UploadFile)
- **Model download on startup** — First request may be slow (30-60s) while model downloads
- **`413 Request too large`** from LLM API — Your RAG pipeline is sending too many chunks. Reduce `top_k` or truncate context.

---

## Render-Specific Notes

### Static Sites
- Build command: `npm install && npm run build && cp public/_redirects dist/_redirects`
- Publish directory: `dist`
- Env vars are **build-time only** — must redeploy after changing them
- Add Rewrite rule in dashboard: `/*` → `/index.html` → Rewrite
- After adding rules, **Clear Cache & Deploy** to flush stale responses

### Web Services
- Start command for Python: `bash start.sh` (with start.sh containing uvicorn + $PORT)
- Start command for Node: `node app.js`
- `$PORT` is assigned by Render — never hardcode in code (but can hardcode `10000` in start command)
- Free tier spins down after 15 min — first request takes 30-60s (cold start)
- **750 hours shared across all web services** — only awake time counts

### Environment Variables
- Set via Dashboard → Service → Environment tab
- Changes trigger auto-redeploy (for web services)
- For static sites, must click "Manual Deploy" after env var changes

### Google OAuth on Render
- Add Render frontend URL to **Authorized JavaScript Origins**
- Add Render backend callback URL to **Authorized Redirect URIs**
- Add `GOOGLE_CALLBACK_URL` env var to backend pointing to Render URL
- Add `VITE_GOOGLE_CLIENT_ID` env var to frontend static site
- **Forgetting the frontend env var** causes `invalid_client` — the most confusing OAuth error

---

## Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| `Cannot GET /` on backend URL | Normal — backend is an API, not a website. Frontend is what users open. |
| `CORS blocked` | Add `FRONTEND_URL` env var to backend, include it in allowed origins |
| `redirect_uri_mismatch` (Google OAuth) | Add Render backend URL to Google Console Authorized Redirect URIs |
| `invalid_client` (Google OAuth) | Frontend is sending wrong Client ID. Set `VITE_GOOGLE_CLIENT_ID` env var on static site and redeploy |
| `Connection timeout` on email | SMTP blocked. Use `SKIP_OTP=true` or switch to HTTP email API |
| `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` | Add `app.set("trust proxy", 1)` |
| Images broken in production | Use ES module imports, not `/src/assets/` paths |
| Routes return 404 on refresh | Add Rewrite rule in Render dashboard + `_redirects` file |
| White screen on sub-paths | Rewrite rule not working — clear cache & redeploy; check destination is `/index.html` with leading slash |
| TiDB `mysql` CLI auth error | Don't use CLI. Use Node.js `mysql2` with `multipleStatements: true` |
| Seed script too slow on cloud | Dump locally + import bulk SQL instead of running seed per-row |
| `secure: false` cookie not working | Set `secure: true` and `sameSite: "none"` in production |
| Frontend still hitting localhost | Check `VITE_API_BASE_URL` is set in Render static site env vars and redeploy |
| `No open ports detected` | App crashing on startup. Check for OOM, missing modules, or blocking startup code |
| `Out of memory (512Mi)` | ML deps (torch, transformers) don't fit. Use `requirements-cloud.txt` without them. Deploy ML on HF Spaces |
| `Request too large` from Groq/LLM | RAG sending too many chunks. Use smaller files for demo or reduce top_k |
| HF Space push hangs | Need token auth: `git remote set-url origin https://user:hf_token@huggingface.co/spaces/...` |
| `python-multipart` missing on HF | Add to requirements.txt — needed for FastAPI file upload endpoints |
| mysqldump warning breaks import | First line of dump has a warning. Strip it with `sed '1,2d'` |
| Render static site env vars not taking effect | Static site vars are build-time only. Must redeploy after changing. |

---

## Template .env Comments Pattern

Always keep both local and cloud values in .env with comments:
```env
# For cloud (TiDB): SQL_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
SQL_HOST=localhost
```
This makes switching between local and cloud trivial.

---

## Ensuring Local Development Is NOT Affected

All cloud changes must be gated behind environment variables with safe defaults:

| Env Var | Default (local) | Cloud Value | Effect |
|---------|----------------|-------------|--------|
| `SQL_SSL` | `false` | `true` | Enables TLS for DB |
| `ENABLE_CHATBOT` | `true` | `false` | Loads chatbot directly vs proxy |
| `SCHEDULLY_SERVICE_URL` | `""` | HF Space URL | Only used when chatbot disabled |
| `SKIP_OTP` | `false` | `true` | Bypasses email verification |
| `NODE_ENV` | unset | `production` | Controls cookie secure/sameSite |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/...` | Render URL | OAuth redirect target |

**Rule**: If an env var isn't set, the app must behave identically to before any cloud changes.

---

## Post-Deployment Verification

After all services are live:
1. Open frontend URL — should load without console errors
2. Check browser Network tab — API calls should go to Render backend (not localhost)
3. Try login — should work (OTP skipped on cloud)
4. Test Google OAuth — needs `VITE_GOOGLE_CLIENT_ID` on frontend
5. Check each major feature path
6. Verify chatbot proxy works (if using HF Spaces)
7. Check Render logs for any runtime errors

---

## When to Show Locally vs Cloud

For capstone/demo presentations:
- **Show on cloud**: Basic CRUD, login, dashboard, data display, Google OAuth
- **Show locally**: Features that need high memory (RAG with large docs), real-time operations, email/OTP flow
- **Explain**: Free tier limitations (512MB RAM, cold starts, Groq token limits) are expected and not code issues
