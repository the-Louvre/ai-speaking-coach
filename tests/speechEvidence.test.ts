import { describe, expect, it } from "vitest";
import { deriveSpeechEvidence } from "../server/providers/speechEvidence";

describe("speech evidence derivation", () => {
  it("derives speech rate, low-confidence words, pauses, and coaching notes from ASR words", () => {
    const evidence = deriveSpeechEvidence({
      text: "I built a campus navigation project.",
      confidence: 0.86,
      durationSec: 4.8,
      provider: "deepgram",
      words: [
        { word: "I", start: 0, end: 0.18, confidence: 0.96 },
        { word: "built", start: 0.22, end: 0.52, confidence: 0.94 },
        { word: "a", start: 0.56, end: 0.68, confidence: 0.91 },
        { word: "campus", start: 1.48, end: 1.92, confidence: 0.72 },
        { word: "navigation", start: 1.98, end: 2.6, confidence: 0.68 },
        { word: "project", start: 2.72, end: 3.14, confidence: 0.9 }
      ]
    });

    expect(evidence.speechRateWpm).toBe(75);
    expect(evidence.lowConfidenceWords).toEqual([
      { word: "campus", start: 1.48, end: 1.92, confidence: 0.72 },
      { word: "navigation", start: 1.98, end: 2.6, confidence: 0.68 }
    ]);
    expect(evidence.pauseEvents).toEqual([
      {
        afterWord: "a",
        beforeWord: "campus",
        start: 0.68,
        end: 1.48,
        durationSec: 0.8
      }
    ]);
    expect(evidence.pronunciationNotes.join(" ")).toContain("campus, navigation");
    expect(evidence.pronunciationNotes.join(" ")).toContain("语速偏慢");
    expect(evidence.pronunciationNotes.join(" ")).toContain("1 处明显停顿");
  });
});
