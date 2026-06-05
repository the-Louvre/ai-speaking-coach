import { describe, expect, it } from "vitest";
import { dialogueTurnResultSchema } from "../shared/schemas";

describe("dialogueTurnResultSchema", () => {
  it("requires a positiveFeedback string", () => {
    const base = {
      aiText: "What result did it create?",
      hintZh: "先说结果，再补数字。",
      coachState: "asking",
      correctionPreview: "基本清楚。",
      nextRoundGoal: "补一个数字。",
      provider: "mock"
    };

    expect(() => dialogueTurnResultSchema.parse(base)).toThrow();
    const ok = dialogueTurnResultSchema.parse({ ...base, positiveFeedback: "你已经说清楚项目主题了。" });
    expect(ok.positiveFeedback).toBe("你已经说清楚项目主题了。");
  });
});
