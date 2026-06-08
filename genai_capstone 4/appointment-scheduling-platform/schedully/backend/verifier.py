"""
Stage 5 — Verify
Three lightweight checks that score context quality before generation.
Combined score < 0.5 → "weak" → triggers repair loop in orchestrator.
"""

import re
from dataclasses import dataclass, field

from schedully.backend.planner import Plan, INTENT_LIVE


@dataclass
class VerificationResult:
    status: str              # "grounded" | "weak"
    grounding_score: float
    contradiction_score: float
    coverage_score: float
    combined_score: float
    weak_reason: str = ""


def _word_overlap(a: str, b: str) -> float:
    """Jaccard similarity of word sets."""
    words_a = set(re.findall(r"\w+", a.lower()))
    words_b = set(re.findall(r"\w+", b.lower()))
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


def grounding_check(query: str, context_items: list[dict]) -> float:
    """
    Check 1 — Grounding: are there context items that overlap with the query?
    Score: 1.0 if ≥2 relevant items, 0.6 if 1, 0.4 if items present but low overlap,
           0.0 if no context at all.
    """
    if not context_items:
        return 0.0
    relevant = [
        c for c in context_items
        if _word_overlap(query, c.get("text", "")) > 0.08
    ]
    if len(relevant) >= 2:
        return 1.0
    elif len(relevant) == 1:
        return 0.6
    elif len(context_items) >= 1:
        return 0.4   # have context but low overlap (e.g. live tool data)
    return 0.0


def contradiction_check(context_items: list[dict]) -> float:
    """
    Check 2 — Contradiction: do multiple chunks carry heavy negation about similar topics?
    Heuristic only. Score: 1.0 if no contradiction detected, 0.3 if potential conflict.
    """
    texts = [c.get("text", "").lower() for c in context_items]
    pattern = re.compile(
        r"\b(not|never|no|cannot|can't|won't|doesn't|isn't|aren't|wasn't|weren't)\b"
    )
    negation_counts = [len(pattern.findall(t)) for t in texts]
    high_negation = [n for n in negation_counts if n > 5]
    if len(high_negation) >= 2:
        return 0.3
    return 1.0


def coverage_check(query: str, context_items: list[dict], plan: Plan) -> float:
    """
    Check 3 — Coverage: does the context cover the query topic?
    live_data intent always passes (tool results are definitive).
    """
    if plan.intent == INTENT_LIVE:
        return 1.0
    if not context_items:
        return 0.0
    max_overlap = max(
        _word_overlap(query, c.get("text", "")) for c in context_items
    )
    if max_overlap >= 0.15:
        return 1.0
    elif max_overlap >= 0.08:
        return 0.6
    return 0.2


def verify(
    query: str,
    context_items: list[dict],
    plan: Plan,
) -> VerificationResult:
    """
    Run all three verification checks.
    combined_score = weighted average; < 0.5 → "weak" → triggers repair loop.
    """
    g   = grounding_check(query, context_items)
    c   = contradiction_check(context_items)
    cov = coverage_check(query, context_items, plan)

    # Weights: grounding most critical
    combined = (g * 0.4) + (c * 0.3) + (cov * 0.3)
    status   = "grounded" if combined >= 0.5 else "weak"

    weak_reason = ""
    if status == "weak":
        reasons = []
        if g   < 0.4: reasons.append("low grounding")
        if c   < 0.5: reasons.append("possible contradiction")
        if cov < 0.4: reasons.append("low coverage")
        weak_reason = ", ".join(reasons)

    return VerificationResult(
        status=status,
        grounding_score=g,
        contradiction_score=c,
        coverage_score=cov,
        combined_score=combined,
        weak_reason=weak_reason,
    )
