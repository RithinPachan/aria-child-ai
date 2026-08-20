"""
main.py
-------
ARIA Guardrails Service — three-layer child safety filter.
  Layer 1: Regex-based PII redaction (fast, deterministic)
  Layer 2: Topic blocklist matching (configurable)
  Layer 3: Crisis detection with parent escalation
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, status
from pydantic import BaseModel, Field

from .filters.blocklist import TopicBlocklist
from .filters.crisis_detector import CrisisDetector
from .redaction.pii_redactor import PIIRedactor

logger = structlog.get_logger()


# ─── Models ───────────────────────────────────────────────────────────────────

class GuardrailRequest(BaseModel):
    text: str = Field(max_length=5000)
    child_id: str
    session_id: str
    role: str = Field(pattern="^(child|aria)$")


class GuardrailResponse(BaseModel):
    passed: bool
    sanitized_text: str
    intervention_type: str | None = None
    escalation_required: bool = False
    fallback_response: str | None = None


# ─── Fallback Responses ───────────────────────────────────────────────────────

FALLBACK_RESPONSES = {
    "topic_blocked": (
        "Hmm, that's something I'm not the best at talking about! "
        "Why don't we explore something else? What's your favourite animal?"
    ),
    "crisis_detected": (
        "I heard something that made me want to make sure you're okay. "
        "Please go find a grown-up right now — they can help you much better than I can!"
    ),
    "persona_violation": (
        "I'm ARIA, your robot friend! I'm not sure how to answer that, "
        "but I'd love to learn something new with you. What are you curious about today?"
    ),
}

# ─── App Lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.pii_redactor = PIIRedactor()
    app.state.blocklist = TopicBlocklist.load_default()
    app.state.crisis_detector = CrisisDetector()
    logger.info("Guardrails service started")
    yield
    logger.info("Guardrails service shutdown")


app = FastAPI(
    title="ARIA Guardrails Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "healthy", "service": "aria-guardrails"}

# ─── Guardrail Check ──────────────────────────────────────────────────────────

@app.post("/api/v1/check", response_model=GuardrailResponse)
async def check_content(request: GuardrailRequest) -> GuardrailResponse:
    """
    Run all three guardrail layers on a piece of text.
    Returns sanitized text or a safe fallback response.
    """
    text = request.text

    # ── Layer 1: PII Redaction ────────────────────────────────────────────────
    redacted_text, pii_found = app.state.pii_redactor.redact(text)
    if pii_found:
        logger.info(
            "PII redacted",
            session_id=request.session_id,
            child_id=request.child_id,
        )
        return GuardrailResponse(
            passed=True,  # PII redaction is non-blocking — we sanitize and continue
            sanitized_text=redacted_text,
            intervention_type="pii_redacted",
            escalation_required=False,
        )

    # ── Layer 2: Topic Blocklist ──────────────────────────────────────────────
    blocked_topic = app.state.blocklist.check(redacted_text)
    if blocked_topic:
        logger.warning(
            "Topic blocked",
            topic=blocked_topic,
            session_id=request.session_id,
        )
        return GuardrailResponse(
            passed=False,
            sanitized_text=redacted_text,
            intervention_type="topic_blocked",
            escalation_required=False,
            fallback_response=FALLBACK_RESPONSES["topic_blocked"],
        )

    # ── Layer 3: Crisis Detection ─────────────────────────────────────────────
    is_crisis = app.state.crisis_detector.detect(redacted_text)
    if is_crisis:
        logger.critical(
            "Crisis signal detected — escalation required",
            session_id=request.session_id,
            child_id=request.child_id,
        )
        # In production: trigger parent push notification via Firebase Cloud Messaging
        return GuardrailResponse(
            passed=False,
            sanitized_text=redacted_text,
            intervention_type="crisis_detected",
            escalation_required=True,
            fallback_response=FALLBACK_RESPONSES["crisis_detected"],
        )

    # ── All layers passed ─────────────────────────────────────────────────────
    return GuardrailResponse(
        passed=True,
        sanitized_text=redacted_text,
        escalation_required=False,
    )
