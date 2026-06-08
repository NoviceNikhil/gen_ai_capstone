"""
Stage 3b — Tool Layer
Makes async GET calls to the Schedex platform API using the user's own Bearer token.
All routes verified against the actual backend routers.
Customers never reach this module — planner downgrades their intents first.
"""

import json
import os
import re
from datetime import date, timedelta
from typing import Any, Optional

import httpx

from schedully.backend.planner import Plan

PLATFORM_BASE_URL    = os.environ.get("PLATFORM_BASE_URL", "http://localhost:5000")
TOOL_TIMEOUT_SECONDS = 8.0


# ── Internal HTTP helper ───────────────────────────────────────────────────────

async def _get(
    path: str,
    bearer_token: str,
    params: Optional[dict] = None,
) -> Optional[Any]:
    """
    Async GET to the platform API using the user's own Bearer token.
    Returns parsed JSON on success, None on non-200, error dict on timeout/exception.
    """
    url = f"{PLATFORM_BASE_URL}{path}"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    try:
        async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_SECONDS) as client:
            resp = await client.get(url, headers=headers, params=params or {})
        if resp.status_code == 200:
            return resp.json()
        return None
    except httpx.TimeoutException:
        return {"error": "tool_timeout", "path": path}
    except Exception as exc:
        return {"error": str(exc), "path": path}


_SENSITIVE_FIELDS = {
    "email", "phone", "customer_email", "customer_phone", "provider_email",
    "phone_number", "contact_number", "id", "customer_id", "provider_id",
    "user_id", "appointment_id", "payment_id", "transaction_id", "card_number",
    "cvv", "password", "token", "access_token", "refresh_token", "secret",
    "razorpay_order_id", "razorpay_payment_id", "razorpay_signature",
}


def _sanitize_record(record: dict) -> dict:
    """Remove sensitive fields from a record before displaying."""
    return {k: v for k, v in record.items()
            if k.lower() not in _SENSITIVE_FIELDS
            and not any(sf in k.lower() for sf in ["password", "token", "secret", "key"])}


def _sanitize_data(data: Any) -> Any:
    """Recursively sanitize API response data."""
    if isinstance(data, dict):
        return {k: _sanitize_data(v) for k, v in data.items()
                if k.lower() not in _SENSITIVE_FIELDS
                and not any(sf in k.lower() for sf in ["password", "token", "secret", "key"])}
    elif isinstance(data, list):
        return [_sanitize_data(item) for item in data]
    return data


def _simplify_appointment(app: dict) -> dict:
    """Safely simplify an appointment dict to its absolute essentials."""
    provider_name = "N/A"
    provider_obj = app.get("provider")
    if isinstance(provider_obj, dict):
        provider_name = provider_obj.get("owner_name") or (provider_obj.get("user") or {}).get("full_name") or "Provider"
    
    customer_name = "N/A"
    customer_obj = app.get("customer")
    if isinstance(customer_obj, dict):
        customer_name = (customer_obj.get("user") or {}).get("full_name") or "Customer"

    return {
        "date": app.get("appointment_date"),
        "time": app.get("time_slot"),
        "status": app.get("status"),
        "provider": provider_name,
        "specialization": (provider_obj or {}).get("specialization") if isinstance(provider_obj, dict) else "N/A",
        "customer": customer_name,
        "is_paid": app.get("is_paid"),
        "notes": app.get("notes")
    }


def _prune_large_payloads(tool_name: str, data: Any) -> Any:
    """Prune nested records for known large responses to keep tokens low."""
    if not isinstance(data, dict):
        return data

    # 1. Simplify get_appointments
    if tool_name == "get_appointments":
        inner = data.get("data", {})
        if isinstance(inner, dict) and "appointments" in inner:
            apps = inner["appointments"]
            if isinstance(apps, list):
                inner["appointments"] = [_simplify_appointment(a) for a in apps[:15]]
        elif isinstance(inner, list):
            data["data"] = [_simplify_appointment(a) for a in inner[:15]]
        elif isinstance(data, list):
            return [_simplify_appointment(a) for a in data[:15]]

    # 2. Simplify get_providers
    elif tool_name == "get_providers":
        inner = data.get("data", {})
        if isinstance(inner, dict) and "providers" in inner:
            provs = inner["providers"]
            if isinstance(provs, list):
                simplified = []
                for p in provs:
                    if not isinstance(p, dict):
                        continue
                    name = p.get("provider_name") or p.get("owner_name") or (p.get("user") or {}).get("full_name") or "Provider"
                    simplified.append({
                        "provider_name": name,
                        "specialization": p.get("specialization"),
                        "location": p.get("location") or p.get("city"),
                        "avg_rating": p.get("avg_rating"),
                        "total_reviews": p.get("total_reviews"),
                        "is_accepting_appointments": p.get("is_accepting_appointments")
                    })
                inner["providers"] = simplified[:20]

    # 3. Simplify get_reviews to avoid HTTP 413 / token overflow
    elif tool_name == "get_reviews":
        inner = data.get("data", {})
        if isinstance(inner, dict) and "reviews" in inner:
            revs = inner["reviews"]
            if isinstance(revs, list):
                if revs:
                    ratings = [float(r.get("rating", 0)) for r in revs if r.get("rating") is not None]
                    inner["summary"] = {
                        "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
                        "total_reviews": len(ratings),
                        "highest_rating": int(max(ratings)) if ratings else 0,
                        "lowest_rating": int(min(ratings)) if ratings else 0,
                    }
                inner["reviews"] = revs[:5]
        elif isinstance(data, list):
            data = data[:5]

    return data


def _to_tool_result(tool_name: str, data: Any) -> dict:
    """Wrap raw API response into the standard context-item format."""
    data = _prune_large_payloads(tool_name, data)
    return {
        "source": f"[Live: {tool_name}]",
        "text": json.dumps(_sanitize_data(data), default=str),
        "score": 1.0,
        "retrieval_method": "tool",
        "doc_id": "",
        "tenant_id": "",
    }


def _has_error(data: Any) -> bool:
    return isinstance(data, dict) and bool(data.get("error"))


# ── Main dispatch function ─────────────────────────────────────────────────────

async def run_tools(
    plan: Plan,
    tenant_id: str,
    user_id: str,
    user_role: str,
    bearer_token: str,
) -> list[dict]:
    """
    Dispatch async GET tool calls based on plan.tool_hints and keyword heuristics.

    Routes confirmed from:
      backend/routers/provider.py   → /api/provider/...
      backend/routers/admin.py      → /api/admin/...
      backend/routers/customer.py   → /api/customer/...
      backend/routers/availability.py → /api/availability

    All calls are GET-only (read-only constraint).
    """
    results: list[dict] = []
    tool_hints  = set(plan.tool_hints)
    query_lower = plan.raw_query.lower()

    # ── get_appointments ───────────────────────────────────────────────────────
    # Provider : GET /api/provider/appointments?status=&from_date=&to_date=&page=&limit=
    # Admin    : GET /api/admin/appointments?status=&from_date=&to_date=&page=&limit=
    # Customer : GET /api/customer/appointments?status=&from_date=&to_date=&page=&limit=
    if "get_appointments" in tool_hints or any(
        kw in query_lower
        for kw in ["appointment", "booking", "today", "upcoming", "schedule"]
    ):
        params = _extract_appointment_params(plan.raw_query)
        if user_role == "provider":
            data = await _get("/api/provider/appointments", bearer_token, params)
        elif user_role == "admin":
            data = await _get("/api/admin/appointments", bearer_token, params)
        else:
            data = await _get("/api/customer/appointments", bearer_token, params)
        if data is not None and not _has_error(data):
            results.append(_to_tool_result("get_appointments", data))

    # ── get_providers ──────────────────────────────────────────────────────────
    # Admin    : GET /api/admin/providers?is_verified=&search=&page=&limit=
    # Others   : GET /api/customer/providers?search=&category_id=&location=&min_rating=
    if "get_providers" in tool_hints or "provider" in query_lower or "city" in query_lower or "location" in query_lower:
        params = {}
        # Try to extract location from query: e.g. "in mumbai", "in xyz city", "location: xyz"
        loc_match = re.search(r"\b(?:in|at|near|located\s+in)\s+([a-zA-Z\s]+)\b", query_lower)
        if loc_match:
            loc = loc_match.group(1).strip()
            loc = re.sub(r"\b(city|town|area|region|province|state)\b", "", loc).strip()
            # Split on common query stop words/connectives to avoid consuming trailing words like "who i can book with"
            loc = re.split(
                r"\b(who|i|can|book|with|for|to|at|on|a|an|the|is|are|of|near|located|that|which|scheduled|appointment|appointments|slot|slots|day|today|tomorrow|yesterday)\b",
                loc,
                flags=re.IGNORECASE
            )[0].strip()
            if loc and loc not in ["today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night", "week", "month", "year"]:
                params["location"] = loc

        if user_role == "admin":
            data = await _get("/api/admin/providers", bearer_token, params)
        else:
            data = await _get("/api/customer/providers", bearer_token, params)
        if data is not None and not _has_error(data):
            results.append(_to_tool_result("get_providers", data))

    # ── get_slots ──────────────────────────────────────────────────────────────
    # Provider only: GET /api/provider/slots?date=YYYY-MM-DD
    # Customer / Admin: GET /api/customer/providers/{provider_id}/slots?date=YYYY-MM-DD
    if "get_slots" in tool_hints or "slot" in query_lower or "available" in query_lower:
        date_param = _extract_date(plan.raw_query)
        if not date_param:
            date_param = str(date.today())

        if user_role == "provider":
            params = {"date": date_param}
            data = await _get("/api/provider/slots", bearer_token, params)
            if data is not None and not _has_error(data):
                results.append(_to_tool_result("get_slots", data))
        else:
            # Customer or Admin querying availability of another provider
            # 1. Fetch all providers to match name
            providers_data = await _get("/api/customer/providers", bearer_token, {"limit": 50})
            if providers_data and not _has_error(providers_data):
                providers_list = []
                if isinstance(providers_data, dict):
                    if "data" in providers_data:
                        inner = providers_data["data"]
                        if isinstance(inner, dict):
                            providers_list = inner.get("providers", [])
                        elif isinstance(inner, list):
                            providers_list = inner
                    else:
                        providers_list = providers_data.get("providers", [])

                # Scan to find a provider name that matches part of the query
                target_provider = None
                for p in providers_list:
                    user_obj = p.get("user") or {}
                    full_name = user_obj.get("full_name", "")
                    provider_name = p.get("provider_name", "")
                    name_to_check = full_name or provider_name
                    if name_to_check:
                        name_parts = re.split(r"\s+", name_to_check.lower())
                        if any(part in query_lower for part in name_parts if len(part) > 2) or name_to_check.lower() in query_lower:
                            target_provider = p
                            break

                if target_provider:
                    p_id = target_provider.get("id") or target_provider.get("provider_id")
                    p_name = (target_provider.get("user") or {}).get("full_name") or target_provider.get("provider_name") or "Provider"
                    if p_id:
                        slots_data = await _get(f"/api/customer/providers/{p_id}/slots", bearer_token, {"date": date_param})
                        if slots_data and not _has_error(slots_data):
                            slots_list = slots_data.get("data", {}).get("available_slots", []) if isinstance(slots_data, dict) else slots_data
                            results.append(_to_tool_result("get_slots", {
                                "provider_name": p_name,
                                "date": date_param,
                                "available_slots": slots_list
                            }))

    # ── get_dashboard ──────────────────────────────────────────────────────────
    # Provider : GET /api/provider/dashboard
    # Admin    : GET /api/admin/dashboard
    # Customer : GET /api/customer/dashboard
    if "get_dashboard" in tool_hints or any(
        kw in query_lower
        for kw in ["dashboard", "stats", "summary", "overview", "total"]
    ):
        if user_role == "provider":
            data = await _get("/api/provider/dashboard", bearer_token)
        elif user_role == "admin":
            data = await _get("/api/admin/dashboard", bearer_token)
        else:
            data = await _get("/api/customer/dashboard", bearer_token)
        if data is not None and not _has_error(data):
            results.append(_to_tool_result("get_dashboard", data))

    # ── get_availability ───────────────────────────────────────────────────────
    # Provider only: GET /api/availability
    if "get_availability" in tool_hints or "availability" in query_lower or (
        user_role == "provider" and "slots" in query_lower and any(kw in query_lower for kw in ["allow", "set", "activ", "schedul", "recur", "config"])
    ):
        if user_role == "provider":
            data = await _get("/api/availability", bearer_token)
            if data is not None and not _has_error(data):
                # Map day_of_week (0=Monday...6=Sunday) to human readable names for the LLM
                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                if isinstance(data, dict) and "data" in data:
                    inner_data = data["data"]
                    if isinstance(inner_data, dict):
                        slots = inner_data.get("slots", [])
                        if isinstance(slots, list):
                            for slot in slots:
                                if isinstance(slot, dict) and slot.get("day_of_week") is not None:
                                    idx = slot["day_of_week"]
                                    if 0 <= idx < len(days):
                                        slot["day_of_week"] = f"{days[idx]} ({idx})"
                results.append(_to_tool_result("get_availability", data))

    # ── get_profile ─────────────────────────────────────────────────────────────
    # Provider : GET /api/provider/profile
    if "get_profile" in tool_hints or any(
        kw in query_lower
        for kw in ["my rating", "my profile", "my specialization", "my experience",
                    "my location", "my fee", "my review", "average rating",
                    "about me", "my info", "my details", "my consultation"]
    ):
        if user_role == "provider":
            data = await _get("/api/provider/profile", bearer_token)
            if data is not None and not _has_error(data):
                # Dynamically calculate rating from actual reviews to ensure consistency
                reviews_data = await _get("/api/provider/reviews", bearer_token)
                if reviews_data and not _has_error(reviews_data):
                    reviews_list = []
                    if isinstance(reviews_data, dict):
                        if "data" in reviews_data:
                            inner = reviews_data["data"]
                            if isinstance(inner, dict):
                                reviews_list = inner.get("reviews", [])
                            elif isinstance(inner, list):
                                reviews_list = inner
                        else:
                            reviews_list = reviews_data.get("reviews", [])
                    if reviews_list:
                        total_rating = sum(float(r.get("rating", 0)) for r in reviews_list)
                        avg_rating = total_rating / len(reviews_list)
                        highest_rating = max(float(r.get("rating", 0)) for r in reviews_list)
                        lowest_rating = min(float(r.get("rating", 0)) for r in reviews_list)
                        total_reviews = len(reviews_list)
                        
                        # Update the returned data structure
                        if isinstance(data, dict):
                            if "data" in data and isinstance(data["data"], dict) and "provider" in data["data"]:
                                data["data"]["provider"]["avg_rating"] = round(avg_rating, 2)
                                data["data"]["provider"]["total_reviews"] = total_reviews
                                data["data"]["provider"]["highest_rating"] = highest_rating
                                data["data"]["provider"]["lowest_rating"] = lowest_rating
                            elif "provider" in data:
                                data["provider"]["avg_rating"] = round(avg_rating, 2)
                                data["provider"]["total_reviews"] = total_reviews
                                data["provider"]["highest_rating"] = highest_rating
                                data["provider"]["lowest_rating"] = lowest_rating
                results.append(_to_tool_result("get_profile", data))

    # ── get_reviews ────────────────────────────────────────────────────────────
    # Provider : GET /api/provider/reviews
    # Customer : GET /api/customer/reviews
    if "get_reviews" in tool_hints or "review" in query_lower or "rating" in query_lower:
        if user_role == "provider":
            data = await _get("/api/provider/reviews", bearer_token)
        else:
            data = await _get("/api/customer/reviews", bearer_token)
        if data is not None and not _has_error(data):
            results.append(_to_tool_result("get_reviews", data))

    return results


# ── Parameter extractors ───────────────────────────────────────────────────────

def _extract_appointment_params(query: str) -> dict:
    """Extract status and date filter params from a natural-language query."""
    params: dict = {}
    q = query.lower()

    for status in ["confirmed", "pending", "cancelled", "completed", "no_show"]:
        if status in q or status.replace("_", " ") in q:
            params["status"] = status
            break

    today = date.today()
    if "today" in q:
        params["from_date"] = str(today)
        params["to_date"]   = str(today)
    elif "tomorrow" in q:
        tomorrow = today + timedelta(days=1)
        params["from_date"] = str(tomorrow)
        params["to_date"]   = str(tomorrow)
    elif "this week" in q:
        params["from_date"] = str(today)
        params["to_date"]   = str(today + timedelta(days=7))
    elif "next week" in q:
        params["from_date"] = str(today + timedelta(days=7))
        params["to_date"]   = str(today + timedelta(days=14))

    # Explicit YYYY-MM-DD date overrides keyword dates
    date_match = re.search(r"\d{4}-\d{2}-\d{2}", query)
    if date_match:
        params["from_date"] = date_match.group()
        params["to_date"]   = date_match.group()

    return params


def _extract_date(query: str) -> Optional[str]:
    """Extract YYYY-MM-DD date from query, falling back to today for 'today'."""
    match = re.search(r"\d{4}-\d{2}-\d{2}", query)
    if match:
        return match.group()
    if "today" in query.lower():
        return str(date.today())
    return None
