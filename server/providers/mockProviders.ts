import type {
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../../shared/schemas";
import { findScenarioTask } from "../data";

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

  return {
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
    provider: "mock",
    fallback: true,
    fallbackReason: "API_MODE=mock"
  };
}

export function mockDialogueTurn(userText: string, round: number): DialogueTurnResult {
  if (/urgent/i.test(userText)) {
    return {
      aiText: "Do you mean an AI agent project? What problem did it solve?",
      hintZh: "AI 听到的 urgent 可能是 agent。先确认关键词，再说明项目解决的问题。",
      coachState: "asking",
      positiveFeedback: "你已经说出了项目主题，接下来把关键词说准就更好了。",
      correctionPreview: "如果你想表达 AI agent，可以说 It is about my AI agent project.",
      nextRoundGoal: "确认项目类型，并说明它解决了什么问题。",
      provider: "mock",
      fallback: true
    };
  }

  const resultWord = /result|improved|increase|reduced|saved|score/i.test(userText)
    ? "Good. Now make the result measurable with one number."
    : "What result did your work create for users or the team?";

  return {
    aiText: resultWord,
    hintZh: "回答要更具体：先说结果，再补数字或用户影响。",
    coachState: "asking",
    positiveFeedback: /result|improved|increase|reduced|saved|score/i.test(userText)
      ? "很好，你开始补充具体结果了。"
      : "你已经说清楚项目主题了，这一轮回答有基本结构。",
    correctionPreview:
      round <= 1
        ? "建议把 I built campus navigation app 改为 I built a campus navigation app."
        : "这一轮表达基本清楚，继续压缩句子长度。",
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

export function mockReport(): ReportResult {
  return {
    reportId: `report_${Date.now()}`,
    totalScore: 84,
    dimensions: [
      {
        id: "fluency",
        labelZh: "流利度",
        labelEn: "Fluency",
        score: 85,
        explanationZh: "回答连贯，但可以减少重复铺垫。"
      },
      {
        id: "pronunciation",
        labelZh: "发音清晰度",
        labelEn: "Pronunciation",
        score: 82,
        explanationZh: "转写置信度较高，个别长词需要放慢。"
      },
      {
        id: "grammar",
        labelZh: "语法准确度",
        labelEn: "Grammar",
        score: 80,
        explanationZh: "主要问题是冠词和动词时态，需要注意单复数。"
      },
      {
        id: "vocabulary",
        labelZh: "词汇准确度",
        labelEn: "Vocabulary",
        score: 84,
        explanationZh: "项目词汇基本准确，但 agent/result 等关键词需要更清晰。"
      },
      {
        id: "coherence",
        labelZh: "连贯性",
        labelEn: "Coherence",
        score: 83,
        explanationZh: "能围绕项目说明，但背景、职责、结果之间衔接还可以更紧。"
      },
      {
        id: "task_completion",
        labelZh: "任务完成度",
        labelEn: "Task Completion",
        score: 88,
        explanationZh: "回答覆盖项目内容，并能继续回应追问。"
      },
      {
        id: "interaction",
        labelZh: "互动回应",
        labelEn: "Interaction",
        score: 81,
        explanationZh: "能回应追问，但可以更主动确认问题并补充细节。"
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
    coachCommentZh: "语法还算稳，但表达太泛。下一轮加一个具体数字。",
    provider: "mock",
    fallback: true
  };
}
