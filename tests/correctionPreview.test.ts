import { describe, expect, it } from "vitest";
import { createCorrectionPreview } from "../server/providers/correctionPreview";

describe("turn correction previews", () => {
  it("does not reuse the campus navigation template when the learner talked about something else", () => {
    const preview = createCorrectionPreview({
      userText: "This is my project, and I'm very proud of it.",
      round: 1
    });

    expect(preview).toContain("建议");
    expect(preview).not.toContain("campus navigation");
    expect(preview).toContain("项目");
  });

  it("converts an English-only model preview into a Chinese-first coaching note", () => {
    const preview = createCorrectionPreview({
      userText:
        "The ability of our product, I helped it improve efficiency by 20% and reduced processing time from 10 minutes to 3 minutes.",
      round: 3,
      rawPreview:
        "A clearer version is: I helped improve our product's efficiency by 20%, reduced processing time from 10 minutes to 3 minutes, and enabled the team to handle 1,000 more users per day."
    });

    expect(preview).toMatch(/^建议/);
    expect(preview).toContain("保留数字");
    expect(preview).toContain("I improved");
    expect(preview).not.toMatch(/^A clearer version is/);
  });
});
