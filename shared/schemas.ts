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

export const transcriptResultSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  words: z.array(transcriptWordSchema),
  durationSec: z.number(),
  providerLatencyMs: z.number(),
  provider: z.string(),
  fallback: z.boolean().optional(),
  fallbackReason: z.string().optional()
});

export const dialogueTurnResultSchema = z.object({
  aiText: z.string(),
  hintZh: z.string(),
  coachState: coachStateSchema,
  positiveFeedback: z.string(),
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

export const scoreDimensionSchema = z.object({
  id: z.enum([
    "fluency",
    "pronunciation",
    "grammar",
    "vocabulary",
    "coherence",
    "task_completion",
    "interaction"
  ]),
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

export const reportResultSchema = z.object({
  reportId: z.string(),
  totalScore: z.number(),
  dimensions: z.array(scoreDimensionSchema),
  summaryZh: z.string(),
  corrections: z.array(correctionSchema),
  suggestions: z.array(z.string()),
  coachCommentZh: z.string(),
  provider: z.string(),
  fallback: z.boolean().optional()
});

export const conversationTurnSchema = z.object({
  id: z.string(),
  speaker: z.enum(["ai", "user", "system"]),
  text: z.string(),
  timestamp: z.string(),
  transcriptConfidence: z.number().optional(),
  audioDurationSec: z.number().optional(),
  latencyMs: z.number().optional(),
  hintZh: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

export const practiceSessionStatusSchema = z.enum(["running", "paused", "completed", "expired", "cancelled"]);

export const practiceSessionSchema = z.object({
  id: z.string(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  duration: z.number(),
  status: practiceSessionStatusSchema,
  scenario_id: z.string(),
  scenario_label: z.string(),
  target_goal: z.string(),
  conversation_turns: z.array(conversationTurnSchema),
  final_report: reportResultSchema.nullable()
});

export type CoachState = z.infer<typeof coachStateSchema>;
export type TranscriptResult = z.infer<typeof transcriptResultSchema>;
export type DialogueTurnResult = z.infer<typeof dialogueTurnResultSchema>;
export type SpeechAudioResult = z.infer<typeof speechAudioResultSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export type PracticeSession = z.infer<typeof practiceSessionSchema>;
export type PracticeSessionStatus = z.infer<typeof practiceSessionStatusSchema>;
