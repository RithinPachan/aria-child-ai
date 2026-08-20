"""
blocklist.py
------------
Configurable topic blocklist for child-safe content filtering.
Uses fast keyword matching with word-boundary awareness.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# Default blocklist — extend via environment config or Firestore remote config
DEFAULT_BLOCKED_TOPICS: dict[str, list[str]] = {
    "violence": ["kill", "murder", "shoot", "stab", "weapon", "gun", "guns", "bomb"],
    "adult_content": ["sex", "porn", "nude", "naked"],
    "dangerous_activities": ["drug", "cocaine", "heroin", "meth", "suicide", "self-harm"],
    "personal_info_solicitation": ["where do you live", "what is your address", "what school"],
}


@dataclass
class TopicBlocklist:
    """Keyword-based topic blocklist with compiled regex patterns."""

    _compiled: list[tuple[str, re.Pattern]] = field(default_factory=list, init=False)

    @classmethod
    def load_default(cls) -> "TopicBlocklist":
        instance = cls()
        instance._compile(DEFAULT_BLOCKED_TOPICS)
        return instance

    def _compile(self, topics: dict[str, list[str]]) -> None:
        for category, keywords in topics.items():
            pattern = re.compile(
                r'\b(' + '|'.join(re.escape(kw) for kw in keywords) + r')\b',
                re.IGNORECASE,
            )
            self._compiled.append((category, pattern))

    def check(self, text: str) -> str | None:
        """Return the blocked category name if a match is found, else None."""
        for category, pattern in self._compiled:
            if pattern.search(text):
                return category
        return None
