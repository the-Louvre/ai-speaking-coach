import type {
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../shared/schemas";
import type { Scenario } from "../server/data";

export type SessionStart = {
  sessionId: string;
  aiText: string;
  hintZh: string;
  coachState: "asking";
  roundLimit: number;
  scenario: Scenario;
  task: Scenario["tasks"][number];
};

export type HealthResult = {
  mode: "mock" | "live";
  providers: {
    asr: { provider: string; configured: boolean; active: boolean; status: string };
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
    })
};
