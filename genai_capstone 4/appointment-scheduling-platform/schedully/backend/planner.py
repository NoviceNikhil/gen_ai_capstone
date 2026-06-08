"""
Stage 1 — Understand + Plan
Uses LLM for intent classification with aggressive caching to minimize API calls.
Falls back to keyword matching if LLM is unavailable.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import openai

# Read API key directly from .env file
def _get_api_key() -> str:
    env_path = Path(__file__).resolve().parents[2] / "backend" / ".env"
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("GROQ_API_KEY="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return os.environ.get("GROQ_API_KEY", "")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
PLANNER_MODEL   = "llama-3.1-8b-instant"

# ── Intent constants ───────────────────────────────────────────────────────────
INTENT_KB       = "knowledge_base"
INTENT_LIVE     = "live_data"
INTENT_DOCUMENT = "document_qa"
INTENT_COMPOUND = "compound"
INTENT_CLARIFY  = "needs_clarification"
INTENT_OOS      = "out_of_scope"

@dataclass
class Plan:
    intent: str
    sub_queries: list[str]             = field(default_factory=list)
    clarification_question: Optional[str] = None
    tool_hints: list[str]              = field(default_factory=list)
    raw_query: str                     = ""

# ── Simple intent cache (query hash → Plan) ────────────────────────────────────
_intent_cache: dict[str, tuple[Plan, float]] = {}
_CACHE_TTL = 300  # 5 minutes


PLANNER_SYSTEM = """You are the intent classifier for Schedully, an AI assistant in Schedex (appointment scheduling platform).

Classify the user message into ONE intent:
- "knowledge_base"      : how-to questions, feature explanations, navigation help, policy, greetings, small talk
- "live_data"           : needs real-time data — appointments, providers, slots, dashboard, reviews, payments, waitlist, availability, stats, revenue, schedule, bookings, notifications, disputes, packages, calendar sync
- "document_qa"         : question about an uploaded/ingested document (PDF, Excel, certificate, report)
- "compound"            : needs BOTH document content AND live API data
- "needs_clarification" : ambiguous, needs more info
- "out_of_scope"        : unrelated to Schedex (e.g. programming, coding questions, writing algorithms like binary search, math, science, history, general knowledge, recipes, weather, sports)

Also produce:
- sub_queries: 1-3 focused search queries
- clarification_question: one question if needs_clarification, else null
- tool_hints: which API tools needed (get_appointments, get_providers, get_slots, get_dashboard, get_availability, get_reviews, get_profile)

Reply ONLY with valid JSON:
{"intent":"<intent>","sub_queries":["<q1>"],"clarification_question":"<question or null>","tool_hints":["<tool1>"]}"""


def _cache_key(text: str) -> str:
    return text.lower().strip()[:100]


def classify_and_plan(
    user_message: str,
    conversation_context: str = "",
    user_role: str = "customer",
) -> Plan:
    """Classify intent using LLM first, falling back to keyword matching if LLM is unavailable."""
    key = _cache_key(user_message)

    # Check cache first
    if key in _intent_cache:
        plan, ts = _intent_cache[key]
        if time.time() - ts < _CACHE_TTL:
            return plan

    # ── Stage 1: Try LLM planning first for semantic understanding ───────────
    try:
        client = openai.OpenAI(
            base_url=GROQ_BASE_URL,
            api_key=_get_api_key(),
        )
        msgs = []
        if conversation_context:
            msgs.append({"role": "user", "content": f"[Context]\n{conversation_context}\n\n[Message]\n{user_message}"})
        else:
            msgs.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model=PLANNER_MODEL,
            messages=[
                {"role": "system", "content": PLANNER_SYSTEM},
                *msgs,
            ],
            max_tokens=200,
            temperature=0.0,
        )
        raw = (response.choices[0].message.content or "{}").strip()
        raw = re.sub(r"```(?:json)?", "", raw).strip()
        parsed = json.loads(raw)

        intent = parsed.get("intent", INTENT_KB)
        valid = {INTENT_KB, INTENT_LIVE, INTENT_DOCUMENT, INTENT_COMPOUND, INTENT_CLARIFY, INTENT_OOS}
        if intent not in valid:
            intent = INTENT_KB

        # Filter tool hints based on user role capabilities if needed
        tool_hints = parsed.get("tool_hints", [])
        if user_role == "customer":
            # For customer, restrict to non-sensitive customer-facing operations
            allowed_hints = ["get_appointments", "get_providers", "get_slots", "get_dashboard", "get_reviews"]
            tool_hints = [h for h in tool_hints if h in allowed_hints]

        plan = Plan(
            intent=intent,
            sub_queries=parsed.get("sub_queries", [user_message]),
            clarification_question=parsed.get("clarification_question"),
            tool_hints=tool_hints,
            raw_query=user_message,
        )
        _intent_cache[key] = (plan, time.time())
        return plan

    except Exception as exc:
        print(f"[schedully] Planner LLM (Groq) failed: {str(exc)[:80]} — falling back to keyword planner")
        # ── Stage 2: Fallback to local keyword planner if API is down ───────
        plan = _keyword_plan(user_message, user_role)
        _intent_cache[key] = (plan, time.time())
        return plan


# ── Keyword fallback (only used when LLM is unavailable) ──────────────────────

_LIVE_RE = re.compile(
    r"\b(appointments?|bookings?|schedules?|today|tomorrow|upcomings?|pendings?|confirmeds?|cancelleds?|completeds?|"
    r"providers?|doctors?|specialists?|therapists?|counselors?|practitioners?|"
    r"dashboards?|stats?|summar(y|ies)|overviews?|revenues?|earnings?|totals?|counts?|how\s+many|"
    r"slots?|availability|availables?|time\s+slots?|"
    r"reviews?|ratings?|feedbacks?|stars?|"
    r"payments?|pays?|paid|refunds?|transactions?|fees?|charges?|penalties?|"
    r"waitlists?|waitings?|"
    r"organizations?|organisations?|teams?|employees?|staffs?|"
    r"notifications?|alerts?|unreads?|"
    r"disputes?|complaints?|issues?|"
    r"packages?|sessions?|bundles?|loyalty|"
    r"calendars?|google\s+calendars?|syncs?|"
    r"cancel|reschedule|rebook)\b",
    re.IGNORECASE,
)

_DOC_RE = re.compile(
    r"\b(reports?|excel|xlsx|xls|spreadsheets?|pdfs?|documents?|certificates?|licenses?|licences?|"
    r"uploads?|ingests?|files?|sheets?|exports?)\b",
    re.IGNORECASE,
)

_OOS_RE = re.compile(
    r"\b(recipes?|cook|food|movies?|songs?|weather|sports?|football|cricket\s+score|"
    r"buy|sell|shops?|orders?|deliveries?|jokes?|funny|memes?|games?|"
    r"binary\s+search|algorithms?|sorting|coding|programming|python\s+code|javascript\s+code|java\s+code|c\+\+\s+code|rust\s+code|write\s+a\s+function|write\s+code|code\s+for)\b",
    re.IGNORECASE,
)


def _keyword_plan(query: str, user_role: str = "customer") -> Plan:
    """Fallback keyword-based classification."""
    hints = []
    q = query.lower()

    if _OOS_RE.search(query):
        intent = INTENT_OOS
    elif _DOC_RE.search(query):
        intent = INTENT_DOCUMENT
    elif _LIVE_RE.search(query):
        intent = INTENT_LIVE
        # Only add tool hints for roles that can access live data
        if user_role in ("provider", "admin"):
            if re.search(r"\b(appointments?|bookings?|schedules?|cancel|reschedule|rebook)\b", q):
                hints.append("get_appointments")
            if re.search(r"\b(providers?|doctors?|specialists?|therapists?)\b", q):
                hints.append("get_providers")
            if re.search(r"\b(slots?|availability|availables?|time\s+slots?)\b", q):
                hints.append("get_slots")
            if re.search(r"\b(dashboards?|stats?|summar(y|ies)|overviews?|totals?|counts?|how\s+many)\b", q):
                hints.append("get_dashboard")
            if re.search(r"\b(reviews?|ratings?|feedbacks?|stars?)\b", q):
                hints.append("get_reviews")
            if re.search(r"\b(my ratings?|my profile|my specialization|my experience|my location|my fee|about me|my info|my details|my consultation)\b", q):
                hints.append("get_profile")
            if re.search(r"\b(availability|available)\b", q) or ("slots" in q and any(kw in q for kw in ["allow", "set", "activ", "schedul", "recur", "config"])):
                hints.append("get_availability")
        elif user_role == "customer":
            # Customers get their own appointment data
            if re.search(r"\b(appointments?|bookings?|schedules?|cancel|reschedule|rebook)\b", q):
                hints.append("get_appointments")
            if re.search(r"\b(reviews?|ratings?|feedbacks?|stars?)\b", q):
                hints.append("get_reviews")
    else:
        intent = INTENT_KB

    return Plan(intent=intent, sub_queries=[query], tool_hints=hints, raw_query=query)


def is_prompt_injection(text: str) -> bool:
    patterns = [
        r"ignore\s+(previous|above|all|prior)\s+instructions?",
        r"disregard\s+(previous|above|all|prior)\s+instructions?",
        r"you\s+are\s+now\s+(a|an)\s+",
        r"jailbreak", r"DAN\s+mode",
        r"pretend\s+you\s+(are|have\s+no)",
        r"reveal\s+(your\s+)?(system\s+)?prompt",
        r"print\s+(your\s+)?(system\s+)?prompt",
        r"show\s+(me\s+)?your+instructions",
    ]
    return bool(re.compile("|".join(patterns), re.IGNORECASE).search(text))
