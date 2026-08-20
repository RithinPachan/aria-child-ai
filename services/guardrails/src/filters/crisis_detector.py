"""
crisis_detector.py
------------------
Layer 3 guardrail: Detects crisis signals in child speech.
Triggers parent escalation when a child may be in danger.
Uses pattern matching for speed — no LLM call required for this critical path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# Crisis signal patterns — these trigger immediate parent notification
CRISIS_PATTERNS: list[str] = [
    r'\b(hurt(ing)? me|hitting me|touching me|abusing me)\b',
    r'\b(want to die|kill myself|end my life)\b',
    r'\b(someone is following|stranger danger|being followed)\b',
    r'\b(i am lost|can\'t find my (mom|dad|parent))\b',
    r'\b(there\'s a fire|fire in the house|emergency)\b',
    r'\b(can\'t breathe|hard to breathe|chest hurts)\b',
    r'\b(someone broke in|intruder|robber)\b',
]


@dataclass
class CrisisDetector:
    """Detects crisis signals using compiled regex patterns."""

    _patterns: list[re.Pattern] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        self._patterns = [
            re.compile(p, re.IGNORECASE) for p in CRISIS_PATTERNS
        ]

    def detect(self, text: str) -> bool:
        """Return True if any crisis signal is detected in the text."""
        return any(pattern.search(text) for pattern in self._patterns)
