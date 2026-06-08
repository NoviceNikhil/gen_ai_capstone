"""
Stage 2 — Orchestrator
Dispatches retrieval and tool calls in parallel, runs the repair loop,
and drives the full RAG pipeline from query to final answer.
"""

import asyncio
import re

from schedully.backend.planner import (
    Plan, classify_and_plan, is_prompt_injection,
    INTENT_CLARIFY, INTENT_OOS, INTENT_LIVE,
    INTENT_KB, INTENT_DOCUMENT, INTENT_COMPOUND,
)
from schedully.backend.hybrid_retriever import hybrid_retrieve, RetrievalResult, SHARED_KB_TENANT
from schedully.backend.tool_layer import run_tools
from schedully.backend.reranker import fuse_and_rerank
from schedully.backend.verifier import verify, VerificationResult
from schedully.backend.generator import generate
from schedully.backend.memory import SessionMemory

MAX_REPAIR_ATTEMPTS = 2

# ── Conversational patterns that should bypass the full RAG pipeline ──────────
_GREETING_RE = re.compile(
    r"\b(hi|hello|hey|hi there|hello there|hey there|good morning|good afternoon|good evening|howdy|sup|yo|greetings)\b",
    re.IGNORECASE,
)
_IDENTITY_RE = re.compile(
    r"\b(who are you|what are you|what is your name|what do you do|tell me about yourself|about you|introduce yourself)\b",
    re.IGNORECASE,
)
_APP_ABOUT_RE = re.compile(
    r"\b(what is Schedex|what is this (app|application|platform|website)|what does Schedex do|tell me about Schedex|about Schedex|about this (app|platform|application|website)|what is this)\b",
    re.IGNORECASE,
)
_HOW_ARE_YOU_RE = re.compile(
    r"\b(how are you|how('s| is) it going|what('s| is) up|how do you do|how have you been)\b",
    re.IGNORECASE,
)
_THANKS_RE = re.compile(
    r"\b(thank|thanks|thx|ty|appreciate)\b",
    re.IGNORECASE,
)
_BYE_RE = re.compile(
    r"\b(bye|goodbye|see you|later|take care|cya)\b",
    re.IGNORECASE,
)

_GREETING_RESPONSES = [
    "Hello! I'm Schedully, your AI assistant for Schedex. How can I help you today?",
    "Hi there! I'm Schedully. Ask me anything about Schedex — booking appointments, managing your schedule, or how features work.",
    "Hey! I'm Schedully, the Schedex assistant. What can I help you with?",
]

_IDENTITY_RESPONSE = (
    "I'm Schedully, the AI assistant built into Schedex — an appointment scheduling platform. "
    "I can help you with booking appointments, managing your schedule, understanding platform features, "
    "and answering questions about your account. What would you like to know?"
)

_APP_ABOUT_RESPONSE = (
    "Schedex (Sigslot) is an appointment scheduling platform that connects customers with service providers. "
    "Customers can browse providers, book appointments, join waitlists, and manage their bookings. "
    "Providers can set availability, manage appointments, track revenue, and sync with Google Calendar. "
    "The platform also supports organizations, payments via Razorpay, and admin management tools. "
    "I'm Schedully, your AI assistant — ask me anything about how to use Schedex!"
)

_HOW_ARE_YOU_RESPONSES = [
    "I'm doing great, thanks for asking! How can I help you with Schedex today?",
    "I'm here and ready to help! What would you like to know about Schedex?",
    "All good! What can I help you with — appointments, providers, or something else?",
]

_THANKS_RESPONSE = (
    "You're welcome! Let me know if there's anything else about Schedex I can help with."
)

_BYE_RESPONSE = (
    "Goodbye! Feel free to come back anytime you need help with Schedex."
)


def _match_conversational(query: str) -> str | None:
    """Check if the query is a simple conversational message. Returns a canned response or None."""
    import random

    # Check identity and app-about first (more specific)
    if _IDENTITY_RE.search(query):
        return _IDENTITY_RESPONSE
    if _APP_ABOUT_RE.search(query):
        return _APP_ABOUT_RESPONSE
    if _HOW_ARE_YOU_RE.search(query):
        return random.choice(_HOW_ARE_YOU_RESPONSES)
    if _THANKS_RE.search(query):
        return _THANKS_RESPONSE
    if _BYE_RE.search(query):
        return _BYE_RESPONSE
    if _GREETING_RE.search(query):
        return random.choice(_GREETING_RESPONSES)
    return None


def _fast_path_plan(query: str, user_role: str) -> Plan | None:
    q = query.lower()
    
    # 1. Upcoming appointments query
    if "upcoming" in q and ("appointment" in q or "booking" in q):
        return Plan(
            intent=INTENT_LIVE,
            sub_queries=[query],
            tool_hints=["get_appointments"],
            raw_query=query
        )
        
    # 2. General list appointments query
    if "my appointments" in q or "list appointments" in q or "show appointments" in q or "appointments i have" in q:
        return Plan(
            intent=INTENT_LIVE,
            sub_queries=[query],
            tool_hints=["get_appointments"],
            raw_query=query
        )

    # 3. Dentists in Hyderabad query
    if "dentist" in q and "hyderabad" in q:
        return Plan(
            intent=INTENT_LIVE,
            sub_queries=["dentists in hyderabad"],
            tool_hints=["get_providers"],
            raw_query=query
        )

    # 4. Cardiologists in Mumbai query
    if "cardiologist" in q and "mumbai" in q:
        return Plan(
            intent=INTENT_LIVE,
            sub_queries=["cardiologists in mumbai"],
            tool_hints=["get_providers"],
            raw_query=query
        )

    # 5. General providers list query
    if "list providers" in q or "available providers" in q or "show providers" in q or "list out providers" in q:
        return Plan(
            intent=INTENT_LIVE,
            sub_queries=[query],
            tool_hints=["get_providers"],
            raw_query=query
        )

    return None


async def chat(
    user_message: str,
    session_memory: SessionMemory,
    tenant_id: str,
    user_id: str,
    user_role: str,
    bearer_token: str,
    mode: str = "normal",
) -> dict:
    """
    Top-level entry point for a single chat turn.

    Returns:
        {
            "answer":          str,
            "sources":         list[dict],
            "intent":          str,
            "clarification":   str | None,
            "repair_attempts": int,
            "verification":    str,   # "grounded" | "weak"
        }
    """
    # ── Prompt injection guard ─────────────────────────────────────────────────
    if is_prompt_injection(user_message):
        return {
            "answer": (
                "I can't help with that. "
                "Is there something about Schedex I can assist you with?"
            ),
            "sources": [],
            "intent": "blocked",
            "clarification": None,
            "repair_attempts": 0,
            "verification": "grounded",
        }

    # ── Conversational short-circuit ────────────────────────────────────────────
    if mode == "rag":
        import random
        if _HOW_ARE_YOU_RE.search(user_message):
            conversational_reply = random.choice(_HOW_ARE_YOU_RESPONSES)
        elif _THANKS_RE.search(user_message):
            conversational_reply = _THANKS_RESPONSE
        elif _BYE_RE.search(user_message):
            conversational_reply = _BYE_RESPONSE
        elif _GREETING_RE.search(user_message):
            conversational_reply = random.choice(_GREETING_RESPONSES)
        else:
            conversational_reply = None
    else:
        conversational_reply = _match_conversational(user_message)

    if conversational_reply is not None:
        session_memory.add_turn("user", user_message)
        session_memory.add_turn("assistant", conversational_reply)
        return {
            "answer": conversational_reply,
            "sources": [],
            "intent": "conversational",
            "clarification": None,
            "repair_attempts": 0,
            "verification": "grounded",
        }

    # ── Stage 1: Plan ──────────────────────────────────────────────────────────
    context_str = session_memory.get_context_string()
    # Check fast path first to bypass LLM plan for standard queries
    plan = _fast_path_plan(user_message, user_role)
    if plan is None:
        plan = classify_and_plan(
            user_message,
            conversation_context=context_str,
            user_role=user_role,
        )

    if mode == "normal":
        if plan.intent == INTENT_DOCUMENT:
            plan.intent = INTENT_KB
        elif plan.intent == INTENT_COMPOUND:
            plan.intent = INTENT_LIVE
    elif mode == "rag":
        if plan.intent == INTENT_LIVE:
            plan.intent = INTENT_KB
        elif plan.intent == INTENT_COMPOUND:
            plan.intent = INTENT_DOCUMENT

    # ── Short-circuit: clarification needed ───────────────────────────────────
    if plan.intent == INTENT_CLARIFY:
        reply = plan.clarification_question or "Could you clarify your question?"
        session_memory.add_turn("user", user_message)
        session_memory.add_turn("assistant", reply)
        return {
            "answer": reply,
            "sources": [],
            "intent": INTENT_CLARIFY,
            "clarification": plan.clarification_question,
            "repair_attempts": 0,
            "verification": "grounded",
        }

    # ── Short-circuit: out of scope ────────────────────────────────────────────
    if plan.intent == INTENT_OOS:
        reply = (
            "I can only help with Schedex. "
            "Want me to look up your appointments or walk you through a feature?"
        )
        session_memory.add_turn("user", user_message)
        session_memory.add_turn("assistant", reply)
        return {
            "answer": reply,
            "sources": [],
            "intent": INTENT_OOS,
            "clarification": None,
            "repair_attempts": 0,
            "verification": "grounded",
        }

    # ── Repair loop ────────────────────────────────────────────────────────────
    repair_attempt = 0
    top_k = 8   # grows by 4 on each repair attempt

    while True:
        retrieval_task = None
        tool_task = None

        # Stage 3a — hybrid retrieval (KB, document, compound)
        if plan.intent in (INTENT_KB, INTENT_DOCUMENT, INTENT_COMPOUND):
            retrieval_tenant_id = SHARED_KB_TENANT if mode == "normal" else tenant_id
            retrieval_task = asyncio.create_task(
                asyncio.to_thread(
                    hybrid_retrieve,
                    sub_queries=plan.sub_queries,
                    tenant_id=retrieval_tenant_id,
                    top_k=top_k,
                )
            )

        # Stage 3b — live tool calls (live_data, compound)
        if plan.intent in (INTENT_LIVE, INTENT_COMPOUND):
            tool_task = asyncio.create_task(
                run_tools(
                    plan=plan,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    user_role=user_role,
                    bearer_token=bearer_token,
                )
            )

        retrieved_chunks: list[RetrievalResult] = []
        tool_results: list[dict] = []

        if retrieval_task:
            retrieved_chunks = await retrieval_task
        if tool_task:
            tool_results = await tool_task

        # Stage 4 — fuse + rerank
        fused = fuse_and_rerank(retrieved_chunks, plan.sub_queries)

        # Stage 5 — verify
        all_context = fused + tool_results
        verification: VerificationResult = verify(
            query=user_message,
            context_items=all_context,
            plan=plan,
        )

        if verification.status == "grounded" or repair_attempt >= MAX_REPAIR_ATTEMPTS:
            break

        # Repair: widen retrieval width and retry
        repair_attempt += 1
        top_k += 4

    # Stage 6 — generate + cite
    answer, sources = generate(
        query=user_message,
        context_items=all_context,
        plan=plan,
        verification=verification,
        conversation_context=context_str,
    )

    # Update memory
    session_memory.add_turn("user", user_message)
    session_memory.add_turn("assistant", answer)

    return {
        "answer": answer,
        "sources": sources,
        "intent": plan.intent,
        "clarification": None,
        "repair_attempts": repair_attempt,
        "verification": verification.status,
    }
