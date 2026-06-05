import { describe, expect, it } from "vitest";
import {
  addLearningRecord,
  createLearningRecord,
  summarizeLearning,
  type LearningRecord
} from "../src/domain/learning";
import type { ReportResult } from "../shared/schemas";

const report: ReportResult = {
  reportId: "report_1",
  totalScore: 86,
  dimensions: [
    { id: "pronunciation", labelZh: "发音清晰度", labelEn: "Pronunciation", score: 82, explanationZh: "" },
    { id: "fluency", labelZh: "流利度", labelEn: "Fluency", score: 88, explanationZh: "" },
    { id: "grammar", labelZh: "语法准确度", labelEn: "Grammar", score: 80, explanationZh: "" },
    { id: "vocabulary", labelZh: "词汇丰富度", labelEn: "Vocabulary", score: 84, explanationZh: "" },
    { id: "coherence", labelZh: "表达连贯性", labelEn: "Coherence", score: 85, explanationZh: "" },
    { id: "task_completion", labelZh: "任务完成度", labelEn: "Task Completion", score: 90, explanationZh: "" },
    { id: "interaction", labelZh: "互动回应", labelEn: "Interaction", score: 87, explanationZh: "" }
  ],
  summaryZh: "回答清楚。",
  corrections: [{ original: "I build app.", improved: "I built an app.", explanationZh: "使用过去式。" }],
  suggestions: ["下一轮补一个数字。"],
  coachCommentZh: "继续补具体结果。",
  provider: "mock"
};

describe("learning progress tracking", () => {
  it("creates a learning record from a report", () => {
    const record = createLearningRecord({
      date: "2026-06-05",
      scenarioNameZh: "面试",
      scenarioNameEn: "Interview",
      taskTitleZh: "实习面试自我介绍",
      focus: "把项目结果说清楚",
      roundCount: 4,
      report
    });

    expect(record.score).toBe(86);
    expect(record.correctionCount).toBe(1);
    expect(record.nextGoal).toContain("数字");
  });

  it("keeps newest records first and summarizes current growth", () => {
    const older: LearningRecord = {
      reportId: "report_old",
      date: "2026-06-04",
      scenarioNameZh: "点餐",
      scenarioNameEn: "Restaurant",
      taskTitleZh: "带偏好的点餐",
      focus: "表达偏好",
      score: 74,
      roundCount: 3,
      correctionCount: 2,
      suggestionCount: 2,
      nextGoal: "先说明限制。",
      dimensions: [
        { id: "grammar", labelZh: "语法准确度", score: 74 },
        { id: "task_completion", labelZh: "任务完成度", score: 80 }
      ]
    };
    const newest = createLearningRecord({
      date: "2026-06-05",
      scenarioNameZh: "面试",
      scenarioNameEn: "Interview",
      taskTitleZh: "实习面试自我介绍",
      focus: "把项目结果说清楚",
      roundCount: 4,
      report
    });

    const state = addLearningRecord(addLearningRecord({ records: [] }, older), newest);
    const summary = summarizeLearning(state);

    expect(state.records[0].reportId).toBe("report_1");
    expect(summary.totalSessions).toBe(2);
    expect(summary.averageScore).toBe(80);
    expect(summary.strongestDimension).toBe("任务完成度");
    expect(summary.priorityDimension).toBe("语法准确度");
  });
});
