"""
main.py
-------
ARIA Cloud Gateway — FastAPI application entry point.
Exposes the WebSocket audio streaming endpoint and health check.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator, AsyncIterator

import httpx
import structlog
from fastapi import Depends, FastAPI, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from .auth.jwt_validator import JWTValidator, TokenClaims
from .config import Settings, get_settings
from .gemini.session_manager import GeminiSessionManager
from .middleware.rate_limiter import ConnectionRateLimiter

# ─── Logging Setup ────────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

# ─── App Lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage shared resources across the application lifecycle."""
    settings = get_settings()
    app.state.http_client = httpx.AsyncClient(timeout=5.0)
    app.state.jwt_validator = JWTValidator(
        public_key_path=settings.jwt_public_key_path,
        algorithm=settings.jwt_algorithm,
        audience=settings.jwt_audience,
    )
    app.state.session_manager = GeminiSessionManager(settings, app.state.http_client)
    app.state.rate_limiter = ConnectionRateLimiter(
        max_per_device=settings.max_connections_per_device
    )
    logger.info("ARIA Gateway started", version=settings.app_version)
    yield
    await app.state.http_client.aclose()
    logger.info("ARIA Gateway shutdown complete")


# ─── Application ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="ARIA Cloud Gateway",
    version="1.0.0",
    description="Real-time audio relay between ARIA devices and Gemini Live API",
    lifespan=lifespan,
    docs_url=None,   # Disable Swagger in production
    redoc_url=None,
)

FastAPIInstrumentor.instrument_app(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to known origins in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health", status_code=status.HTTP_200_OK, tags=["ops"])
async def health_check() -> dict:
    return {"status": "healthy", "service": "aria-gateway"}

# ─── WebSocket Audio Endpoint ─────────────────────────────────────────────────

@app.websocket("/ws/audio")
async def audio_stream(
    websocket: WebSocket,
    token: str = Query(..., description="Short-lived JWT session token"),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    WebSocket endpoint for bidirectional audio streaming.

    Protocol:
    - Client sends binary frames: PCM 16kHz 16-bit mono audio chunks
    - Client sends text frame: JSON {"type": "end_of_turn"} to signal speech end
    - Server sends binary frames: PCM audio response from ARIA
    - Server sends text frames: JSON control messages (transcript, emotion, error)
    """
    # ── Authentication ────────────────────────────────────────────────────────
    claims: TokenClaims = websocket.app.state.jwt_validator.validate(token)
    rate_limiter: ConnectionRateLimiter = websocket.app.state.rate_limiter

    if not rate_limiter.allow_connection(claims.device_id):
        await websocket.close(code=4029, reason="Too many connections from this device")
        return

    await websocket.accept()
    request_id = str(uuid.uuid4())

    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        session_id=claims.session_id,
        child_id=claims.child_id,
    )
    logger.info("WebSocket session established")

    # ── Audio Queue ───────────────────────────────────────────────────────────
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=100)

    async def audio_input_stream() -> AsyncIterator[bytes]:
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break
            yield chunk

    # ── Callbacks ─────────────────────────────────────────────────────────────

    async def on_audio_chunk(chunk: bytes) -> None:
        """Send ARIA's audio response back to the client."""
        try:
            await websocket.send_bytes(chunk)
        except Exception:
            pass

    async def on_transcript(text: str, role: str) -> None:
        """Send sanitized transcript to client and memory service."""
        await websocket.send_json({"type": "transcript", "role": role, "text": text})

    async def on_emotion(emotion: str) -> None:
        """Send emotion state update to client."""
        await websocket.send_json({"type": "emotion", "state": emotion})

    # ── Main Loop ─────────────────────────────────────────────────────────────
    session_manager: GeminiSessionManager = websocket.app.state.session_manager

    try:
        async with asyncio.TaskGroup() as tg:
            # Task 1: Run Gemini session
            tg.create_task(
                session_manager.run_session(
                    child_id=claims.child_id,
                    session_id=claims.session_id,
                    audio_input_stream=audio_input_stream(),
                    on_audio_chunk=on_audio_chunk,
                    on_transcript=on_transcript,
                    on_emotion=on_emotion,
                )
            )

            # Task 2: Receive audio from client
            async def receive_loop() -> None:
                try:
                    while True:
                        message = await websocket.receive()
                        if message["type"] == "websocket.disconnect":
                            break
                        if "bytes" in message and message["bytes"]:
                            await audio_queue.put(message["bytes"])
                        elif "text" in message:
                            import json
                            ctrl = json.loads(message["text"])
                            if ctrl.get("type") == "end_of_turn":
                                await audio_queue.put(None)  # Signal end of turn
                finally:
                    await audio_queue.put(None)  # Ensure Gemini session terminates

            tg.create_task(receive_loop())

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as exc:
        logger.error("Session error", error=str(exc))
        try:
            await websocket.send_json({"type": "error", "message": "Internal session error"})
        except Exception:
            pass
    finally:
        rate_limiter.release_connection(claims.device_id)
        structlog.contextvars.clear_contextvars()
        logger.info("WebSocket session closed")
