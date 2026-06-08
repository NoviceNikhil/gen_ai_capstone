import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware

from config.settings import settings
from config.database import engine
from models import Base
from middleware.rate_limiter import limiter
from migrate_add_google_auth_columns import add_google_auth_columns

# ─── Routers ──────────────────────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.customer import router as customer_router
from routers.provider import router as provider_router
from routers.provider_approval import router as provider_approval_router
from routers.availability import router as availability_router
from routers.admin import router as admin_router
from routers.categories import router as categories_router
from routers.organization import router as organization_router
from routers.payments import router as payments_router
from routers.notifications import router as notifications_router
from routers.reports import router as reports_router
from routers.disputes import router as disputes_router
from routers.ai_insights import router as ai_insights_router


# ── chatbot changes start ─────────────────────────────────────────────────────
import sys
from pathlib import Path as _Path
# schedully/ lives one level above backend/ — add its parent to sys.path
_schedully_parent = str(_Path(__file__).resolve().parents[1])
if _schedully_parent not in sys.path:
    sys.path.insert(0, _schedully_parent)
from schedully.backend.router import router as schedully_router
# ── chatbot changes end ───────────────────────────────────────────────────────

LOCAL_DEV_ORIGIN_RE = re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$")


def is_allowed_cors_origin(origin: str | None) -> bool:
    return bool(
        origin
        and (
            origin in settings.ALLOWED_FRONTEND_ORIGINS
            or LOCAL_DEV_ORIGIN_RE.match(origin)
        )
    )


import asyncio
from datetime import datetime
from config.database import SessionLocal
from models import AppointmentRescheduleRequest, AppointmentSlot, AppointmentHistory

async def expire_reschedule_requests_loop():
    while True:
        try:
            db = SessionLocal()
            now = datetime.now()
            expired_reqs = db.query(AppointmentRescheduleRequest).filter(
                AppointmentRescheduleRequest.status == "pending",
                AppointmentRescheduleRequest.expires_at.isnot(None),
                AppointmentRescheduleRequest.expires_at <= now
            ).all()
            for req in expired_reqs:
                req.status = "expired"
                # Free the held slot
                slot = db.query(AppointmentSlot).filter(
                    AppointmentSlot.provider_id == req.appointment.provider_id,
                    AppointmentSlot.slot_date == req.proposed_date,
                    AppointmentSlot.time_slot == req.proposed_time_slot,
                ).first()
                if slot:
                    slot.is_booked = False
                
                db.add(AppointmentHistory(
                    appointment_id=req.appointment_id,
                    previous_status=req.appointment.status,
                    new_status=req.appointment.status,
                    changed_by="system",
                    notes="Reschedule request expired after 24 hours"
                ))
            if expired_reqs:
                db.commit()
            db.close()
        except Exception as e:
            print(f"Error expiring reschedule requests: {e}")
            if 'db' in locals():
                db.close()
        await asyncio.sleep(60 * 10)  # Check every 10 mins

# ─── Lifespan (DB table creation on startup) ─────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables (equiv. to sequelize.sync())
    Base.metadata.create_all(bind=engine)
    add_google_auth_columns()
    print("  MySQL tables synced successfully")
    task = asyncio.create_task(expire_reschedule_requests_loop())
    # ── chatbot changes start ─────────────────────────────────────────────────
    # Load KB in background so uvicorn can bind the port immediately
    async def _load_kb_background():
        await asyncio.sleep(1)  # Let uvicorn bind first
        try:
            from schedully.backend.kb_loader import load_kb
            load_kb()
            print("  Schedully KB loaded successfully")
        except Exception as e:
            print(f"  Warning: KB loading failed (non-critical): {e}")

    asyncio.create_task(_load_kb_background())
    # ── chatbot changes end ───────────────────────────────────────────────────
    yield
    # Shutdown: clean up resources if needed
    task.cancel()
    print("  Server shutting down")


# ─── App Instance ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Schedex — Appointment Scheduling Platform",
    description="Production-ready API for managing appointments, providers, and customers.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Keep configured production origins explicit, while allowing Vite's local dev
# server if it falls back to another port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_FRONTEND_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response


# ─── Global Exception Handler (AppException + generic) ───────────────────────
from utils.exceptions import AppException

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "data": None,
            "error": exc.message,
        },
    )
    # Manual CORS header addition for exception responses
    origin = request.headers.get("origin")
    if is_allowed_cors_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    message = str(exc.errors())
    message = re.sub(r"^Value error,\s*", "", message)
    response = JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": message,
            "data": None,
            "error": "Validation Error",
        },
    )
    origin = request.headers.get("origin")
    if is_allowed_cors_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    print(f"  INTERNAL SERVER ERROR: {str(exc)}")
    response = JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal Server Error",
            "data": None,
            "error": "Internal Server Error",
        },
    )
    origin = request.headers.get("origin")
    if is_allowed_cors_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(provider_router)
app.include_router(provider_approval_router)
app.include_router(availability_router)
app.include_router(admin_router)
app.include_router(categories_router)
app.include_router(organization_router)
app.include_router(payments_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(disputes_router)
app.include_router(ai_insights_router)
# ── chatbot changes start ─────────────────────────────────────────────────────
app.include_router(schedully_router)
# ── chatbot changes end ───────────────────────────────────────────────────────



# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Schedex API is running", "version": "1.0.0"}


# ─── Run with uvicorn ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
# Trigger reload v11
