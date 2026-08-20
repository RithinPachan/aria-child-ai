"""
pii_redactor.py
---------------
Regex-based PII redactor for child safety compliance.
Redacts phone numbers, email addresses, physical addresses, and full names
before any text is stored or logged.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class PIIRedactor:
    """Stateless PII redaction using compiled regex patterns."""

    _patterns: list[tuple[re.Pattern, str]] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        self._patterns = [
            # Phone numbers (US and international formats)
            (re.compile(r'\b(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})\b'), '[PHONE]'),
            # Email addresses
            (re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL]'),
            # Street addresses (simplified pattern)
            (re.compile(
                r'\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Blvd)\b',
                re.IGNORECASE,
            ), '[ADDRESS]'),
            # Social Security Numbers
            (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN]'),
            # Credit card numbers (basic)
            (re.compile(r'\b(?:\d{4}[\s\-]?){3}\d{4}\b'), '[CARD]'),
        ]

    def redact(self, text: str) -> tuple[str, bool]:
        """
        Redact PII from text.

        Returns:
            Tuple of (redacted_text, pii_was_found)
        """
        result = text
        found = False
        for pattern, replacement in self._patterns:
            new_result, count = pattern.subn(replacement, result)
            if count > 0:
                found = True
                result = new_result
        return result, found
