import { describe, expect, it } from "vitest";
import type { ConversationTurn, ReportResult } from "../shared/schemas";
import { createReportDiagnostics } from "../src/reportDiagnostics";

const report: ReportResult = {
  reportId: "report_test",
  totalScore: 84,
  dimensions: [
    { id: "fluency", labelZh: "流利度", labelEn: "Fluency", score: 85, explanationZh: "" },
    { id: "pronunciation", labelZh: "发音清晰度", labelEn: "Pronunciation", score: 82, explanationZh: "" },
    { id: "grammar", labelZh: "语法准确度", labelEn: "Grammar", score: 80, explanationZh: "" },
    { id: "vocabulary", labelZh: "词汇表达", labelEn: "Vocabulary", score: 84, explanationZh: "" },
    { id: "coherence", labelZh: "连贯性", labelEn: "Coherence", score: 83, explanationZh: "" },
    { id: "task_completion", labelZh: "任务完成度", labelEn: "Task Completion", score: 88, explanationZh: "" },
    { id: "interaction", labelZh: "互动回应", labelEn: "Interaction", score: 81, explanationZh: "" }
  ],
  summaryZh: "整体清楚。",
  corrections: [
    {
      original: "I built campus navigation app.",
      improved: "I built a campus navigation app.",
      explanationZh: "需要补冠词 a。"
    }
  ],
  suggestions: ["My project improved the route planning result by 30%."],
  coachCommentZh: "表达还可以更具体。",
  provider: "mock"
};

const turns: ConversationTurn[] = [
  {
    id: "turn_1",
    speaker: "user",
    text: "My role is about to improve the model and the UI style.",
    timestamp: "2026-06-06T12:00:00.000Z"
  },
  {
    id: "turn_2",
    speaker: "user",
    text: "Maybe the word or other things.",
    timestamp: "2026-06-06T12:01:00.000Z"
  }
];

describe("createReportDiagnostics", () => {
  it("derives strongest and weakest dimensions", () => {
    const diagnostics = createReportDiagnostics(report, turns, "把项目结果说清楚");

    expect(diagnostics.strongestDimension?.id).toBe("task_completion");
    expect(diagnostics.weakestDimension?.id).toBe("grammar");
  });

  it("falls back to user turns and correction data when rich fields are missing", () => {
    const diagnostics = createReportDiagnostics(report, turns, "把项目结果说清楚");

    expect(diagnostics.evidenceTurns).toHaveLength(2);
    expect(diagnostics.primaryAnalysis?.highlights[0].reasonZh).toContain("冠词");
    expect(diagnostics.pronunciationTips.some((tip) => tip.wordOrPhrase.includes("model"))).toBe(true);
    expect(diagnostics.nextPractice.chunks.length).toBeGreaterThan(1);
  });
});
