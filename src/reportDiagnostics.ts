import type {
  ConversationTurn,
  EvidenceTurn,
  NextPractice,
  PronunciationTip,
  ReportResult,
  SentenceAnalysis
} from "../shared/schemas";

export type ReportDiagnostics = {
  sortedDimensions: ReportResult["dimensions"];
  strongestDimension: ReportResult["dimensions"][number] | null;
  weakestDimension: ReportResult["dimensions"][number] | null;
  evidenceTurns: EvidenceTurn[];
  sentenceAnalyses: SentenceAnalysis[];
  primaryAnalysis: SentenceAnalysis | null;
  pronunciationTips: PronunciationTip[];
  nextPractice: NextPractice;
};

export function createReportDiagnostics(
  report: ReportResult,
  turns: ConversationTurn[],
  targetGoal: string
): ReportDiagnostics {
  const sortedDimensions = [...report.dimensions].sort((a, b) => b.score - a.score);
  const sentenceAnalyses = report.sentenceAnalyses?.length
    ? report.sentenceAnalyses
    : createFallbackSentenceAnalyses(report);
  const evidenceTurns = report.evidenceTurns?.length
    ? report.evidenceTurns
    : createFallbackEvidenceTurns(turns, report);
  const pronunciationTips = report.pronunciationTips?.length
    ? report.pronunciationTips
    : createFallbackPronunciationTips(turns);

  return {
    sortedDimensions,
    strongestDimension: sortedDimensions[0] ?? null,
    weakestDimension: sortedDimensions.at(-1) ?? null,
    evidenceTurns,
    sentenceAnalyses,
    primaryAnalysis: sentenceAnalyses[0] ?? null,
    pronunciationTips,
    nextPractice: report.nextPractice ?? createFallbackNextPractice(report, targetGoal)
  };
}

function createFallbackSentenceAnalyses(report: ReportResult): SentenceAnalysis[] {
  return report.corrections.slice(0, 2).map((correction) => ({
    original: correction.original,
    improved: correction.improved,
    issueType: inferIssueType(correction.explanationZh),
    explanationZh: correction.explanationZh,
    highlights: [
      {
        originalText: findFirstChangedPhrase(correction.original, correction.improved).originalText,
        improvedText: findFirstChangedPhrase(correction.original, correction.improved).improvedText,
        reasonZh: correction.explanationZh
      }
    ]
  }));
}

function inferIssueType(explanationZh: string): SentenceAnalysis["issueType"] {
  if (/发音|重音|连读|弱读|语调/.test(explanationZh)) return "pronunciation";
  if (/逻辑|结构|衔接|结果/.test(explanationZh)) return "logic";
  if (/自然|表达|词/.test(explanationZh)) return "wording";
  return "grammar";
}

function findFirstChangedPhrase(original: string, improved: string) {
  const originalWords = original.split(/\s+/).filter(Boolean);
  const improvedWords = improved.split(/\s+/).filter(Boolean);
  const max = Math.max(originalWords.length, improvedWords.length);

  for (let index = 0; index < max; index += 1) {
    if (originalWords[index] !== improvedWords[index]) {
      return {
        originalText: originalWords.slice(index, index + 3).join(" ") || original,
        improvedText: improvedWords.slice(index, index + 3).join(" ") || improved
      };
    }
  }

  return { originalText: original, improvedText: improved };
}

function createFallbackEvidenceTurns(turns: ConversationTurn[], report: ReportResult): EvidenceTurn[] {
  const userTurns = turns
    .filter((turn) => turn.speaker === "user" && turn.text.trim())
    .slice(-3)
    .map((turn) => ({
      speaker: "user" as const,
      text: turn.text,
      reasonZh: "这句用户原话用于支撑本次纠错和表达优化建议。"
    }));

  if (userTurns.length) return userTurns;

  return report.corrections.slice(0, 2).map((correction) => ({
    speaker: "user" as const,
    text: correction.original,
    reasonZh: "这句来自报告纠错项，用于补足对话证据。"
  }));
}

function createFallbackPronunciationTips(turns: ConversationTurn[]): PronunciationTip[] {
  const text = turns
    .filter((turn) => turn.speaker === "user")
    .map((turn) => turn.text)
    .join(" ")
    .toLowerCase();
  const tips: PronunciationTip[] = [];

  if (text.includes("project")) {
    tips.push({
      wordOrPhrase: "project",
      issueZh: "名词 project 的重音容易后移。",
      tipZh: "作为名词时重音放前面：PRO-ject，第二拍轻读。",
      example: "My PRO-ject improved route planning."
    });
  }

  if (text.includes("model")) {
    tips.push({
      wordOrPhrase: "model and the UI",
      issueZh: "model 后接 and the UI 时容易吞掉 and。",
      tipZh: "and 可以弱读，但要保留轻微鼻音，让关键词边界清楚。",
      example: "I improved the model and the UI."
    });
  }

  if (text.includes("maybe") || text.includes("things")) {
    tips.push({
      wordOrPhrase: "maybe / things",
      issueZh: "不确定词过多会让回答听起来犹豫。",
      tipZh: "把 maybe 放慢或直接替换为更确定的表达，句尾语调下落。",
      example: "I improved the prompt flow and reduced repeated answers."
    });
  }

  if (!tips.length) {
    tips.push({
      wordOrPhrase: "result sentence",
      issueZh: "结果句需要更稳定的节奏。",
      tipZh: "先说结果，再说数字，数字前稍停顿，句尾自然下落。",
      example: "It reduced planning time by 30%."
    });
  }

  return tips;
}

function createFallbackNextPractice(report: ReportResult, targetGoal: string): NextPractice {
  const candidate = report.suggestions.find((suggestion) => /[a-z]/i.test(suggestion));
  const targetSentence =
    candidate || "My project improved route planning by 30% by making the model responses clearer.";

  return {
    goalZh: targetGoal || "用更具体的一句话说明本次练习目标。",
    targetSentence,
    chunks: splitSentenceIntoChunks(targetSentence),
    drills: [
      "先逐块慢读，每块之间停半秒。",
      "第二遍把结果数字或关键词读重一点。",
      "第三遍连成一句，句尾语调下落。"
    ]
  };
}

function splitSentenceIntoChunks(sentence: string): string[] {
  const chunks = sentence
    .replace(/\s+(by|because|and|that|with)\s+/gi, "|$1 ")
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.length > 1 ? chunks : [sentence, "再补一个具体数字或用户影响。"];
}
