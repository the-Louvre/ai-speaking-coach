import type { LiveConfig } from "./providers/liveProviders";
import "./env";
import { readFileSync } from "node:fs";

export type ProviderPreset = "global-mixed" | "china-qwen" | "custom";
export type AsrProvider = "mock" | "deepgram" | "assemblyai" | "aliyun-isi" | "iflytek";
export type LlmProvider = "openai" | "qwen" | "doubao" | "kimi" | "custom-openai-compatible";
export type TtsProvider = "mock" | "cartesia" | "aliyun-isi" | "iflytek";
export type PronunciationProvider = "rule" | "iflytek";

export type AppOptions = {
  apiMode?: "mock" | "live";
};

export type RuntimeSettingsInput = {
  apiMode?: "mock" | "live";
  providerPreset?: ProviderPreset;
  asrProvider?: AsrProvider;
  asrApiKey?: string;
  deepgramApiKey?: string;
  assemblyAiApiKey?: string;
  llmProvider?: LlmProvider;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  ttsProvider?: TtsProvider;
  ttsApiKey?: string;
  cartesiaApiKey?: string;
  cartesiaVersion?: string;
  cartesiaModel?: string;
  cartesiaVoiceId?: string;
  pronunciationProvider?: PronunciationProvider;
};

type ProviderDefaults = Pick<
  LiveConfig,
  | "providerPreset"
  | "asrProvider"
  | "llmProvider"
  | "llmBaseUrl"
  | "llmModel"
  | "ttsProvider"
  | "ttsVersion"
  | "ttsModel"
  | "pronunciationProvider"
>;

const PRESETS: Record<ProviderPreset, ProviderDefaults> = {
  "china-qwen": {
    providerPreset: "china-qwen",
    asrProvider: "mock",
    llmProvider: "qwen",
    llmBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    llmModel: "qwen-plus",
    ttsProvider: "mock",
    ttsVersion: "",
    ttsModel: "mock",
    pronunciationProvider: "rule"
  },
  "global-mixed": {
    providerPreset: "global-mixed",
    asrProvider: "deepgram",
    llmProvider: "openai",
    llmBaseUrl: "",
    llmModel: "gpt-4o-mini",
    ttsProvider: "cartesia",
    ttsVersion: "2026-03-01",
    ttsModel: "sonic-latest",
    pronunciationProvider: "rule"
  },
  custom: {
    providerPreset: "custom",
    asrProvider: "mock",
    llmProvider: "custom-openai-compatible",
    llmBaseUrl: "",
    llmModel: "qwen-plus",
    ttsProvider: "mock",
    ttsVersion: "",
    ttsModel: "mock",
    pronunciationProvider: "rule"
  }
};

function isOneOf<T extends string>(value: string | undefined, options: readonly T[]): value is T {
  return Boolean(value && (options as readonly string[]).includes(value));
}

function readProviderPreset(value: string | undefined): ProviderPreset {
  return isOneOf(value, ["global-mixed", "china-qwen", "custom"] as const)
    ? value
    : "china-qwen";
}

function readAsrProvider(value: string | undefined, fallback: AsrProvider): AsrProvider {
  return isOneOf(value, ["mock", "deepgram", "assemblyai", "aliyun-isi", "iflytek"] as const)
    ? value
    : fallback;
}

function readLlmProvider(value: string | undefined, fallback: LlmProvider): LlmProvider {
  return isOneOf(value, ["openai", "qwen", "doubao", "kimi", "custom-openai-compatible"] as const)
    ? value
    : fallback;
}

function readTtsProvider(value: string | undefined, fallback: TtsProvider): TtsProvider {
  return isOneOf(value, ["mock", "cartesia", "aliyun-isi", "iflytek"] as const) ? value : fallback;
}

function readPronunciationProvider(
  value: string | undefined,
  fallback: PronunciationProvider
): PronunciationProvider {
  return isOneOf(value, ["rule", "iflytek"] as const) ? value : fallback;
}

function readLlmApiKey(provider: LlmProvider): string | undefined {
  if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY;
  if (provider === "qwen") return process.env.DASHSCOPE_API_KEY;
  if (provider === "doubao") return process.env.ARK_API_KEY;
  if (provider === "kimi") return process.env.MOONSHOT_API_KEY;
  return process.env.OPENAI_API_KEY;
}

function readDefaultPrompt(): string | undefined {
  if (process.env.DEFAULT_PROMPT) return process.env.DEFAULT_PROMPT;
  if (!process.env.DEFAULT_PROMPT_PATH) return undefined;
  try {
    return readFileSync(process.env.DEFAULT_PROMPT_PATH, "utf8").trim();
  } catch {
    return undefined;
  }
}

export function getConfig(options: AppOptions = {}): LiveConfig {
  const apiMode = options.apiMode ?? (process.env.API_MODE === "live" ? "live" : "mock");
  const providerPreset = readProviderPreset(process.env.API_PROVIDER_PRESET);
  const preset = PRESETS[providerPreset];
  const llmProvider = readLlmProvider(process.env.LLM_PROVIDER, preset.llmProvider);
  const llmModel = process.env.LLM_MODEL || process.env.OPENAI_LLM_MODEL || preset.llmModel;
  const ttsModel = process.env.TTS_MODEL || process.env.CARTESIA_TTS_MODEL || preset.ttsModel;

  return {
    apiMode,
    providerPreset,
    asrProvider: readAsrProvider(process.env.ASR_PROVIDER, preset.asrProvider),
    asrApiKey: process.env.ASR_API_KEY || process.env.DEEPGRAM_API_KEY,
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || process.env.ASR_API_KEY,
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY || process.env.ASR_API_KEY,
    llmProvider,
    llmApiKey: readLlmApiKey(llmProvider),
    llmBaseUrl: process.env.LLM_BASE_URL ?? preset.llmBaseUrl,
    llmModel,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_LLM_MODEL || llmModel,
    ttsProvider: readTtsProvider(process.env.TTS_PROVIDER, preset.ttsProvider),
    ttsApiKey: process.env.TTS_API_KEY || process.env.CARTESIA_API_KEY,
    ttsVersion: process.env.TTS_VERSION || process.env.CARTESIA_VERSION || preset.ttsVersion,
    ttsModel,
    ttsVoiceId: process.env.TTS_VOICE_ID || process.env.CARTESIA_VOICE_ID,
    cartesiaApiKey: process.env.CARTESIA_API_KEY || process.env.TTS_API_KEY,
    cartesiaVersion: process.env.CARTESIA_VERSION || process.env.TTS_VERSION || preset.ttsVersion,
    cartesiaModel: process.env.CARTESIA_TTS_MODEL || process.env.TTS_MODEL || ttsModel,
    cartesiaVoiceId: process.env.CARTESIA_VOICE_ID || process.env.TTS_VOICE_ID,
    pronunciationProvider: readPronunciationProvider(
      process.env.PRONUNCIATION_PROVIDER,
      preset.pronunciationProvider
    ),
    defaultPrompt: readDefaultPrompt()
  };
}

function cleanValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function applyRuntimeSettings(config: LiveConfig, input: RuntimeSettingsInput): LiveConfig {
  if (input.apiMode === "mock" || input.apiMode === "live") {
    config.apiMode = input.apiMode;
  }

  if (input.providerPreset && PRESETS[input.providerPreset]) {
    Object.assign(config, PRESETS[input.providerPreset]);
  }

  if (input.asrProvider) config.asrProvider = readAsrProvider(input.asrProvider, config.asrProvider);
  if (input.llmProvider) config.llmProvider = readLlmProvider(input.llmProvider, config.llmProvider);
  if (input.ttsProvider) config.ttsProvider = readTtsProvider(input.ttsProvider, config.ttsProvider);
  if (input.pronunciationProvider) {
    config.pronunciationProvider = readPronunciationProvider(
      input.pronunciationProvider,
      config.pronunciationProvider
    );
  }

  const asrApiKey = cleanValue(input.asrApiKey);
  const deepgramApiKey = cleanValue(input.deepgramApiKey);
  const assemblyAiApiKey = cleanValue(input.assemblyAiApiKey);
  const llmApiKey = cleanValue(input.llmApiKey);
  const llmBaseUrl = cleanValue(input.llmBaseUrl);
  const llmModel = cleanValue(input.llmModel);
  const openaiApiKey = cleanValue(input.openaiApiKey);
  const ttsApiKey = cleanValue(input.ttsApiKey);
  const cartesiaApiKey = cleanValue(input.cartesiaApiKey);
  const openaiModel = cleanValue(input.openaiModel);
  const cartesiaVersion = cleanValue(input.cartesiaVersion);
  const cartesiaModel = cleanValue(input.cartesiaModel);
  const cartesiaVoiceId = cleanValue(input.cartesiaVoiceId);

  if (asrApiKey || deepgramApiKey || assemblyAiApiKey) {
    config.asrApiKey = asrApiKey || deepgramApiKey || assemblyAiApiKey;
    config.deepgramApiKey = deepgramApiKey || asrApiKey;
    config.assemblyAiApiKey = assemblyAiApiKey || asrApiKey;
  }
  if (llmApiKey || openaiApiKey) {
    config.llmApiKey = llmApiKey || openaiApiKey;
    config.openaiApiKey = openaiApiKey || llmApiKey;
  }
  if (llmBaseUrl !== undefined) config.llmBaseUrl = llmBaseUrl;
  if (llmModel || openaiModel) {
    config.llmModel = llmModel || openaiModel || config.llmModel;
    config.openaiModel = openaiModel || llmModel || config.openaiModel;
  }
  if (ttsApiKey || cartesiaApiKey) {
    config.ttsApiKey = ttsApiKey || cartesiaApiKey;
    config.cartesiaApiKey = cartesiaApiKey || ttsApiKey;
  }
  if (cartesiaVersion) {
    config.ttsVersion = cartesiaVersion;
    config.cartesiaVersion = cartesiaVersion;
  }
  if (cartesiaModel) {
    config.ttsModel = cartesiaModel;
    config.cartesiaModel = cartesiaModel;
  }
  if (cartesiaVoiceId) {
    config.ttsVoiceId = cartesiaVoiceId;
    config.cartesiaVoiceId = cartesiaVoiceId;
  }

  return config;
}

export function getRuntimeSettings(config: LiveConfig) {
  return {
    ...getHealth(config),
    editable: {
      providerPreset: config.providerPreset,
      asrProvider: config.asrProvider,
      llmProvider: config.llmProvider,
      llmBaseUrl: config.llmBaseUrl || "",
      llmModel: config.llmModel,
      ttsProvider: config.ttsProvider,
      ttsVersion: config.ttsVersion || "",
      ttsModel: config.ttsModel,
      ttsVoiceId: config.ttsVoiceId || "",
      pronunciationProvider: config.pronunciationProvider,
      openaiModel: config.llmModel,
      cartesiaVersion: config.ttsVersion || "",
      cartesiaModel: config.ttsModel,
      cartesiaVoiceId: config.ttsVoiceId || ""
    }
  };
}

export function getHealth(config: LiveConfig) {
  const asrIsMock = config.asrProvider === "mock";
  const asrIsReady =
    asrIsMock ||
    (config.asrProvider === "deepgram" && Boolean(config.deepgramApiKey)) ||
    (config.asrProvider === "assemblyai" && Boolean(config.assemblyAiApiKey || config.asrApiKey));
  const asrIsImplemented = asrIsMock || config.asrProvider === "deepgram" || config.asrProvider === "assemblyai";
  const ttsIsMock = config.ttsProvider === "mock";
  const ttsIsReady =
    ttsIsMock || (config.ttsProvider === "cartesia" && Boolean(config.ttsApiKey && config.ttsVoiceId));
  const ttsIsImplemented = ttsIsMock || config.ttsProvider === "cartesia";
  const llmIsReady = Boolean(config.llmApiKey);

  const asr = {
    provider: config.asrProvider,
    configured: asrIsReady,
    active: config.apiMode === "live" ? asrIsReady && asrIsImplemented : asrIsMock,
    status: !asrIsImplemented ? "planned" : asrIsReady ? "ready" : "missing-key"
  };
  const llm = {
    provider: config.llmProvider,
    configured: llmIsReady,
    active: config.apiMode === "live" && llmIsReady,
    model: config.llmModel,
    baseUrl: config.llmBaseUrl || "",
    status: llmIsReady ? "ready" : "missing-key"
  };
  const tts = {
    provider: config.ttsProvider,
    configured: ttsIsReady,
    active: config.apiMode === "live" ? ttsIsReady && ttsIsImplemented : ttsIsMock,
    model: config.ttsModel,
    status: !ttsIsImplemented ? "planned" : ttsIsReady ? "ready" : "missing-key"
  };

  return {
    mode: config.apiMode,
    providers: {
      asr,
      llm,
      tts,
      pronunciation: {
        provider: config.pronunciationProvider,
        configured: config.pronunciationProvider === "rule",
        active: config.pronunciationProvider === "rule",
        status: config.pronunciationProvider === "rule" ? "ready" : "planned"
      },
      deepgram: {
        configured: Boolean(config.deepgramApiKey),
        active: config.apiMode === "live" && Boolean(config.deepgramApiKey)
      },
      assemblyai: {
        configured: Boolean(config.assemblyAiApiKey || config.asrApiKey),
        active: config.apiMode === "live" && Boolean(config.assemblyAiApiKey || config.asrApiKey)
      },
      openai: {
        configured: Boolean(config.llmApiKey),
        active: config.apiMode === "live" && Boolean(config.llmApiKey),
        model: config.llmModel
      },
      cartesia: {
        configured: Boolean(config.ttsApiKey && config.ttsVoiceId),
        active: config.apiMode === "live" && Boolean(config.ttsApiKey && config.ttsVoiceId),
        model: config.ttsModel
      }
    },
    fallbackEnabled: true
  };
}
