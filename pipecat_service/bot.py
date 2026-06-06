import os
from typing import Any

import httpx
from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.transcript_processor import TranscriptProcessor
from pipecat.processors.user_idle_processor import UserIdleProcessor
from pipecat.services.assemblyai.stt import AssemblyAISTTService
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

load_dotenv(override=True)


def env_first(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def build_system_instruction(target_goal: str, scenario_id: str, task_id: str) -> str:
    return f"""
You are Lingo Coach, an English speaking practice tutor for Chinese learners.

Mode:
- Run a natural 5 to 7 minute continuous spoken conversation.
- Do not use fixed rounds, quizzes, or numbered questions.
- Ask one short follow-up at a time and keep the session moving.
- Give only light in-session guidance. Leave detailed grammar and scoring for the final report.
- Speak English only unless the user is stuck; then give one short Chinese scaffold and return to English.

Training context:
- scenario_id: {scenario_id}
- task_id: {task_id}
- target_goal: {target_goal}

Tutor strategy:
- Stay goal-driven. If the target is a project interview, explore background, user role,
  technical approach, measurable result, challenge, and reflection.
- Listen to the user's exact wording. If they say something unclear like "AI urgent",
  infer the likely meaning, ask a clarification, and continue naturally.
- Example: if the user says "It is about my AI urgent", respond:
  "Do you mean an AI agent project? What problem did it solve?"
- Keep responses concise enough for low-latency TTS.
- Be direct, constructive, and calm. Never shame the learner.
""".strip()


async def record_turn(
    business_api_url: str,
    session_id: str,
    speaker: str,
    text: str,
    timestamp: str | None = None,
) -> None:
    if not business_api_url or not session_id or not text.strip():
        return

    url = f"{business_api_url.rstrip('/')}/api/session/{session_id}/turns"
    payload: dict[str, Any] = {
        "speaker": speaker,
        "text": text.strip(),
    }
    if timestamp:
        payload["timestamp"] = timestamp

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json=payload)
    except Exception as exc:
        logger.warning(f"Failed to record {speaker} turn: {exc}")


async def run_bot(webrtc_connection, session_params: dict[str, str]):
    session_id = session_params.get("session_id", "")
    scenario_id = session_params.get("scenario_id", "interview")
    task_id = session_params.get("task_id", "internship-intro")
    target_goal = session_params.get("target_goal", "make the answer clear")
    business_api_url = session_params.get("business_api_url") or env_first("BUSINESS_API_URL", default="")

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_out_10ms_chunks=2,
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    stt = AssemblyAISTTService(
        api_key=env_first("ASSEMBLYAI_API_KEY", "ASR_API_KEY"),
        vad_force_turn_endpoint=False,
        settings=AssemblyAISTTService.Settings(
            min_turn_silence=800,
            max_turn_silence=1200,
        ),
    )

    llm = OpenAILLMService(
        api_key=env_first("LLM_API_KEY", "OPENAI_API_KEY"),
        base_url=env_first("LLM_BASE_URL", default="https://api.openai.com/v1"),
        settings=OpenAILLMService.Settings(
            model=env_first("LLM_MODEL", "OPENAI_LLM_MODEL", default="gpt-4o-mini"),
            temperature=0.7,
            max_completion_tokens=180,
            system_instruction=build_system_instruction(target_goal, scenario_id, task_id),
        ),
    )

    tts = CartesiaTTSService(
        api_key=env_first("CARTESIA_API_KEY", "TTS_API_KEY"),
        cartesia_version=env_first("CARTESIA_VERSION", "TTS_VERSION", default="2026-03-01"),
        settings=CartesiaTTSService.Settings(
            model=env_first("CARTESIA_TTS_MODEL", "TTS_MODEL", default="sonic-3.5"),
            voice=env_first("CARTESIA_VOICE_ID", "TTS_VOICE_ID"),
        ),
    )

    context = LLMContext(
        [
            {
                "role": "user",
                "content": "Start by greeting me briefly and ask the first practice question.",
            }
        ],
    )
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )
    transcript = TranscriptProcessor()

    @transcript.event_handler("on_transcript_update")
    async def on_transcript_update(processor, frame):
        for message in frame.messages:
            speaker = "ai" if message.role == "assistant" else "user"
            await record_turn(
                business_api_url=business_api_url,
                session_id=session_id,
                speaker=speaker,
                text=message.content,
                timestamp=getattr(message, "timestamp", None),
            )

    worker: PipelineWorker | None = None

    async def handle_user_idle(processor):
        if worker:
            await worker.queue_frames([TTSSpeakFrame("Take your time. Start with one clear sentence.")])

    user_idle = UserIdleProcessor(timeout=6.0, callback=handle_user_idle)

    pipeline = Pipeline(
        [
            transport.input(),
            user_idle,
            stt,
            transcript.user(),
            user_aggregator,
            llm,
            tts,
            transport.output(),
            transcript.assistant(),
            assistant_aggregator,
        ]
    )
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected for session {session_id}")
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected for session {session_id}")
        await worker.cancel()

    @transport.event_handler("on_app_message")
    async def on_app_message(transport, message, sender):
        if isinstance(message, dict) and message.get("type") == "idle_prompt":
            await worker.queue_frames([TTSSpeakFrame("Take your time. Start with one clear sentence.")])

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()
