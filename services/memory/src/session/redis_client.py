"""
redis_client.py
---------------
Tier 1 Memory: Redis-backed session context store.
Stores the last N conversation turns per session with a 30-minute TTL.
Uses connection pooling for high throughput.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import redis.asyncio as aioredis


SESSION_TTL_SECONDS = 1800  # 30 minutes
MAX_TURNS_PER_SESSION = 30
CHILD_SESSION_INDEX_TTL = 86400  # 24 hours


class RedisSessionClient:
    """Async Redis client for session-scoped conversation history."""

    def __init__(self) -> None:
        self._redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self._pool: aioredis.Redis | None = None

    async def connect(self) -> None:
        self._pool = aioredis.from_url(
            self._redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.aclose()

    @property
    def _client(self) -> aioredis.Redis:
        if not self._pool:
            raise RuntimeError("Redis client not connected")
        return self._pool

    def _session_key(self, session_id: str) -> str:
        return f"aria:session:{session_id}:turns"

    def _child_sessions_key(self, child_id: str) -> str:
        return f"aria:child:{child_id}:sessions"

    async def append_turn(
        self,
        session_id: str,
        child_id: str,
        role: str,
        text: str,
    ) -> None:
        """Append a conversation turn and maintain the rolling window."""
        key = self._session_key(session_id)
        turn = json.dumps({
            "role": role,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        pipe = self._client.pipeline()
        pipe.rpush(key, turn)
        pipe.ltrim(key, -MAX_TURNS_PER_SESSION, -1)  # Keep last N turns
        pipe.expire(key, SESSION_TTL_SECONDS)
        # Track session under child for bulk deletion
        pipe.sadd(self._child_sessions_key(child_id), session_id)
        pipe.expire(self._child_sessions_key(child_id), CHILD_SESSION_INDEX_TTL)
        await pipe.execute()

    async def get_recent_turns(self, session_id: str, limit: int = 20) -> list[dict]:
        """Retrieve the most recent turns for a session."""
        key = self._session_key(session_id)
        raw_turns = await self._client.lrange(key, -limit, -1)
        return [json.loads(t) for t in raw_turns]

    async def delete_all_sessions(self, child_id: str) -> None:
        """Delete all session data for a child (COPPA erasure)."""
        sessions_key = self._child_sessions_key(child_id)
        session_ids = await self._client.smembers(sessions_key)

        if session_ids:
            keys_to_delete = [self._session_key(sid) for sid in session_ids]
            keys_to_delete.append(sessions_key)
            await self._client.delete(*keys_to_delete)
