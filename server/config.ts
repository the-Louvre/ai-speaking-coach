import type { LiveConfig } from "./providers/liveProviders";
import "./env";

export type AppOptions = {
  apiMode?: "mock" | "live";
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
