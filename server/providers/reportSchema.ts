export const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reportId",
    "totalScore",
    "dimensions",
    "summaryZh",
    "corrections",
    "suggestions",
    "dimensionEvidence",
    "coachCommentZh",
    "provider"
  ],
  properties: {
    reportId: { type: "string" },
    totalScore: { type: "number", minimum: 0, maximum: 100 },
    dimensions: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "labelZh", "labelEn", "score", "explanationZh"],
        properties: {
          id: {
            type: "string",
            enum: ["pronunciation", "fluency", "grammar", "expression", "taskCompletion"]
          },
          labelZh: { type: "string" },
          labelEn: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 100 },
          explanationZh: { type: "string" }
        }
      }
    },
    summaryZh: { type: "string" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "improved", "explanationZh"],
        properties: {
          original: { type: "string" },
          improved: { type: "string" },
          explanationZh: { type: "string" }
        }
      }
    },
    suggestions: {
      type: "array",
      items: { type: "string" }
    },
    dimensionEvidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimensionId", "evidenceZh", "turnRefs"],
        properties: {
          dimensionId: {
            type: "string",
            enum: ["pronunciation", "fluency", "grammar", "expression", "taskCompletion"]
          },
          evidenceZh: { type: "string" },
          turnRefs: {
            type: "array",
            items: { type: "number" }
          }
        }
      }
    },
    coachCommentZh: { type: "string" },
    provider: { type: "string" }
  }
} as const;
