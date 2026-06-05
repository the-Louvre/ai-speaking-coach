import type {
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../../shared/schemas";
import { findScenarioTask } from "../data";
import { createCorrectionPreview } from "./correctionPreview";
import { deriveSpeechEvidence } from "./speechEvidence";

export type DialogueContextTurn = {
  round: number;
  aiText: string;
  userText: string;
};

export function mockStartSession(scenarioId: string, taskId: string) {
  const { task } = findScenarioTask(scenarioId, taskId);

  return {
    sessionId: `session_${Date.now()}`,
    aiText: task.openingQuestion,
    hintZh: `这一轮重点：${task.focus}。先回答问题，再补一个具体例子。`,
    coachState: "asking" as const,
    roundLimit: 5
  };
}

export function mockTranscribe(): TranscriptResult {
  const words = [
    "I",
    "built",
    "a",
    "campus",
    "navigation",
    "project",
    "and",
    "improved",
    "the",
    "route",
    "flow"
  ];

  const base = {
    text: "I built a campus navigation project and improved the route flow.",
    confidence: 0.93,
    words: words.map((word, index) => ({
      word: word.toLowerCase(),
      punctuatedWord: index === 0 ? word : word,
      start: index * 0.32,
      end: index * 0.32 + 0.24,
      confidence: index === 4 ? 0.74 : 0.92 + (index % 3) * 0.02
    })),
    durationSec: 4.1,
    providerLatencyMs: 120,
    provider: "mock"
  };

  return {
    ...base,
    ...deriveSpeechEvidence(base),
    fallback: true,
    fallbackReason: "API_MODE=mock"
  };
}

export function mockDialogueTurn(
  userText: string,
  round: number,
  context: { currentAiText?: string; turns?: DialogueContextTurn[] } = {}
): DialogueTurnResult {
  const resultWord = /result|improved|increase|reduced|saved|score/i.test(userText)
    ? "Good. Now make the result measurable with one number."
    : "What result did your work create for users or the team?";
  const followUps = [
    resultWord,
    "Can you give one concrete example of how a student used it?",
    "What was the hardest trade-off you made while building it?",
    "How would you improve it if you had one more month?",
    "Great. Please summarize your answer in two confident sentences."
  ];
  const askedQuestions = new Set(
    [context.currentAiText, ...(context.turns ?? []).map((turn) => turn.aiText)]
      .filter((text): text is string => Boolean(text))
      .map((text) => text.trim().toLowerCase())
  );
  const preferred = followUps[Math.max(0, Math.min(round - 1, followUps.length - 1))];
  const aiText =
    askedQuestions.has(preferred.toLowerCase())
      ? followUps.find((question) => !askedQuestions.has(question.toLowerCase())) ?? preferred
      : preferred;

  return {
    aiText,
    hintZh: "回答要更具体：先说结果，再补数字或用户影响。",
    coachState: "asking",
    correctionPreview: createCorrectionPreview({ userText, round }),
    nextRoundGoal: "补充一个具体结果，例如效率提升、错误减少或用户反馈。",
    provider: "mock",
    fallback: true
  };
}

export function mockSpeech(text: string): SpeechAudioResult {
  return {
    audioBase64: Buffer.from(`Mock speech for: ${text}`).toString("base64"),
    audioUrl: null,
    format: "mock",
    durationEstimateSec: Math.max(1.8, text.split(/\s+/).length * 0.28),
    provider: "mock",
    fallback: true
  };
}

type ReportTurnInput = DialogueContextTurn & {
  transcriptConfidence?: number;
  speechRateWpm?: number;
  lowConfidenceWords?: Array<{ word: string; confidence: number }>;
  pauseEvents?: Array<{ durationSec: number }>;
  pronunciationNotes?: string[];
};

function normalizeReportTurns(payload: unknown): ReportTurnInput[] {
  if (!payload || typeof payload !== "object") return [];
  const turns = (payload as { turns?: unknown }).turns;
  if (!Array.isArray(turns)) return [];
  return turns
    .map((turn): ReportTurnInput | null => {
      if (!turn || typeof turn !== "object") return null;
      const item = turn as Record<string, unknown>;
      return {
        round: Number(item.round || 0),
        aiText: String(item.aiText || ""),
        userText: String(item.userText || ""),
        transcriptConfidence:
          typeof item.transcriptConfidence === "number" ? item.transcriptConfidence : undefined,
        speechRateWpm: typeof item.speechRateWpm === "number" ? item.speechRateWpm : undefined,
        lowConfidenceWords: Array.isArray(item.lowConfidenceWords)
          ? item.lowConfidenceWords
              .map((word) => {
                if (!word || typeof word !== "object") return null;
                const value = word as Record<string, unknown>;
                return {
                  word: String(value.word || ""),
                  confidence: Number(value.confidence || 0)
                };
              })
              .filter((word): word is { word: string; confidence: number } => Boolean(word?.word))
          : [],
        pauseEvents: Array.isArray(item.pauseEvents)
          ? item.pauseEvents
              .map((pause) => {
                if (!pause || typeof pause !== "object") return null;
                return { durationSec: Number((pause as Record<string, unknown>).durationSec || 0) };
              })
              .filter((pause): pause is { durationSec: number } => Boolean(pause?.durationSec))
          : [],
        pronunciationNotes: Array.isArray(item.pronunciationNotes)
          ? item.pronunciationNotes.map(String)
          : []
      };
    })
    .filter((turn): turn is ReportTurnInput => Boolean(turn?.round && turn.userText.trim()));
}

function buildDimensionEvidence(turns: ReportTurnInput[]): ReportResult["dimensionEvidence"] {
  const turnRefs = turns.length ? turns.map((turn) => turn.round) : [1];
  const firstTurn = turns[0];
  const lowConfidenceWords = turns.flatMap((turn) => turn.lowConfidenceWords ?? []);
  const pauseCount = turns.reduce((sum, turn) => sum + (turn.pauseEvents?.length ?? 0), 0);
  const averageRate = Math.round(
    turns.reduce((sum, turn) => sum + (turn.speechRateWpm ?? 0), 0) /
      Math.max(1, turns.filter((turn) => turn.speechRateWpm).length)
  );
  const lowWordText = lowConfidenceWords.length
    ? lowConfidenceWords.map((word) => word.word).join(", ")
    : "未发现明显低置信词";

  return [
    {
      dimensionId: "pronunciation",
      evidenceZh: `第 ${firstTurn?.round ?? 1} 轮发音证据：${lowWordText}。评分为规则估算，来自转写置信度和低置信词。`,
      turnRefs
    },
    {
      dimensionId: "fluency",
      evidenceZh: `语速约 ${averageRate || "--"} WPM，检测到 ${pauseCount} 处明显停顿。`,
      turnRefs
    },
    {
      dimensionId: "grammar",
      evidenceZh: "逐句纠错显示冠词和时态仍是主要语法问题。",
      turnRefs
    },
    {
      dimensionId: "expression",
      evidenceZh: "回答能表达意思，但项目结果、数字和用户影响仍需要更具体。",
      turnRefs
    },
    {
      dimensionId: "taskCompletion",
      evidenceZh: "回答覆盖任务主题，并能继续回应追问；下一轮需要更快给出结论。",
      turnRefs
    }
  ];
}

export function mockReport(payload?: unknown): ReportResult {
  const turns = normalizeReportTurns(payload);

  return {
    reportId: `report_${Date.now()}`,
    totalScore: 84,
    dimensions: [
      {
        id: "pronunciation",
        labelZh: "发音清晰度",
        labelEn: "Pronunciation",
        score: 82,
        explanationZh: "转写置信度较高，个别长词需要放慢。"
      },
      {
        id: "fluency",
        labelZh: "流利度",
        labelEn: "Fluency",
        score: 85,
        explanationZh: "回答连贯，但可以减少重复铺垫。"
      },
      {
        id: "grammar",
        labelZh: "语法准确度",
        labelEn: "Grammar",
        score: 80,
        explanationZh: "主要问题是冠词和动词时态，需要注意单复数。"
      },
      {
        id: "expression",
        labelZh: "表达自然度",
        labelEn: "Expression",
        score: 84,
        explanationZh: "表达能被理解，但推荐使用更自然的项目结果表述。"
      },
      {
        id: "taskCompletion",
        labelZh: "任务完成度",
        labelEn: "Task Completion",
        score: 88,
        explanationZh: "回答覆盖项目内容，并能继续回应追问。"
      }
    ],
    summaryZh: "你能把项目讲出来，但结果表达还不够具体。下一轮优先补一个数字或真实影响。",
    corrections: [
      {
        original: "I built campus navigation app. It make route clear.",
        improved: "I built a campus navigation app that made route planning clearer.",
        explanationZh: "这里需要补冠词 a，并把 make 改成过去式 made，保持时态一致。"
      }
    ],
    suggestions: [
      "用一句话先说明项目结果。",
      "至少加入一个数字，例如节省时间或减少错误。",
      "回答追问时先短答，再补背景。"
    ],
    dimensionEvidence: buildDimensionEvidence(turns),
    coachCommentZh: "语法还算稳，但表达太泛。下一轮加一个具体数字。",
    provider: "mock",
    fallback: true
  };
}
