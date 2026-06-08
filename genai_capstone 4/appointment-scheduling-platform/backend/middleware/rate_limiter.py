from slowapi import Limiter
from slowapi.util import get_remote_address
from config.settings import settings

# ─── Rate Limiter Instance ────────────────────────────────────────────────────
# Attach to FastAPI app via app.state.limiter and @limiter.limit() decorator

# Rate limit strings (slowapi format: "N/period")
GENERAL_LIMIT = "100/minute"      # general API — 100 requests per minute
SIGNUP_LIMIT = "50/10minutes"    # signup — relaxed for dev (prod: 5/10minutes)
LOGIN_LIMIT = "7/5minutes"       # login — 7 attempts per 5 minutes
OTP_LIMIT = "3/5minutes"         # OTP resend — 3 per 5 minutes


def get_rate_limit_storage_uri() -> str:
    if not settings.REDIS_URL:
        return "memory://"

    try:
        import redis

        client = redis.Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        client.ping()
        return settings.REDIS_URL
    except Exception as exc:
        print(f"  Redis unavailable for rate limiting; falling back to memory storage: {exc}")
        return "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[GENERAL_LIMIT],
    storage_uri=get_rate_limit_storage_uri(),
)
