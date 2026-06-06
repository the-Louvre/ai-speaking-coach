import type {
  ConversationTurn,
  DialogueTurnResult,
  PracticeSession,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../shared/schemas";
import type { Scenario } from "../server/data";

export type SessionStart = {
  sessionId: string;
  session: PracticeSession;
  aiText: string;
  hintZh: string;
  coachState: "asking";
  duration: number;
  remainingSeconds: number;
  scenario: Scenario;
  task: Scenario["tasks"][number];
};

export type HealthResult = {
  mode: "mock" | "live";
  providers: {
    asr: { provider: string; configured: boolean; active: boolean; status: string; model: string };
    llm: {
      provider: string;
      configured: boolean;
      active: boolean;
      model: string;
      baseUrl: string;
      status: string;
    };
    tts: { provider: string; configured: boolean; active: boolean; model: string; status: string };
    pronunciation: { provider: string; configured: boolean; active: boolean; status: string };
    deepgram: { configured: boolean; active: boolean };
    openai: { configured: boolean; active: boolean; model: string };
    cartesia: { configured: boolean; active: boolean; model: string };
  };
  fallbackEnabled: boolean;
};

export type RuntimeSettingsResult = HealthResult & {
  editable: {
    providerPreset: string;
    asrProvider: string;
    asrModel: string;
    llmProvider: string;
    llmBaseUrl: string;
    llmModel: string;
    ttsProvider: string;
    ttsVersion: string;
    ttsModel: string;
    ttsVoiceId: string;
    pronunciationProvider: string;
    openaiModel: string;
    cartesiaVersion: string;
    cartesiaModel: string;
    cartesiaVoiceId: string;
  };
};

export type RuntimeSettingsInput = {
  apiMode?: "mock" | "live";
    providerPreset?: string;
    asrProvider?: string;
    asrModel?: string;
  asrApiKey?: string;
  deepgramApiKey?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  ttsProvider?: string;
  ttsApiKey?: string;
  cartesiaApiKey?: string;
  cartesiaVersion?: string;
  cartesiaModel?: string;
  cartesiaVoiceId?: string;
  pronunciationProvider?: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => requestJson<HealthResult>("/api/health"),
  settings: () => requestJson<RuntimeSettingsResult>("/api/settings"),
  updateSettings: (payload: RuntimeSettingsInput) =>
    requestJson<RuntimeSettingsResult>("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  scenarios: () => requestJson<{ scenarios: Scenario[] }>("/api/scenarios"),
  startSession: (scenarioId: string, taskId: string, customScenario?: Scenario, durationMinutes = 5) =>
    requestJson<SessionStart>("/api/session/start", {
      method: "POST",
      body: JSON.stringify({ scenarioId, taskId, customScenario, durationMinutes })
    }),
  addSessionTurn: (
    sessionId: string,
    payload: {
      speaker: "ai" | "user" | "system";
      text: string;
      timestamp?: string;
      transcriptConfidence?: number;
      audioDurationSec?: number;
      latencyMs?: number;
      hintZh?: string;
      keywords?: string[];
    }
  ) =>
    requestJson<{ turn: ConversationTurn; session: PracticeSession }>(`/api/session/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  transcribe: (audio?: Blob) => {
    const form = new FormData();
    if (audio) {
      form.append("audio", audio, "answer.webm");
    }
    return requestJson<TranscriptResult>("/api/asr/transcribe", { method: "POST", body: form });
  },
  nextTurn: (payload: {
    sessionId: string;
    scenarioId: string;
    taskId: string;
    scenarioLabel?: string;
    taskTitle?: string;
    taskFocus?: string;
    aiRoleZh?: string;
    round: number;
    userText: string;
  }) =>
    requestJson<DialogueTurnResult>("/api/llm/turn", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  synthesize: (text: string) =>
    requestJson<SpeechAudioResult>("/api/tts/synthesize", {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  generateReport: (payload: unknown) =>
    requestJson<ReportResult>("/api/report/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  readSession: (sessionId: string) => requestJson<{ session: PracticeSession }>(`/api/session/${sessionId}`),
  endSession: (sessionId: string) =>
    requestJson<{ session: PracticeSession }>(`/api/session/${sessionId}/end`, {
      method: "POST"
    })
};

export async function checkPipecatHealth() {
  const baseUrl = import.meta.env.VITE_PIPECAT_BASE_URL || "http://127.0.0.1:7860";
  const response = await fetch(new URL("/health", baseUrl));
  if (!response.ok) {
    throw new Error(`Pipecat health check failed: ${response.status} ${response.statusText}`);
  }
  const health = (await response.json()) as {
    configured?: Partial<Record<"assemblyai" | "llm" | "cartesia" | "businessApi", boolean>>;
    ready?: boolean;
    service?: string;
  };
  const missingVoiceProviders = ["assemblyai", "llm", "cartesia"].filter(
    (provider) => health.configured?.[provider as "assemblyai" | "llm" | "cartesia"] === false
  );
  if (missingVoiceProviders.length > 0) {
    throw new Error(`voice provider is not configured: ${missingVoiceProviders.join(", ")}`);
  }
  return health;
}

export function createPipecatOfferUrl(params: {
  sessionId: string;
  scenarioId: string;
  taskId: string;
  targetGoal: string;
}) {
  const baseUrl = import.meta.env.VITE_PIPECAT_BASE_URL || "http://127.0.0.1:7860";
  const businessApiUrl = import.meta.env.VITE_BUSINESS_API_URL || "http://127.0.0.1:5174";
  const url = new URL("/api/offer", baseUrl);
  url.searchParams.set("session_id", params.sessionId);
  url.searchParams.set("scenario_id", params.scenarioId);
  url.searchParams.set("task_id", params.taskId);
  url.searchParams.set("target_goal", params.targetGoal);
  url.searchParams.set("business_api_url", businessApiUrl);
  return url.toString();
}
