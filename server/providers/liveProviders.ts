import OpenAI from "openai";
import type {
  AsrProvider,
  LlmProvider,
  PronunciationProvider,
  ProviderPreset,
  TtsProvider
} from "../config";
import type {
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../../shared/schemas";
import { dialogueTurnResultSchema, reportResultSchema } from "../../shared/schemas";
import { mockDialogueTurn, mockReport, mockSpeech, mockTranscribe } from "./mockProviders";

export type LiveConfig = {
  apiMode: "mock" | "live";
  providerPreset: ProviderPreset;
  asrProvider: AsrProvider;
  asrApiKey?: string;
  deepgramApiKey?: string;
  llmProvider: LlmProvider;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel: string;
  openaiApiKey?: string;
  openaiModel: string;
  ttsProvider: TtsProvider;
  ttsApiKey?: string;
  ttsVersion: string;
  ttsModel: string;
  ttsVoiceId?: string;
  cartesiaApiKey?: string;
  cartesiaVersion: string;
  cartesiaModel: string;
  cartesiaVoiceId?: string;
  pronunciationProvider: PronunciationProvider;
};

export async function transcribeWithDeepgram(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
  if (config.asrProvider !== "deepgram") {
    return {
      ...mockTranscribe(),
      fallbackReason:
        config.asrProvider === "mock"
          ? "ASR provider is mock"
          : `${config.asrProvider} ASR live adapter is planned`
    };
  }

  if (config.apiMode !== "live" || !config.deepgramApiKey || !audio) {
    return {
      ...mockTranscribe(),
      fallbackReason: !audio ? "No audio uploaded" : "Deepgram is not configured"
    };
  }

  const started = Date.now();
  try {
    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${config.deepgramApiKey}`,
          "Content-Type": audio.mimetype || "audio/webm"
        },
        body: audio.buffer as unknown as BodyInit
      }
    );

    if (!response.ok) {
      return { ...mockTranscribe(), fallbackReason: `Deepgram ${response.status}` };
    }

    const json = (await response.json()) as {
      metadata?: { duration?: number };
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string;
            confidence?: number;
            words?: Array<{
              word: string;
              start: number;
              end: number;
              confidence: number;
              punctuated_word?: string;
            }>;
          }>;
        }>;
      };
    };
    const alternative = json.results?.channels?.[0]?.alternatives?.[0];

    return {
      text: alternative?.transcript || "",
      confidence: alternative?.confidence ?? 0,
      words:
        alternative?.words?.map((word) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
          punctuatedWord: word.punctuated_word
        })) ?? [],
      durationSec: json.metadata?.duration ?? 0,
      providerLatencyMs: Date.now() - started,
      provider: "deepgram"
    };
  } catch (error) {
    return {
      ...mockTranscribe(),
      fallbackReason: error instanceof Error ? error.message : "Deepgram request failed"
    };
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced?.[1] ?? trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(source.slice(start, end + 1));
  }
  return JSON.parse(source);
}

function createOpenAiCompatibleClient(config: LiveConfig) {
  if (!config.llmApiKey) return null;
  return new OpenAI({
    apiKey: config.llmApiKey,
    baseURL: config.llmBaseUrl || undefined
  });
}

async function createJsonChatCompletion(
  config: LiveConfig,
  system: string,
  user: string
): Promise<unknown> {
  const client = createOpenAiCompatibleClient(config);
  if (!client) {
    throw new Error(`${config.llmProvider} is not configured`);
  }

  const completion = await client.chat.completions.create({
    model: config.llmModel,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`${config.llmProvider} returned empty content`);
  }
  return parseJsonContent(content);
}

export async function generateTurnWithLlm(
  input: {
    scenarioId: string;
    taskId: string;
    scenarioLabel?: string;
    taskTitle?: string;
    taskFocus?: string;
    aiRoleZh?: string;
    round: number;
    userText: string;
  },
  config: LiveConfig
): Promise<DialogueTurnResult> {
  if (config.apiMode !== "live" || !config.llmApiKey) {
    return mockDialogueTurn(input.userText, input.round);
  }

  try {
    const json = await createJsonChatCompletion(
      config,
      [
        "You are an English speaking coach for Chinese learners.",
        "Return one strict JSON object only. Do not include Markdown.",
        "The JSON keys must be aiText, hintZh, coachState, correctionPreview, nextRoundGoal, provider.",
        "coachState must be asking.",
        `provider must be ${config.llmProvider}.`
      ].join(" "),
      `Scenario: ${input.scenarioLabel || input.scenarioId}
Task: ${input.taskTitle || input.taskId}
AI role: ${input.aiRoleZh || "AI speaking coach"}
Learning focus: ${input.taskFocus || "help the learner answer clearly and naturally"}
Round: ${input.round}
User answer: ${input.userText}
Return a concise next question in English and a coaching hint in Chinese.`
    );

    return dialogueTurnResultSchema.parse({
      ...(json as Record<string, unknown>),
      coachState: "asking",
      provider: config.llmProvider
    });
  } catch {
    return mockDialogueTurn(input.userText, input.round);
  }
}

export async function synthesizeWithCartesia(
  text: string,
  config: LiveConfig
): Promise<SpeechAudioResult> {
  if (config.ttsProvider !== "cartesia") {
    return mockSpeech(text);
  }

  if (
    config.apiMode !== "live" ||
    !config.ttsApiKey ||
    !config.ttsVoiceId ||
    !text.trim()
  ) {
    return mockSpeech(text);
  }

  try {
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ttsApiKey}`,
        "Cartesia-Version": config.ttsVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: config.ttsModel,
        transcript: text,
        voice: { id: config.ttsVoiceId },
        output_format: { container: "mp3" },
        language: "en"
      })
    });

    if (!response.ok) {
      return mockSpeech(text);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      audioUrl: null,
      format: "mp3",
      durationEstimateSec: Math.max(1.8, text.split(/\s+/).length * 0.28),
      provider: "cartesia"
    };
  } catch {
    return mockSpeech(text);
  }
}

export async function generateReportWithLlm(
  _payload: unknown,
  config: LiveConfig
): Promise<ReportResult> {
  if (config.apiMode !== "live" || !config.llmApiKey) {
    return mockReport();
  }

  try {
    const json = await createJsonChatCompletion(
      config,
      [
        "Generate a Chinese-first English speaking practice report.",
        "Return one strict JSON object only. Do not include Markdown.",
        "The JSON keys must be reportId, totalScore, dimensions, summaryZh, corrections, suggestions, coachCommentZh, provider.",
        "dimensions must include pronunciation, fluency, grammar, expression, taskCompletion.",
        `provider must be ${config.llmProvider}.`
      ].join(" "),
      JSON.stringify(_payload)
    );

    return reportResultSchema.parse({
      ...(json as Record<string, unknown>),
      provider: config.llmProvider
    });
  } catch {
    return mockReport();
  }
}
