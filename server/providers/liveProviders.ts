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
import { mockDialogueTurn, mockReport, mockSpeech, mockTranscribe, type DialogueContextTurn } from "./mockProviders";

export type LiveConfig = {
  apiMode: "mock" | "live";
  providerPreset: ProviderPreset;
  asrProvider: AsrProvider;
  asrApiKey?: string;
  deepgramApiKey?: string;
  assemblyAiApiKey?: string;
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
  defaultPrompt?: string;
};

function mockAsrFallback(config: LiveConfig, reason?: string): TranscriptResult {
  return {
    ...mockTranscribe(),
    fallbackReason:
      reason ??
      (config.asrProvider === "mock"
        ? "ASR provider is mock"
        : `${config.asrProvider} ASR live adapter is planned`)
  };
}

export async function transcribeWithConfiguredProvider(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
  if (config.asrProvider === "assemblyai") {
    return transcribeWithAssemblyAi(audio, config);
  }

  if (config.asrProvider !== "deepgram") {
    return mockAsrFallback(config);
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

export const transcribeWithDeepgram = transcribeWithConfiguredProvider;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeWithAssemblyAi(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
  const apiKey = config.assemblyAiApiKey || config.asrApiKey;
  if (config.apiMode !== "live" || !apiKey || !audio) {
    return mockAsrFallback(config, !audio ? "No audio uploaded" : "AssemblyAI is not configured");
  }

  const started = Date.now();
  try {
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/octet-stream"
      },
      body: audio.buffer as unknown as BodyInit
    });
    if (!uploadResponse.ok) {
      return mockAsrFallback(config, `AssemblyAI upload ${uploadResponse.status}`);
    }

    const uploadJson = (await uploadResponse.json()) as { upload_url?: string };
    if (!uploadJson.upload_url) {
      return mockAsrFallback(config, "AssemblyAI upload returned no URL");
    }

    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audio_url: uploadJson.upload_url,
        language_code: "en",
        punctuate: true,
        format_text: true
      })
    });
    if (!submitResponse.ok) {
      return mockAsrFallback(config, `AssemblyAI transcript ${submitResponse.status}`);
    }

    let transcript = (await submitResponse.json()) as AssemblyAiTranscript;
    const maxPolls = Number(process.env.ASSEMBLYAI_MAX_POLLS || 30);
    const pollIntervalMs = Number(process.env.ASSEMBLYAI_POLL_INTERVAL_MS || 1000);
    for (let attempt = 0; attempt < maxPolls && transcript.status !== "completed"; attempt += 1) {
      if (transcript.status === "error") {
        return mockAsrFallback(config, transcript.error || "AssemblyAI transcript failed");
      }
      if (!transcript.id) break;
      await sleep(pollIntervalMs);
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
        headers: { Authorization: apiKey }
      });
      if (!pollResponse.ok) {
        return mockAsrFallback(config, `AssemblyAI poll ${pollResponse.status}`);
      }
      transcript = (await pollResponse.json()) as AssemblyAiTranscript;
    }

    if (transcript.status !== "completed") {
      return mockAsrFallback(config, "AssemblyAI transcript timed out");
    }

    return {
      text: transcript.text || "",
      confidence: transcript.confidence ?? averageConfidence(transcript.words),
      words:
        transcript.words?.map((word) => ({
          word: word.text,
          start: msToSeconds(word.start),
          end: msToSeconds(word.end),
          confidence: word.confidence,
          punctuatedWord: word.text
        })) ?? [],
      durationSec: transcript.audio_duration ?? 0,
      providerLatencyMs: Date.now() - started,
      provider: "assemblyai"
    };
  } catch (error) {
    return mockAsrFallback(config, error instanceof Error ? error.message : "AssemblyAI request failed");
  }
}

type AssemblyAiTranscript = {
  id?: string;
  status?: "queued" | "processing" | "completed" | "error";
  text?: string;
  confidence?: number;
  audio_duration?: number;
  error?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
};

function msToSeconds(value: number) {
  return Math.round((value / 1000) * 1000) / 1000;
}

function averageConfidence(words: AssemblyAiTranscript["words"]) {
  if (!words?.length) return 0;
  return words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
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
      { role: "system", content: [config.defaultPrompt, system].filter(Boolean).join("\n\n") },
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
    currentAiText?: string;
    userText: string;
    turns?: DialogueContextTurn[];
  },
  config: LiveConfig
): Promise<DialogueTurnResult> {
  if (config.apiMode !== "live" || !config.llmApiKey) {
    return mockDialogueTurn(input.userText, input.round, input);
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
Conversation so far:
${formatConversation(input.turns)}
Current AI question: ${input.currentAiText || "(not provided)"}
User answer: ${input.userText}
Return a concise next question in English and a coaching hint in Chinese. The next question must be different from every AI question in the conversation and from the current AI question.`
    );

    return dialogueTurnResultSchema.parse({
      ...(json as Record<string, unknown>),
      coachState: "asking",
      provider: config.llmProvider
    });
  } catch {
    return mockDialogueTurn(input.userText, input.round, input);
  }
}

function formatConversation(turns: DialogueContextTurn[] | undefined) {
  if (!turns?.length) return "(none)";
  return turns
    .map((turn) => `Round ${turn.round}\nAI: ${turn.aiText}\nLearner: ${turn.userText}`)
    .join("\n\n");
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
