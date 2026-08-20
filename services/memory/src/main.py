"""
main.py
-------
ARIA Memory Service — manages all three tiers of child memory:
  Tier 1: Session context (Redis — sub-5ms, 30min TTL)
  Tier 2: Child profile & facts (Firestore — persistent)
  Tier 3: Episodic memory (Vertex AI Vector Search — semantic recall)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from .profile.firestore_client import FirestoreProfileClient
from .session.redis_client import RedisSessionClient

logger = structlog.get_logger()


# ─── Request / Response Models ────────────────────────────────────────────────

class ProfileFactRequest(BaseModel):
    child_id: str
    key: str
    value: str
    category: str = Field(pattern="^(preference|interest|achievement|family|learning_style)$")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)


class SessionTurnRequest(BaseModel):
    session_id: str
    child_id: str
    role: str = Field(pattern="^(child|aria)$")
    text: str = Field(max_length=2000)


# ─── App Lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.redis = RedisSessionClient()
    app.state.firestore = FirestoreProfileClient()
    await app.state.redis.connect()
    logger.info("Memory service started")
    yield
    await app.state.redis.disconnect()
    logger.info("Memory service shutdown")


app = FastAPI(
    title="ARIA Memory Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "healthy", "service": "aria-memory"}

# ─── Profile Endpoints (Firestore — Tier 2) ───────────────────────────────────

@app.get("/api/v1/profile/{child_id}")
async def get_profile(child_id: str) -> dict:
    profile = await app.state.firestore.get_profile(child_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


@app.post("/api/v1/profile/fact", status_code=status.HTTP_201_CREATED)
async def upsert_fact(request: ProfileFactRequest) -> dict:
    await app.state.firestore.upsert_fact(
        child_id=request.child_id,
        key=request.key,
        value=request.value,
        category=request.category,
        confidence=request.confidence,
    )
    return {"status": "ok"}


@app.delete("/api/v1/child/{child_id}/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_child_data(child_id: str) -> None:
    """COPPA right-to-erasure endpoint. Cascades across all storage tiers."""
    await app.state.redis.delete_all_sessions(child_id)
    await app.state.firestore.delete_child(child_id)
    logger.info("Child data deleted", child_id=child_id)

# ─── Session Endpoints (Redis — Tier 1) ───────────────────────────────────────

@app.post("/api/v1/session/turn")
async def append_turn(request: SessionTurnRequest) -> dict:
    await app.state.redis.append_turn(
        session_id=request.session_id,
        child_id=request.child_id,
        role=request.role,
        text=request.text,
    )
    return {"status": "ok"}


@app.get("/api/v1/session/{session_id}/history")
async def get_history(session_id: str, limit: int = 20) -> dict:
    turns = await app.state.redis.get_recent_turns(session_id, limit=limit)
    return {"turns": turns}
