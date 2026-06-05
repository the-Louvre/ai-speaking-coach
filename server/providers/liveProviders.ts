import OpenAI from "openai";
import type {
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../../shared/schemas";
import { dialogueTurnResultSchema, reportResultSchema } from "../../shared/schemas";
import { reportJsonSchema } from "./reportSchema";
import { mockDialogueTurn, mockReport, mockSpeech, mockTranscribe } from "./mockProviders";

export type LiveConfig = {
  apiMode: "mock" | "live";
  deepgramApiKey?: string;
  openaiApiKey?: string;
  openaiModel: string;
  cartesiaApiKey?: string;
  cartesiaVersion: string;
  cartesiaModel: string;
  cartesiaVoiceId?: string;
};

export async function transcribeWithDeepgram(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
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

export async function generateTurnWithOpenAI(
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
  if (config.apiMode !== "live" || !config.openaiApiKey) {
    return mockDialogueTurn(input.userText, input.round);
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const response = await client.responses.create({
      model: config.openaiModel,
      instructions:
        "You are an English speaking coach for Chinese learners. Return concise JSON only.",
      input: `Scenario: ${input.scenarioLabel || input.scenarioId}
Task: ${input.taskTitle || input.taskId}
AI role: ${input.aiRoleZh || "AI speaking coach"}
Learning focus: ${input.taskFocus || "help the learner answer clearly and naturally"}
Round: ${input.round}
User answer: ${input.userText}
Return JSON with aiText, hintZh, coachState, correctionPreview, nextRoundGoal, provider.`,
      text: {
        format: {
          type: "json_schema",
          name: "dialogue_turn",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "aiText",
              "hintZh",
              "coachState",
              "correctionPreview",
              "nextRoundGoal",
              "provider"
            ],
            properties: {
              aiText: { type: "string" },
              hintZh: { type: "string" },
              coachState: { type: "string", enum: ["asking"] },
              correctionPreview: { type: "string" },
              nextRoundGoal: { type: "string" },
              provider: { type: "string" }
            }
          }
        }
      }
    });

    return dialogueTurnResultSchema.parse(JSON.parse(response.output_text));
  } catch {
    return mockDialogueTurn(input.userText, input.round);
  }
}

export async function synthesizeWithCartesia(
  text: string,
  config: LiveConfig
): Promise<SpeechAudioResult> {
  if (
    config.apiMode !== "live" ||
    !config.cartesiaApiKey ||
    !config.cartesiaVoiceId ||
    !text.trim()
  ) {
    return mockSpeech(text);
  }

  try {
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cartesiaApiKey}`,
        "Cartesia-Version": config.cartesiaVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: config.cartesiaModel,
        transcript: text,
        voice: { id: config.cartesiaVoiceId },
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

export async function generateReportWithOpenAI(
  _payload: unknown,
  config: LiveConfig
): Promise<ReportResult> {
  if (config.apiMode !== "live" || !config.openaiApiKey) {
    return mockReport();
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const response = await client.responses.create({
      model: config.openaiModel,
      instructions:
        "Generate a Chinese-first English speaking practice report. Return JSON only.",
      input: JSON.stringify(_payload),
      text: {
        format: {
          type: "json_schema",
          name: "practice_report",
          schema: reportJsonSchema
        }
      }
    });

    return reportResultSchema.parse(JSON.parse(response.output_text));
  } catch {
    return mockReport();
  }
}
