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
  startSession: (scenarioId: string, taskId: string, customScenario?: Scenario) =>
    requestJson<SessionStart>("/api/session/start", {
      method: "POST",
      body: JSON.stringify({ scenarioId, taskId, customScenario })
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
  readSession: (sessionId: string) => requestJson<{ session: PracticeSession }>(`/api/session/${sessionId}`)
};

export type PracticeRealtimeEvent =
  | {
      type: "session_started";
      session: PracticeSession;
      aiText: string;
      remainingSeconds: number;
      keywords: string[];
    }
  | { type: "status"; sessionId: string; status: string; remainingSeconds?: number }
  | { type: "transcript_final"; sessionId: string; turn: ConversationTurn }
  | {
      type: "ai_reply";
      sessionId: string;
      turn: ConversationTurn;
      speech: SpeechAudioResult;
      hintZh: string;
      positiveFeedback: string;
      correctionPreview: string;
      keywords: string[];
      remainingSeconds: number;
    }
  | { type: "session_finished"; session: PracticeSession; report: ReportResult }
  | { type: "error"; message: string };

export function createPracticeSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.port === "5173" ? `${window.location.hostname}:5174` : window.location.host;
  return new WebSocket(`${protocol}://${host}/api/practice/ws`);
}
