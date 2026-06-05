import { describe, expect, it } from "vitest";
import { reportJsonSchema } from "../server/providers/reportSchema";

describe("OpenAI report JSON schema", () => {
  it("requires the same top-level fields as the public report result", () => {
    expect(reportJsonSchema.additionalProperties).toBe(false);
    expect(reportJsonSchema.required).toEqual([
      "reportId",
      "totalScore",
      "dimensions",
      "summaryZh",
      "corrections",
      "suggestions",
      "dimensionEvidence",
      "coachCommentZh",
      "provider"
    ]);
  });

  it("requires score dimension fields so live reports stay renderable", () => {
    const dimensions = reportJsonSchema.properties.dimensions;

    expect(dimensions.items.required).toEqual([
      "id",
      "labelZh",
      "labelEn",
      "score",
      "explanationZh"
    ]);
  });

  it("requires dimension evidence so live reports explain why each score changed", () => {
    const evidence = reportJsonSchema.properties.dimensionEvidence;

    expect(evidence.items.required).toEqual(["dimensionId", "evidenceZh", "turnRefs"]);
  });
});
