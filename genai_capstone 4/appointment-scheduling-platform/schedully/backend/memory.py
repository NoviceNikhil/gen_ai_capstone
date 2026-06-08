"""
Session Memory Layer
In-process session memory keyed by session_id.
Capped at 20 turns per session. TTL: 1 hour inactivity.

⚠️ Multi-worker note: In-process dicts are not shared across uvicorn workers.
For --workers > 1, replace _sessions with Redis using the existing REDIS_URL
from backend/config/settings.py. Key namespace: "schedully:session:<session_id>"
"""

import time
from threading import Lock
import json
from pathlib import Path

MAX_TURNS           = 20
SESSION_TTL_SECONDS = 3600  # 1 hour

_lock = Lock()
_sessions: dict[str, dict] = {}
SESSIONS_FILE = Path(__file__).resolve().parent / "sessions.json"


def _load_sessions():
    global _sessions
    if SESSIONS_FILE.exists():
        try:
            with open(SESSIONS_FILE, "r") as f:
                _sessions = json.load(f)
        except Exception:
            _sessions = {}
    else:
        _sessions = {}


def _save_sessions():
    try:
        with open(SESSIONS_FILE, "w") as f:
            json.dump(_sessions, f, indent=2)
    except Exception as e:
        print(f"[schedully] Failed to save sessions: {e}")


# Load sessions on module import
_load_sessions()


class SessionMemory:
    """Thread-safe session memory for one chat session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        with _lock:
            if session_id not in _sessions:
                _sessions[session_id] = {
                    "turns":       [],
                    "title":       "New Conversation",
                    "created_at":  time.time(),
                    "last_active": time.time(),
                }
                _save_sessions()

    def add_turn(self, role: str, content: str) -> None:
        """Append a turn and enforce the MAX_TURNS cap."""
        with _lock:
            session = _sessions.get(self.session_id)
            if session is None:
                return
            session["turns"].append({"role": role, "content": content})
            session["last_active"] = time.time()
            if len(session["turns"]) > MAX_TURNS:
                # Drop oldest turns, keeping the most recent MAX_TURNS
                session["turns"] = session["turns"][-MAX_TURNS:]
            _save_sessions()

    def set_title(self, title: str) -> None:
        """Update the conversation title."""
        with _lock:
            session = _sessions.get(self.session_id)
            if session is not None:
                session["title"] = title
                _save_sessions()

    def get_context_string(self, last_n: int = 6) -> str:
        """
        Return the last `last_n` turns as a plain string for the planner.
        Each message is truncated at 300 chars to keep token usage low.
        """
        with _lock:
            session = _sessions.get(self.session_id)
            if not session:
                return ""
            turns = session["turns"][-last_n:]

        lines: list[str] = []
        for turn in turns:
            label = "User" if turn["role"] == "user" else "Schedully"
            lines.append(f"{label}: {turn['content'][:300]}")
        return "\n".join(lines)

    def clear(self) -> None:
        """Wipe all turns for this session (keeps session alive)."""
        with _lock:
            if self.session_id in _sessions:
                _sessions[self.session_id]["turns"] = []
                _save_sessions()


def get_or_create_memory(session_id: str) -> SessionMemory:
    """Get or create a SessionMemory for the given session_id."""
    return SessionMemory(session_id)


def evict_stale_sessions() -> int:
    """
    Remove sessions inactive for longer than SESSION_TTL_SECONDS.
    Call this from a background task — e.g. alongside the existing
    expire_reschedule_requests_loop in backend/main.py.
    Returns number of sessions evicted.
    """
    now = time.time()
    evicted = 0
    with _lock:
        stale_ids = [
            sid for sid, s in _sessions.items()
            if now - s["last_active"] > SESSION_TTL_SECONDS
        ]
        for sid in stale_ids:
            del _sessions[sid]
            evicted += 1
        if evicted > 0:
            _save_sessions()
    return evicted


def get_user_sessions(user_id: str, mode: str) -> list[dict]:
    """
    Return a list of all active sessions for the user and mode.
    Each item contains session_id, title, created_at, last_active.
    """
    prefix = f"user:{user_id}:"
    suffix = f":{mode}"
    results = []
    with _lock:
        for key, s in _sessions.items():
            if key.startswith(prefix) and key.endswith(suffix):
                # Extract original session_id (the middle part)
                parts = key.split(":")
                if len(parts) >= 4:
                    orig_sid = parts[2]
                else:
                    orig_sid = key
                results.append({
                    "session_id": orig_sid,
                    "title": s.get("title", "New Conversation"),
                    "created_at": s.get("created_at", s["last_active"]),
                    "last_active": s["last_active"],
                })
    # Sort by last_active descending (most recent first)
    results.sort(key=lambda x: x["last_active"], reverse=True)
    return results


def delete_user_session(user_id: str, session_id: str, mode: str) -> bool:
    """Delete a specific session and its history for the user."""
    key = f"user:{user_id}:{session_id}:{mode}"
    with _lock:
        if key in _sessions:
            del _sessions[key]
            _save_sessions()
            return True
    return False
