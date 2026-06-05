import { z } from "zod";

export const coachStateSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "asking",
  "reviewing",
  "celebrating"
]);

export const transcriptWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
  punctuatedWord: z.string().optional()
});

export const lowConfidenceWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
  punctuatedWord: z.string().optional()
});

export const pauseEventSchema = z.object({
  afterWord: z.string(),
  beforeWord: z.string(),
  start: z.number(),
  end: z.number(),
  durationSec: z.number()
});

export const transcriptResultSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  words: z.array(transcriptWordSchema),
  durationSec: z.number(),
  providerLatencyMs: z.number(),
  provider: z.string(),
  speechRateWpm: z.number(),
  lowConfidenceWords: z.array(lowConfidenceWordSchema),
  pauseEvents: z.array(pauseEventSchema),
  pronunciationNotes: z.array(z.string()),
  fallback: z.boolean().optional(),
  fallbackReason: z.string().optional()
});

export const dialogueTurnResultSchema = z.object({
  aiText: z.string(),
  hintZh: z.string(),
  coachState: coachStateSchema,
  correctionPreview: z.string(),
  nextRoundGoal: z.string(),
  provider: z.string(),
  fallback: z.boolean().optional()
});

export const speechAudioResultSchema = z.object({
  audioBase64: z.string().nullable(),
  audioUrl: z.string().nullable(),
  format: z.string(),
  durationEstimateSec: z.number(),
  provider: z.string(),
  fallback: z.boolean().optional()
});

export const scoreDimensionIdSchema = z.enum([
  "pronunciation",
  "fluency",
  "grammar",
  "expression",
  "taskCompletion"
]);

export const scoreDimensionSchema = z.object({
  id: scoreDimensionIdSchema,
  labelZh: z.string(),
  labelEn: z.string(),
  score: z.number(),
  explanationZh: z.string()
});

export const correctionSchema = z.object({
  original: z.string(),
  improved: z.string(),
  explanationZh: z.string()
});

export const dimensionEvidenceSchema = z.object({
  dimensionId: scoreDimensionIdSchema,
  evidenceZh: z.string(),
  turnRefs: z.array(z.number())
});

export const reportResultSchema = z.object({
  reportId: z.string(),
  totalScore: z.number(),
  dimensions: z.array(scoreDimensionSchema),
  summaryZh: z.string(),
  corrections: z.array(correctionSchema),
  suggestions: z.array(z.string()),
  dimensionEvidence: z.array(dimensionEvidenceSchema),
  coachCommentZh: z.string(),
  provider: z.string(),
  fallback: z.boolean().optional()
});

export type CoachState = z.infer<typeof coachStateSchema>;
export type TranscriptResult = z.infer<typeof transcriptResultSchema>;
export type DialogueTurnResult = z.infer<typeof dialogueTurnResultSchema>;
export type SpeechAudioResult = z.infer<typeof speechAudioResultSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;
export type ScoreDimensionId = z.infer<typeof scoreDimensionIdSchema>;
