import type { LiveConfig } from "./providers/liveProviders";
import "./env";

export type AppOptions = {
  apiMode?: "mock" | "live";
};

export type RuntimeSettingsInput = {
  apiMode?: "mock" | "live";
  deepgramApiKey?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  cartesiaApiKey?: string;
  cartesiaVersion?: string;
  cartesiaModel?: string;
  cartesiaVoiceId?: string;
};

export function getConfig(options: AppOptions = {}): LiveConfig {
  const apiMode = options.apiMode ?? (process.env.API_MODE === "live" ? "live" : "mock");

  return {
    apiMode,
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini",
    cartesiaApiKey: process.env.CARTESIA_API_KEY,
    cartesiaVersion: process.env.CARTESIA_VERSION || "2026-03-01",
    cartesiaModel: process.env.CARTESIA_TTS_MODEL || "sonic-latest",
    cartesiaVoiceId: process.env.CARTESIA_VOICE_ID
  };
}

function cleanValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function applyRuntimeSettings(config: LiveConfig, input: RuntimeSettingsInput): LiveConfig {
  if (input.apiMode === "mock" || input.apiMode === "live") {
    config.apiMode = input.apiMode;
  }

  const deepgramApiKey = cleanValue(input.deepgramApiKey);
  const openaiApiKey = cleanValue(input.openaiApiKey);
  const cartesiaApiKey = cleanValue(input.cartesiaApiKey);
  const openaiModel = cleanValue(input.openaiModel);
  const cartesiaVersion = cleanValue(input.cartesiaVersion);
  const cartesiaModel = cleanValue(input.cartesiaModel);
  const cartesiaVoiceId = cleanValue(input.cartesiaVoiceId);

  if (deepgramApiKey) config.deepgramApiKey = deepgramApiKey;
  if (openaiApiKey) config.openaiApiKey = openaiApiKey;
  if (cartesiaApiKey) config.cartesiaApiKey = cartesiaApiKey;
  if (openaiModel) config.openaiModel = openaiModel;
  if (cartesiaVersion) config.cartesiaVersion = cartesiaVersion;
  if (cartesiaModel) config.cartesiaModel = cartesiaModel;
  if (cartesiaVoiceId) config.cartesiaVoiceId = cartesiaVoiceId;

  return config;
}

export function getRuntimeSettings(config: LiveConfig) {
  return {
    ...getHealth(config),
    editable: {
      openaiModel: config.openaiModel,
      cartesiaVersion: config.cartesiaVersion,
      cartesiaModel: config.cartesiaModel,
      cartesiaVoiceId: config.cartesiaVoiceId || ""
    }
  };
}

export function getHealth(config: LiveConfig) {
  return {
    mode: config.apiMode,
    providers: {
      deepgram: {
        configured: Boolean(config.deepgramApiKey),
        active: config.apiMode === "live" && Boolean(config.deepgramApiKey)
      },
      openai: {
        configured: Boolean(config.openaiApiKey),
        active: config.apiMode === "live" && Boolean(config.openaiApiKey),
        model: config.openaiModel
      },
      cartesia: {
        configured: Boolean(config.cartesiaApiKey && config.cartesiaVoiceId),
        active: config.apiMode === "live" && Boolean(config.cartesiaApiKey && config.cartesiaVoiceId),
        model: config.cartesiaModel
      }
    },
    fallbackEnabled: true
  };
}
