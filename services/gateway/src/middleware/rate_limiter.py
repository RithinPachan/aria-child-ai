"""
rate_limiter.py
---------------
In-memory connection rate limiter.
Prevents a single device from opening multiple concurrent WebSocket sessions.
In production, replace with a Redis-backed distributed counter.
"""

from __future__ import annotations

import threading


class ConnectionRateLimiter:
    """Thread-safe connection counter per device ID."""

    def __init__(self, max_per_device: int = 1) -> None:
        self._max = max_per_device
        self._counts: dict[str, int] = {}
        self._lock = threading.Lock()

    def allow_connection(self, device_id: str) -> bool:
        with self._lock:
            current = self._counts.get(device_id, 0)
            if current >= self._max:
                return False
            self._counts[device_id] = current + 1
            return True

    def release_connection(self, device_id: str) -> None:
        with self._lock:
            current = self._counts.get(device_id, 0)
            self._counts[device_id] = max(0, current - 1)
