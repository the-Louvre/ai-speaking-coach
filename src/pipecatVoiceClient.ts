import type { BotLLMTextData, TranscriptData, TransportState } from "@pipecat-ai/client-js";
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

export type PipecatVoiceTurn = {
  speaker: "ai" | "user" | "system";
  text: string;
  timestamp?: string;
  source: "server" | "transcript" | "bot_llm";
};

export type PipecatVoiceCallbacks = {
  onStatus: (status: TransportState | "bot-ready" | "user-speaking" | "bot-speaking") => void;
  onTurn: (turn: PipecatVoiceTurn) => void;
  onError: (message: string) => void;
  onDisconnected: () => void;
};

export type PipecatVoiceClient = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

function normalizeServerTurn(data: unknown): PipecatVoiceTurn | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== "conversation_turn") return null;

  const speaker = message.speaker;
  const text = typeof message.text === "string" ? message.text.trim() : "";
  if ((speaker !== "ai" && speaker !== "user" && speaker !== "system") || !text) return null;

  return {
    speaker,
    text,
    timestamp: typeof message.timestamp === "string" ? message.timestamp : undefined,
    source: "server"
  };
}

function transcriptToTurn(data: TranscriptData): PipecatVoiceTurn | null {
  const text = data.text.trim();
  if (!data.final || !text) return null;
  return {
    speaker: "user",
    text,
    timestamp: data.timestamp,
    source: "transcript"
  };
}

function createAudioElement() {
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);
  return audio;
}

export function createPipecatVoiceClient({
  webrtcUrl,
  callbacks
}: {
  webrtcUrl: string;
  callbacks: PipecatVoiceCallbacks;
}): PipecatVoiceClient {
  const botAudio = createAudioElement();
  let botLlmChunks: string[] = [];

  function attachBotAudioTrack(track: MediaStreamTrack) {
    if (track.kind !== "audio") return;
    botAudio.srcObject = new MediaStream([track]);
    void botAudio.play().catch(() => {
      callbacks.onError("浏览器阻止了 AI 语音自动播放，请再点一次开始训练或检查浏览器声音权限。");
    });
  }

  function appendBotLlmText(data: BotLLMTextData) {
    if (data.text) botLlmChunks.push(data.text);
  }

  function flushBotLlmTurn() {
    const text = botLlmChunks.join("").replace(/\s+/g, " ").trim();
    botLlmChunks = [];
    if (!text) return;
    callbacks.onTurn({
      speaker: "ai",
      text,
      timestamp: new Date().toISOString(),
      source: "bot_llm"
    });
  }

  const client = new PipecatClient({
    transport: new SmallWebRTCTransport({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    }),
    enableCam: false,
    enableMic: true,
    callbacks: {
      onConnected: () => callbacks.onStatus("connected"),
      onDisconnected: () => callbacks.onDisconnected(),
      onTransportStateChanged: (state) => callbacks.onStatus(state),
      onBotReady: () => callbacks.onStatus("bot-ready"),
      onUserStartedSpeaking: () => callbacks.onStatus("user-speaking"),
      onBotStartedSpeaking: () => callbacks.onStatus("bot-speaking"),
      onBotStoppedSpeaking: () => callbacks.onStatus("connected"),
      onTrackStarted: attachBotAudioTrack,
      onTrackStopped: (track) => {
        if (track.kind === "audio" && botAudio.srcObject) {
          botAudio.srcObject = null;
        }
      },
      onUserTranscript: (data) => {
        const turn = transcriptToTurn(data);
        if (turn) callbacks.onTurn(turn);
      },
      onBotLlmStarted: () => {
        botLlmChunks = [];
      },
      onBotLlmText: appendBotLlmText,
      onBotLlmStopped: flushBotLlmTurn,
      onServerMessage: (data) => {
        const turn = normalizeServerTurn(data);
        if (turn) callbacks.onTurn(turn);
      },
      onError: (message) => {
        const data = message.data as { message?: string } | undefined;
        callbacks.onError(data?.message || "Pipecat Voice Agent 连接异常。");
      },
      onMessageError: () => callbacks.onError("Pipecat Voice Agent 消息处理失败。")
    }
  });

  return {
    async connect() {
      await client.connect({ webrtcUrl });
    },
    async disconnect() {
      await client.disconnect();
      botAudio.pause();
      botAudio.srcObject = null;
      botAudio.remove();
    }
  };
}
