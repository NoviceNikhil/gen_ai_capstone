from datetime import datetime, timezone

from config.settings import settings

try:
    from pymongo import MongoClient
except Exception:  # pragma: no cover
    MongoClient = None


_mongo_client = None
_mongo_collection = None


def _get_collection():
    global _mongo_client, _mongo_collection
    if _mongo_collection is not None:
        return _mongo_collection
    if not settings.MONGO_URI or MongoClient is None:
        return None
    try:
        _mongo_client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=1500)
        _mongo_collection = _mongo_client[settings.MONGO_DB_NAME]["audit_logs"]
        return _mongo_collection
    except Exception:
        return None


def log_event(event_type: str, actor_id: str | None, metadata: dict | None = None) -> None:
    collection = _get_collection()
    if collection is None:
        return
    payload = {
        "event_type": event_type,
        "actor_id": actor_id,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc),
    }

    def _insert():
        try:
            collection.insert_one(payload)
        except Exception:
            pass

    import threading
    threading.Thread(target=_insert, daemon=True).start()
