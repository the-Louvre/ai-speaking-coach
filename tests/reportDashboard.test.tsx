import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConversationTurn, ReportResult } from "../shared/schemas";
import type { Scenario } from "../server/data";
import { ReportDashboard } from "../src/components/ReportDashboard";

const scenario: Scenario = {
  id: "interview",
  nameZh: "面试",
  nameEn: "Interview",
  descriptionZh: "练习项目经历和追问回应。",
  tasks: []
};

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
  suggestions: ["下一轮补一个数字。"],
  coachCommentZh: "语法还算稳，但表达太泛。下一轮加一个具体数字。",
  provider: "mock"
};

const turns: ConversationTurn[] = [
  {
    id: "turn_1",
    speaker: "user",
    text: "My role is about to improve the model and the UI style.",
    timestamp: "2026-06-06T12:00:00.000Z"
  }
];

describe("ReportDashboard", () => {
  it("renders the accepted one-screen report structure", () => {
    const markup = renderToStaticMarkup(
      <ReportDashboard
        report={report}
        conversationTurns={turns}
        scenario={scenario}
        targetGoal="把项目结果说清楚"
        onChangeTask={vi.fn()}
        onPracticeAgain={vi.fn()}
      />
    );

    expect(markup).toContain("one-report");
    expect(markup).toContain("能力诊断");
    expect(markup).toContain("对话纠错");
    expect(markup).toContain("提升指导");
    expect(markup).toContain("表达优化");
    expect(markup).toContain("发音技巧");
    expect(markup).toContain("推荐重练句");
    expect(markup).toContain("查看完整对话");
  });
});
