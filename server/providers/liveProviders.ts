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
  asrModel: string;
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
  if (config.asrProvider === "qwen-asr") {
    return transcribeWithQwen(audio, config);
  }

  if (config.asrProvider === "assemblyai") {
    return transcribeWithAssemblyAi(audio, config);
  }

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

async function transcribeWithAssemblyAi(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
  if (config.apiMode !== "live" || !config.asrApiKey || !audio) {
    return {
      ...mockTranscribe(),
      fallbackReason: !audio ? "No audio uploaded" : "AssemblyAI ASR is not configured"
    };
  }

  const started = Date.now();
  try {
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        Authorization: config.asrApiKey,
        "Content-Type": "application/octet-stream"
      },
      body: audio.buffer as unknown as BodyInit
    });

    if (!uploadResponse.ok) {
      return { ...mockTranscribe(), fallbackReason: `AssemblyAI upload ${uploadResponse.status}` };
    }

    const uploadJson = (await uploadResponse.json()) as { upload_url?: string };
    if (!uploadJson.upload_url) {
      return { ...mockTranscribe(), fallbackReason: "AssemblyAI upload returned no URL" };
    }

    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: config.asrApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audio_url: uploadJson.upload_url,
        language_code: "en_us",
        punctuate: true,
        format_text: true,
        speech_models: [config.asrModel || "universal-3-pro"]
      })
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      return {
        ...mockTranscribe(),
        fallbackReason: `AssemblyAI transcript ${transcriptResponse.status}: ${errorText.slice(0, 180)}`
      };
    }

    const transcriptJson = (await transcriptResponse.json()) as { id?: string };
    if (!transcriptJson.id) {
      return { ...mockTranscribe(), fallbackReason: "AssemblyAI transcript returned no ID" };
    }

    let transcript: {
      status?: string;
      text?: string;
      confidence?: number;
      audio_duration?: number;
      words?: Array<{ text?: string; start?: number; end?: number; confidence?: number }>;
      error?: string;
    } = {};

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptJson.id}`, {
        headers: { Authorization: config.asrApiKey }
      });

      if (!pollResponse.ok) {
        return { ...mockTranscribe(), fallbackReason: `AssemblyAI poll ${pollResponse.status}` };
      }

      transcript = await pollResponse.json();
      if (transcript.status === "completed" || transcript.status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    if (transcript.status !== "completed") {
      return {
        ...mockTranscribe(),
        fallbackReason: transcript.error || `AssemblyAI status ${transcript.status || "timeout"}`
      };
    }

    return {
      text: transcript.text || "",
      confidence: transcript.confidence ?? 0,
      words:
        transcript.words?.map((word) => ({
          word: (word.text || "").toLowerCase().replace(/[^a-z'-]/gi, ""),
          punctuatedWord: word.text || "",
          start: (word.start ?? 0) / 1000,
          end: (word.end ?? 0) / 1000,
          confidence: word.confidence ?? transcript.confidence ?? 0
        })) ?? [],
      durationSec: transcript.audio_duration ?? 0,
      providerLatencyMs: Date.now() - started,
      provider: "assemblyai"
    };
  } catch (error) {
    return {
      ...mockTranscribe(),
      fallbackReason: error instanceof Error ? error.message : "AssemblyAI request failed"
    };
  }
}

async function transcribeWithQwen(
  audio: Express.Multer.File | undefined,
  config: LiveConfig
): Promise<TranscriptResult> {
  if (config.apiMode !== "live" || !config.asrApiKey || !audio) {
    return {
      ...mockTranscribe(),
      fallbackReason: !audio ? "No audio uploaded" : "Qwen ASR is not configured"
    };
  }

  const started = Date.now();
  try {
    const dataUrl = `data:${audio.mimetype || "audio/webm"};base64,${audio.buffer.toString("base64")}`;
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.asrApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.asrModel || "qwen3-asr-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: dataUrl }
              }
            ]
          }
        ],
        stream: false,
        asr_options: {
          language: "en",
          enable_itn: true
        }
      })
    });

    if (!response.ok) {
      return { ...mockTranscribe(), fallbackReason: `Qwen ASR ${response.status}` };
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          annotations?: Array<{ language?: string; emotion?: string }>;
        };
      }>;
      usage?: { seconds?: number };
    };
    const text = json.choices?.[0]?.message?.content || "";
    const words = text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => ({
        word: word.toLowerCase().replace(/[^a-z'-]/gi, ""),
        punctuatedWord: word,
        start: index * 0.35,
        end: index * 0.35 + 0.28,
        confidence: 0.9
      }));

    return {
      text,
      confidence: text ? 0.9 : 0,
      words,
      durationSec: words.length * 0.35,
      providerLatencyMs: Date.now() - started,
      provider: "qwen-asr"
    };
  } catch (error) {
    return {
      ...mockTranscribe(),
      fallbackReason: error instanceof Error ? error.message : "Qwen ASR request failed"
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
    response_format: { type: "json_object" },
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
  } catch (error) {
    return {
      ...mockDialogueTurn(input.userText, input.round),
      fallbackReason: error instanceof Error ? error.message : "Qwen dialogue request failed"
    } as DialogueTurnResult;
  }
}

export async function synthesizeWithCartesia(
  text: string,
  config: LiveConfig
): Promise<SpeechAudioResult> {
  if (config.ttsProvider === "qwen-tts") {
    return synthesizeWithQwenTts(text, config);
  }

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
        output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
        language: "en"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ...mockSpeech(text),
        fallbackReason: `Cartesia ${response.status}: ${errorText.slice(0, 180)}`
      } as SpeechAudioResult;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      audioUrl: null,
      format: "mp3",
      durationEstimateSec: Math.max(1.8, text.split(/\s+/).length * 0.28),
      provider: "cartesia"
    };
  } catch (error) {
    return {
      ...mockSpeech(text),
      fallbackReason: error instanceof Error ? error.message : "Cartesia request failed"
    } as SpeechAudioResult;
  }
}

function parseSseJsonLines(raw: string): unknown[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractQwenAudioBase64(payloads: unknown[]): string | null {
  const chunks: Buffer[] = [];
  for (const payload of payloads) {
    const value = payload as {
      output?: {
        audio?: { data?: string; url?: string };
        choices?: Array<{ message?: { audio?: { data?: string; url?: string } } }>;
      };
    };
    const direct = value.output?.audio?.data;
    if (direct) chunks.push(Buffer.from(direct, "base64"));
    const choiceAudio = value.output?.choices?.[0]?.message?.audio?.data;
    if (choiceAudio) chunks.push(Buffer.from(choiceAudio, "base64"));
  }
  return chunks.length ? Buffer.concat(chunks).toString("base64") : null;
}

function normalizeReportJson(json: unknown, provider: string): Record<string, unknown> {
  const raw = json as Record<string, unknown>;
  const dimensionsRaw = raw.dimensions;
  const dimensionFallbacks = {
    pronunciation: { labelZh: "发音清晰度", labelEn: "Pronunciation" },
    fluency: { labelZh: "流利度", labelEn: "Fluency" },
    grammar: { labelZh: "语法准确度", labelEn: "Grammar" },
    expression: { labelZh: "表达自然度", labelEn: "Expression" },
    taskCompletion: { labelZh: "任务完成度", labelEn: "Task Completion" }
  } as const;
  const dimensions = Array.isArray(dimensionsRaw)
    ? dimensionsRaw
    : Object.entries(dimensionFallbacks).map(([id, label]) => {
        const value =
          dimensionsRaw && typeof dimensionsRaw === "object"
            ? (dimensionsRaw as Record<string, unknown>)[id]
            : undefined;
        const item = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
        return {
          id,
          labelZh: typeof item.labelZh === "string" ? item.labelZh : label.labelZh,
          labelEn: typeof item.labelEn === "string" ? item.labelEn : label.labelEn,
          score: typeof item.score === "number" ? item.score : 80,
          explanationZh:
            typeof item.explanationZh === "string"
              ? item.explanationZh
              : typeof item.explanation === "string"
                ? item.explanation
                : "本维度由 Qwen 根据转写、表达和任务完成情况评估。"
        };
      });
  const corrections = Array.isArray(raw.corrections)
    ? raw.corrections.map((correction) => {
        const item = typeof correction === "object" && correction ? (correction as Record<string, unknown>) : {};
        return {
          original: String(item.original ?? item.originalText ?? ""),
          improved: String(item.improved ?? item.improvedText ?? item.suggestion ?? ""),
          explanationZh: String(item.explanationZh ?? item.explanation ?? item.reason ?? "")
        };
      })
    : [];

  return {
    ...raw,
    reportId: typeof raw.reportId === "string" ? raw.reportId : `report_${Date.now()}`,
    totalScore: typeof raw.totalScore === "number" ? raw.totalScore : 80,
    dimensions,
    summaryZh: typeof raw.summaryZh === "string" ? raw.summaryZh : String(raw.summary ?? ""),
    corrections,
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(String) : [],
    coachCommentZh:
      typeof raw.coachCommentZh === "string" ? raw.coachCommentZh : String(raw.coachComment ?? raw.summaryZh ?? ""),
    provider
  };
}

async function synthesizeWithQwenTts(
  text: string,
  config: LiveConfig
): Promise<SpeechAudioResult> {
  if (config.apiMode !== "live" || !config.ttsApiKey || !text.trim()) {
    return mockSpeech(text);
  }

  try {
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.ttsApiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-SSE": "enable"
        },
        body: JSON.stringify({
          model: config.ttsModel || "qwen3-tts-flash",
          input: {
            text,
            voice: config.ttsVoiceId || "Cherry",
            language_type: "English"
          }
        })
      }
    );

    if (!response.ok) {
      return { ...mockSpeech(text), fallbackReason: `Qwen TTS ${response.status}` } as SpeechAudioResult;
    }

    const raw = await response.text();
    const audioBase64 = extractQwenAudioBase64(parseSseJsonLines(raw));
    if (!audioBase64) {
      return { ...mockSpeech(text), fallbackReason: "Qwen TTS returned no inline audio" } as SpeechAudioResult;
    }

    return {
      audioBase64,
      audioUrl: null,
      format: "wav",
      durationEstimateSec: Math.max(1.8, text.split(/\s+/).length * 0.28),
      provider: "qwen-tts"
    };
  } catch (error) {
    return {
      ...mockSpeech(text),
      fallbackReason: error instanceof Error ? error.message : "Qwen TTS request failed"
    } as SpeechAudioResult;
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

    return reportResultSchema.parse(normalizeReportJson(json, config.llmProvider));
  } catch (error) {
    return {
      ...mockReport(),
      fallbackReason: error instanceof Error ? error.message : "Qwen report request failed"
    } as ReportResult;
  }
}
