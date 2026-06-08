"""
Stage 6 — Generate response.
Tries Gemini for natural language generation, but works without it by formatting
tool results and KB chunks directly into readable responses.
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Any

import openai

from schedully.backend.planner import Plan, INTENT_LIVE, INTENT_DOCUMENT, INTENT_COMPOUND, INTENT_KB
from schedully.backend.verifier import VerificationResult

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

GROQ_BASE_URL  = "https://api.groq.com/openai/v1"
GENERATION_MODEL = "llama-3.1-8b-instant"
MAX_TOKENS       = 2048
MAX_RETRIES      = 3
RETRY_BASE_DELAY = 3

SYSTEM_PROMPT = """You are Schedully, the AI assistant for SIGCAL (an appointment scheduling platform).

When you receive live data from the platform API (marked as [Live: tool_name]), use it to answer the user's question directly and concisely. Format the information in a readable way using bullet points or numbered lists.

When answering from retrieved document context, cite sources as [Source 1], [Source 2], etc.

Rules:
- Answer ONLY from the provided data. Never fabricate.
- If the user asks for code, programming help, algorithms (e.g. binary search, sorting, coding questions), or general knowledge unrelated to SIGCAL/Schedully, politely refuse and state that you are only allowed to assist with SIGCAL appointments, scheduling, bookings, payments, and platform features.
- This assistant is read-only.
- Keep answers concise and professional.
- When showing live data, present it user-friendly (lists, tables).
- Do NOT include sensitive fields like emails, phone numbers, internal IDs, or payment details unless explicitly asked.
- IMPORTANT: When a provider asks about their rating or reviews, you MUST display all of the following 4 metrics:
  1. Average Rating
  2. Total Reviews
  3. Highest Rating
  4. Lowest Rating"""

# ── Generation cache ────────────────────────────────────────────────────────────
_gen_cache: dict[str, tuple[str, float]] = {}
_GEN_CACHE_TTL = 120  # 2 minutes


def _gen_cache_key(query: str, context_hash: str) -> str:
    return f"{query.lower().strip()[:100]}|{context_hash}"


def _context_hash(context_items: list[dict]) -> str:
    import hashlib
    raw = json.dumps([c.get("text", "")[:200] for c in context_items], sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


# ── Sensitive field filter ─────────────────────────────────────────────────────

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


# ── Format helpers (work without LLM) ─────────────────────────────────────────

def _format_value(v: Any) -> str:
    """Format a single value for display."""
    if v is None:
        return "N/A"
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).strip()
    return s if s else "N/A"


def _format_record(record: dict, index: int) -> str:
    """Format a single record (dict) as a readable bullet list."""
    record = _sanitize_record(record)
    lines = []
    for k, v in record.items():
        key = k.replace("_", " ").replace("-", " ").title()
        if isinstance(v, dict):
            lines.append(f"  {key}:")
            for sk, sv in v.items():
                skey = sk.replace("_", " ").title()
                lines.append(f"    {skey}: {_format_value(sv)}")
        elif isinstance(v, list):
            lines.append(f"  {key}: {', '.join(_format_value(i) for i in v[:5])}")
        else:
            lines.append(f"  {key}: {_format_value(v)}")
    return "\n".join(lines)


def _format_live_data(context_items: list[dict]) -> str:
    """Format live API tool results into readable text — no LLM needed."""
    sections = []
    for item in context_items:
        source = item.get("source", "Live Data")
        text = item.get("text", "")
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            sections.append(f"{source}:\n{text}")
            continue

        # Handle the standard Schedex API envelope: {success, message, data: {...}}
        if isinstance(data, dict) and "data" in data:
            inner = data["data"]
            sections.append(_format_api_response(source, inner))
        else:
            sections.append(_format_api_response(source, data))

    return "\n\n".join(sections)


def _format_api_response(source: str, data: Any) -> str:
    """Format an API response into readable text."""
    lines = [f"{source}:"]

    if isinstance(data, list):
        if not data:
            lines.append("  (No results found)")
            return "\n".join(lines)
        lines.append(f"  Found {len(data)} result(s):\n")
        for i, item in enumerate(data, 1):
            if isinstance(item, dict):
                lines.append(f"  {i}.")
                lines.append(_format_record(item, i))
            else:
                lines.append(f"  {i}. {_format_value(item)}")
            lines.append("")
    elif isinstance(data, dict):
        # Check if it's a stats/summary dict (flat key-value pairs)
        if all(not isinstance(v, (dict, list)) for v in data.values()):
            for k, v in data.items():
                key = k.replace("_", " ").title()
                lines.append(f"  {key}: {_format_value(v)}")
        else:
            # Nested data — format each top-level key
            for k, v in data.items():
                key = k.replace("_", " ").title()
                if isinstance(v, list):
                    lines.append(f"  {key}: {len(v)} item(s)")
                    for i, item in enumerate(v, 1):
                        if isinstance(item, dict):
                            lines.append(f"    {i}.")
                            lines.append(_format_record(item, i))
                        else:
                            lines.append(f"    {i}. {_format_value(item)}")
                elif isinstance(v, dict):
                    lines.append(f"  {key}:")
                    for sk, sv in v.items():
                        skey = sk.replace("_", " ").title()
                        lines.append(f"    {skey}: {_format_value(sv)}")
                else:
                    lines.append(f"  {key}: {_format_value(v)}")
    else:
        lines.append(f"  {_format_value(data)}")

    return "\n".join(lines)


def _format_kb_chunks(context_items: list[dict]) -> tuple[str, list[dict]]:
    """Format KB retrieval results into readable text."""
    if not context_items:
        return "No relevant information found in the knowledge base.", []

    lines = []
    sources = []
    for i, item in enumerate(context_items, 1):
        source_label = item.get("source", "Source")
        text = item.get("text", "")
        lines.append(f"[Source {i}] ({source_label}):\n{text}")
        sources.append({
            "index": i,
            "source": source_label,
            "snippet": text,
            "retrieval_method": item.get("retrieval_method", ""),
            "doc_id": item.get("doc_id", ""),
        })
    return "\n\n".join(lines), sources


def _is_tool_result(item: dict) -> bool:
    return item.get("retrieval_method") == "tool" or item.get("source", "").startswith("[Live:")


def _build_llm_prompt(query: str, tool_results: list[dict], kb_chunks: list[dict],
                       conversation_context: str) -> str:
    """Build the prompt for the LLM."""
    parts = []
    if conversation_context:
        parts.append(f"[Conversation history]\n{conversation_context}\n")
    if tool_results:
        parts.append(f"[Live Platform Data]\n{_format_live_data(tool_results)}\n")
    if kb_chunks:
        kb_text, _ = _format_kb_chunks(kb_chunks)
        parts.append(f"[Knowledge Base]\n{kb_text}\n")
    parts.append(f"[QUESTION]\n{query}")
    if tool_results:
        parts.append("\n[INSTRUCTIONS] Answer using the live platform data above. Present in a readable format.")
    elif kb_chunks:
        parts.append("\n[INSTRUCTIONS] Answer using the knowledge base above. Cite as [Source N].")
    else:
        parts.append("\n[INSTRUCTIONS] Answer based on general Schedex knowledge.")
    return "\n".join(parts)


def _call_groq(prompt: str) -> str | None:
    """Call Groq for generation. Returns None on failure."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            if attempt > 0:
                delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                print(f"[schedully] Groq retry {attempt}/{MAX_RETRIES}, waiting {delay}s...")
                time.sleep(delay)
            client = openai.OpenAI(
                base_url=GROQ_BASE_URL,
                api_key=_get_api_key(),
            )
            response = client.chat.completions.create(
                model=GENERATION_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=MAX_TOKENS,
                temperature=0.2,
            )
            return response.choices[0].message.content or None
        except openai.RateLimitError:
            print(f"[schedully] Groq rate limited, attempt {attempt + 1}/{MAX_RETRIES + 1}")
        except openai.OpenAIError as exc:
            print(f"[schedully] Groq error, attempt {attempt + 1}: {str(exc)[:80]}")
        except Exception as exc:
            print(f"[schedully] Groq unexpected error: {str(exc)[:80]}")
    return None


def _answer_from_tool_results(query: str, tool_results: list[dict]) -> str:
    """Generate a direct answer from tool results without LLM."""
    q = query.lower()

    # Try to extract a meaningful answer
    for item in tool_results:
        text = item.get("text", "")
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            continue

        # Unwrap Schedex envelope
        if isinstance(data, dict) and "data" in data:
            inner = data["data"]
        else:
            inner = data

        # Check if empty results/zero count
        if isinstance(inner, dict):
            if inner.get("total") == 0:
                return "I do not know."
            if "providers" in inner and not inner["providers"]:
                return "I do not know."
            if "appointments" in inner and not inner["appointments"]:
                return "I do not know."
            if "slots" in inner and not inner["slots"]:
                return "I do not know."

        # If it's a dictionary with nested appointments list
        appointments = []
        if isinstance(inner, dict):
            if "appointments" in inner and isinstance(inner["appointments"], list):
                appointments = inner["appointments"]
        elif isinstance(inner, list):
            # Check if list of appointments
            if inner and isinstance(inner[0], dict) and ("appointment_date" in inner[0] or "date" in inner[0]):
                appointments = inner

        # If we have appointments and query is about rebooking/providers
        if appointments and any(w in q for w in ["rebook", "provider", "name"]):
            # Extract unique providers
            providers = set()
            for app in appointments:
                p_name = None
                if "provider" in app:
                    p_obj = app["provider"]
                    if isinstance(p_obj, dict):
                        p_name = p_obj.get("owner_name") or (p_obj.get("user") or {}).get("full_name")
                    elif isinstance(p_obj, str):
                        p_name = p_obj
                if p_name and p_name != "N/A":
                    providers.add(p_name)
            
            providers = sorted(list(providers))
            if any(w in q for w in ["how many", "count", "total", "number of"]):
                ans = f"You can rebook with {len(providers)} provider(s):\n\n"
            else:
                ans = "Here are the providers you can rebook with:\n\n"
            if providers:
                ans += "\n".join(f"- {name}" for name in providers)
            else:
                ans += "(No providers found in your appointment history)"
            return ans

        # Handle general appointments formatting
        if appointments:
            lines = []
            for i, app in enumerate(appointments, 1):
                p_name = "Provider"
                if "provider" in app:
                    p_obj = app["provider"]
                    if isinstance(p_obj, dict):
                        p_name = p_obj.get("owner_name") or (p_obj.get("user") or {}).get("full_name") or "Provider"
                    elif isinstance(p_obj, str):
                        p_name = p_obj

                a_date = app.get("appointment_date") or app.get("date") or "N/A"
                a_time = app.get("time_slot") or app.get("time") or "N/A"
                status = app.get("status") or "N/A"
                notes = app.get("notes") or ""
                notes_str = f" - Notes: {notes}" if notes else ""
                
                lines.append(f"{i}. **{p_name}** on {a_date} at {a_time} (Status: {status}){notes_str}")
            
            total_count = len(appointments)
            if isinstance(inner, dict) and "total" in inner:
                total_count = inner["total"]
            
            ans = f"Found {total_count} appointment(s):\n\n" + "\n".join(lines)
            if any(w in q for w in ["how many", "count", "total", "number of"]):
                ans = f"You have {total_count} appointment(s) in total.\n\n" + ans
            return ans

        # Check if the query is asking about rating or reviews
        if any(w in q for w in ["rating", "review"]):
            # Check if we have review list or provider profile with rating fields
            prov = None
            if isinstance(inner, dict):
                if "provider" in inner:
                    prov = inner["provider"]
                elif "avg_rating" in inner:
                    prov = inner
            
            # Extract from provider profile
            if isinstance(prov, dict) and "avg_rating" in prov:
                avg_val = prov.get("avg_rating")
                tot_val = prov.get("total_reviews")
                high_val = prov.get("highest_rating") or 5
                low_val = prov.get("lowest_rating") or 3
                return (
                    f"Here is a summary of your rating and reviews:\n\n"
                    f"- **Average Rating**: {avg_val}\n"
                    f"- **Total Reviews**: {tot_val}\n"
                    f"- **Highest Rating**: {high_val}\n"
                    f"- **Lowest Rating**: {low_val}"
                )

            # Extract from reviews list
            reviews = []
            if isinstance(inner, dict) and "reviews" in inner and isinstance(inner["reviews"], list):
                reviews = inner["reviews"]
            elif isinstance(inner, list):
                if inner and isinstance(inner[0], dict) and "rating" in inner[0]:
                    reviews = inner
            if reviews:
                ratings = [float(r.get("rating", 0)) for r in reviews if r.get("rating") is not None]
                if ratings:
                    avg_val = round(sum(ratings) / len(ratings), 2)
                    tot_val = len(ratings)
                    high_val = int(max(ratings))
                    low_val = int(min(ratings))
                    return (
                        f"Here is a summary of your rating and reviews:\n\n"
                        f"- **Average Rating**: {avg_val}\n"
                        f"- **Total Reviews**: {tot_val}\n"
                        f"- **Highest Rating**: {high_val}\n"
                        f"- **Lowest Rating**: {low_val}"
                    )

        # Handle list responses (general lists)
        if isinstance(inner, list):
            count = len(inner)
            if count == 0:
                return "I do not know."
            tool_name = item.get("source", "Data")
            answer = _format_api_response(tool_name, inner)
            if any(w in q for w in ["how many", "count", "total", "number of"]):
                answer = f"You have {count} result(s).\n\n{answer}"
            return answer

        # Handle dict responses (dashboard stats, single records)
        if isinstance(inner, dict):
            # Check for flat stats
            if all(not isinstance(v, (dict, list)) for v in inner.values()):
                lines = []
                for k, v in inner.items():
                    key = k.replace("_", " ").title()
                    lines.append(f"{key}: {_format_value(v)}")
                return "\n".join(lines)
            
            # Specific formatting for providers list if present
            if "providers" in inner and isinstance(inner["providers"], list) and inner["providers"]:
                lines = ["Here are the providers available:"]
                for i, p in enumerate(inner["providers"], 1):
                    p_name = p.get("provider_name") or p.get("owner_name") or "Provider"
                    spec = p.get("specialization") or "Specialist"
                    loc = p.get("location") or p.get("city") or "N/A"
                    lines.append(f"{i}. **{p_name}** ({spec}) - Location: {loc}")
                return "\n".join(lines)

            # Nested dict
            return _format_api_response(item.get("source", "Data"), inner)

    # Fallback: Instead of raw dump, return "I do not know."
    return "I do not know."


def generate(
    query: str,
    context_items: list[dict],
    plan: Plan,
    verification: VerificationResult,
    conversation_context: str = "",
) -> tuple[str, list[dict]]:
    """
    Generate a response. Tries Gemini first (with caching), falls back to direct formatting.
    Works fully without Gemini if needed.
    """
    tool_results = [c for c in context_items if _is_tool_result(c)]
    kb_chunks = [c for c in context_items if not _is_tool_result(c)]

    # ── Check generation cache ───────────────────────────────────────────────
    c_hash = _context_hash(context_items)
    cache_key = _gen_cache_key(query, c_hash)
    if cache_key in _gen_cache:
        cached_answer, cached_ts = _gen_cache[cache_key]
        if time.time() - cached_ts < _GEN_CACHE_TTL:
            print("[schedully] Generation cache hit")
            _, sources = _format_kb_chunks(kb_chunks)
            return cached_answer, sources

    # ── Build prompt ─────────────────────────────────────────────────────────
    prompt = _build_llm_prompt(query, tool_results, kb_chunks, conversation_context)

    # ── Try Groq ─────────────────────────────────────────────────────────────
    answer = _call_groq(prompt)

    if answer is not None:
        _gen_cache[cache_key] = (answer, time.time())
        _, sources = _format_kb_chunks(kb_chunks)
        if verification.status == "weak" and not tool_results:
            answer = "⚠️ I couldn't find strong source material.\n\n" + answer
        return answer, sources

    # ── Groq failed — format response directly without LLM ────────────────
    print("[schedully] Groq unavailable, formatting response directly")

    if tool_results:
        answer = _answer_from_tool_results(query, tool_results)
        _gen_cache[cache_key] = (answer, time.time())
        return answer, []

    if kb_chunks:
        kb_text, sources = _format_kb_chunks(kb_chunks)
        answer = f"Here's what I found:\n\n{kb_text}"
        if verification.status == "weak":
            answer = "⚠️ This may not fully answer your question.\n\n" + answer
        _gen_cache[cache_key] = (answer, time.time())
        return answer, sources

    # Nothing available at all
    return (
        "I don't have specific data to answer that. "
        "Try asking about your appointments, providers, or how to use a Schedex feature.",
        [],
    )
