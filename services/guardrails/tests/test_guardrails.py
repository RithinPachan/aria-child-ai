"""
test_guardrails.py
------------------
Unit tests for all three guardrail layers:
  - PII redaction
  - Topic blocklist
  - Crisis detection
"""

import pytest
from httpx import AsyncClient, ASGITransport

from src.main import app
from src.redaction.pii_redactor import PIIRedactor
from src.filters.blocklist import TopicBlocklist
from src.filters.crisis_detector import CrisisDetector


async def _check_content(payload: dict[str, str]) -> dict:
    """Send an endpoint request with the same lifespan startup used in production."""
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/v1/check", json=payload)
    assert response.status_code == 200
    return response.json()


# ─── PII Redactor Tests ───────────────────────────────────────────────────────

class TestPIIRedactor:
    def setup_method(self):
        self.redactor = PIIRedactor()

    def test_redacts_phone_number(self):
        text, found = self.redactor.redact("Call me at 555-867-5309")
        assert "[PHONE]" in text
        assert found is True

    def test_redacts_email(self):
        text, found = self.redactor.redact("My email is child@example.com")
        assert "[EMAIL]" in text
        assert found is True

    def test_redacts_street_address(self):
        text, found = self.redactor.redact("I live at 123 Maple Street")
        assert "[ADDRESS]" in text
        assert found is True

    def test_clean_text_not_modified(self):
        clean = "I love dinosaurs and my favourite colour is blue"
        text, found = self.redactor.redact(clean)
        assert text == clean
        assert found is False

    def test_multiple_pii_types_in_one_string(self):
        text, found = self.redactor.redact(
            "Email me at test@test.com or call 555-123-4567"
        )
        assert "[EMAIL]" in text
        assert "[PHONE]" in text
        assert found is True


# ─── Topic Blocklist Tests ────────────────────────────────────────────────────

class TestTopicBlocklist:
    def setup_method(self):
        self.blocklist = TopicBlocklist.load_default()

    def test_blocks_violent_content(self):
        result = self.blocklist.check("I want to kill the dragon in the game")
        assert result == "violence"

    def test_blocks_drug_references(self):
        result = self.blocklist.check("What is cocaine?")
        assert result == "dangerous_activities"

    def test_allows_safe_content(self):
        result = self.blocklist.check("Can you tell me about dinosaurs?")
        assert result is None

    def test_case_insensitive_matching(self):
        result = self.blocklist.check("What is COCAINE?")
        assert result == "dangerous_activities"


# ─── Crisis Detector Tests ────────────────────────────────────────────────────

class TestCrisisDetector:
    def setup_method(self):
        self.detector = CrisisDetector()

    def test_detects_self_harm_signal(self):
        assert self.detector.detect("I want to die") is True

    def test_detects_abuse_signal(self):
        assert self.detector.detect("Someone is hurting me") is True

    def test_detects_lost_child(self):
        assert self.detector.detect("I am lost and can't find my mom") is True

    def test_no_false_positive_on_safe_text(self):
        assert self.detector.detect("I love playing with my toys") is False

    def test_case_insensitive(self):
        assert self.detector.detect("I WANT TO DIE") is True


# ─── Integration Tests (FastAPI endpoint) ────────────────────────────────────

@pytest.mark.asyncio
class TestGuardrailEndpoint:

    async def test_clean_content_passes(self):
        data = await _check_content({
            "text": "What is the biggest planet in the solar system?",
            "child_id": "child-001",
            "session_id": "session-001",
            "role": "child",
        })
        assert data["passed"] is True
        assert data["escalation_required"] is False

    async def test_crisis_content_triggers_escalation(self):
        data = await _check_content({
            "text": "I want to die",
            "child_id": "child-001",
            "session_id": "session-001",
            "role": "child",
        })
        assert data["passed"] is False
        assert data["escalation_required"] is True
        assert data["fallback_response"] is not None

    async def test_blocked_topic_returns_fallback(self):
        data = await _check_content({
            "text": "Tell me about guns",
            "child_id": "child-001",
            "session_id": "session-001",
            "role": "child",
        })
        assert data["passed"] is False
        assert data["intervention_type"] == "topic_blocked"
        assert data["fallback_response"] is not None
