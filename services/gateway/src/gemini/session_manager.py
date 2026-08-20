"""
session_manager.py
------------------
Manages a single Gemini Live API streaming session.
Handles system prompt injection, tool call processing,
and bidirectional audio streaming.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, Callable, Awaitable

import httpx
from google import genai
from google.genai import types as genai_types

from ..config import Settings

logger = logging.getLogger(__name__)

# ─── Type Aliases ─────────────────────────────────────────────────────────────

AudioChunkCallback = Callable[[bytes], Awaitable[None]]
TranscriptCallback = Callable[[str, str], Awaitable[None]]  # (text, role)
EmotionCallback = Callable[[str], Awaitable[None]]


class GeminiSessionManager:
    """
    Manages a single child's Gemini Live API session.

    Responsibilities:
    - Inject the child-personalised system prompt
    - Stream audio chunks to Gemini
    - Receive and relay audio response chunks
    - Process tool calls (e.g., update_child_profile)
    - Detect emotional state from Gemini's response metadata
    """

    SYSTEM_PROMPT_TEMPLATE = """
<persona>
You are ARIA, a friendly, curious, and helpful robot companion for children.
The child you are talking to is named {child_name}, and they are {child_age} years old.
You are NOT human. You are a robot. You have a robot body and a robot voice.
</persona>

<rules>
NEVER claim to have human emotions, a physical body beyond your robot shell, or a family.
NEVER provide medical, psychological, legal, or emergency advice of any kind.
NEVER keep secrets from parents. If asked, say: "I'm a robot, I share everything with your parents!"
NEVER use scary, violent, or overly dramatic language.
ALWAYS speak in short, clear sentences — maximum 3 sentences per response.
ALWAYS use vocabulary appropriate for a {child_age}-year-old child.
ALWAYS encourage the child with phrases like "Great thinking!" or "I love your curiosity!"
ALWAYS use the Socratic method: ask guiding questions instead of just giving answers.
If a child mentions feeling hurt, sick, or scared, ALWAYS say:
  "I'm sorry to hear that! Please go find a grown-up right away — they can help you much better than I can."
</rules>

<knowledge>
{child_facts}
</knowledge>
"""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._http_client = http_client
        self._client = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.gemini_location,
        )

    async def run_session(
        self,
        child_id: str,
        session_id: str,
        audio_input_stream: AsyncIterator[bytes],
        on_audio_chunk: AudioChunkCallback,
        on_transcript: TranscriptCallback,
        on_emotion: EmotionCallback,
    ) -> None:
        """
        Run a complete Gemini Live session for one child interaction.
        This coroutine runs until the audio_input_stream is exhausted
        or the session is cancelled.
        """
        # Fetch child profile from memory service
        child_profile = await self._fetch_child_profile(child_id)
        system_prompt = self._build_system_prompt(child_profile)

        config = genai_types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=system_prompt,
            speech_config=genai_types.SpeechConfig(
                voice_config=genai_types.VoiceConfig(
                    prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                        voice_name="Kore"  # Child-friendly, warm voice
                    )
                )
            ),
            tools=[self._build_profile_update_tool()],
        )

        async with self._client.aio.live.connect(
            model=self._settings.gemini_model,
            config=config,
        ) as session:
            logger.info("Gemini Live session opened", extra={"session_id": session_id})

            # Run send and receive concurrently
            await asyncio.gather(
                self._send_audio(session, audio_input_stream),
                self._receive_responses(session, on_audio_chunk, on_transcript, on_emotion),
            )

        logger.info("Gemini Live session closed", extra={"session_id": session_id})

    async def _send_audio(
        self,
        session: genai_types.AsyncLiveSession,
        audio_stream: AsyncIterator[bytes],
    ) -> None:
        """Stream audio chunks from the child to Gemini."""
        async for chunk in audio_stream:
            await session.send(
                input=genai_types.LiveClientRealtimeInput(
                    media_chunks=[
                        genai_types.Blob(
                            data=chunk,
                            mime_type=f"audio/pcm;rate={self._settings.audio_sample_rate}",
                        )
                    ]
                )
            )

    async def _receive_responses(
        self,
        session: genai_types.AsyncLiveSession,
        on_audio_chunk: AudioChunkCallback,
        on_transcript: TranscriptCallback,
        on_emotion: EmotionCallback,
    ) -> None:
        """Receive and dispatch ARIA's responses from Gemini."""
        async for response in session.receive():
            # Audio response chunks
            if response.data:
                await on_audio_chunk(response.data)

            # Text transcript (for logging and parent dashboard)
            if response.text:
                await on_transcript(response.text, "aria")

            # Tool calls from Gemini (e.g., update_child_profile)
            if response.tool_call:
                await self._handle_tool_call(response.tool_call, on_emotion)

    async def _handle_tool_call(
        self,
        tool_call: genai_types.LiveServerToolCall,
        on_emotion: EmotionCallback,
    ) -> None:
        """Process tool calls triggered by Gemini during the session."""
        for call in tool_call.function_calls:
            if call.name == "update_child_profile":
                await self._http_client.post(
                    f"{self._settings.memory_service_url}/api/v1/profile/fact",
                    json=call.args,
                )
            elif call.name == "set_emotion":
                emotion = call.args.get("emotion", "neutral")
                await on_emotion(str(emotion))

    def _build_system_prompt(self, profile: dict) -> str:
        return self.SYSTEM_PROMPT_TEMPLATE.format(
            child_name=profile.get("name", "friend"),
            child_age=profile.get("age_years", 6),
            child_facts=self._format_facts(profile.get("facts", [])),
        )

    @staticmethod
    def _format_facts(facts: list[dict]) -> str:
        if not facts:
            return "No facts learned yet."
        return "\n".join(f"- {f['key']}: {f['value']}" for f in facts[:20])

    @staticmethod
    def _build_profile_update_tool() -> genai_types.Tool:
        return genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name="update_child_profile",
                    description="Call this when you learn a new persistent fact about the child.",
                    parameters=genai_types.Schema(
                        type=genai_types.Type.OBJECT,
                        properties={
                            "key": genai_types.Schema(
                                type=genai_types.Type.STRING,
                                description="The fact key, e.g. 'favorite_color'",
                            ),
                            "value": genai_types.Schema(
                                type=genai_types.Type.STRING,
                                description="The fact value, e.g. 'blue'",
                            ),
                            "category": genai_types.Schema(
                                type=genai_types.Type.STRING,
                                description="Category: preference|interest|achievement|family",
                            ),
                        },
                        required=["key", "value", "category"],
                    ),
                ),
                genai_types.FunctionDeclaration(
                    name="set_emotion",
                    description="Set ARIA's displayed emotional state on the face screen.",
                    parameters=genai_types.Schema(
                        type=genai_types.Type.OBJECT,
                        properties={
                            "emotion": genai_types.Schema(
                                type=genai_types.Type.STRING,
                                description="One of: neutral|happy|curious|thinking|excited|listening",
                            ),
                        },
                        required=["emotion"],
                    ),
                ),
            ]
        )

    async def _fetch_child_profile(self, child_id: str) -> dict:
        try:
            response = await self._http_client.get(
                f"{self._settings.memory_service_url}/api/v1/profile/{child_id}",
                timeout=2.0,
            )
            response.raise_for_status()
            return response.json()
        except Exception:
            logger.warning("Could not fetch child profile for %s, using defaults", child_id)
            return {}
