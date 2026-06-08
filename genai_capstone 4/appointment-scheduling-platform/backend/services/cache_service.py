import json
from functools import wraps

from config.settings import settings

try:
    import redis as _redis
except Exception:
    _redis = None


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.REDIS_URL or _redis is None:
        return None
    try:
        _client = _redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        _client.ping()
        return _client
    except Exception:
        return None


def get(key: str):
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set(key: str, value, ttl: int = 60):
    client = _get_client()
    if client is None:
        return
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        return


def invalidate(key: str):
    client = _get_client()
    if client is None:
        return
    try:
        client.delete(key)
    except Exception:
        return
