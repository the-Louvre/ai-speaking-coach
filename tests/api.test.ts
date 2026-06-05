import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { reportResultSchema } from "../shared/schemas";

describe("local API in mock mode", () => {
  const app = createApp({ apiMode: "mock" });

  it("reports provider health without leaking secret values", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body.mode).toBe("mock");
    expect(response.text).not.toContain("sk-");
    expect(response.text).not.toContain("DEEPGRAM_API_KEY=");
    expect(response.body.providers.llm.active).toBe(false);
    expect(response.body.providers.openai.active).toBe(false);
    expect(response.body.providers.deepgram.active).toBe(false);
    expect(response.body.providers.cartesia.active).toBe(false);
  });

  it("starts a practice session with a structured first question", async () => {
    const response = await request(app)
      .post("/api/session/start")
      .send({ scenarioId: "interview", taskId: "internship-intro" })
      .expect(200);

    expect(response.body.sessionId).toMatch(/^session_/);
    expect(response.body.aiText).toContain("Tell me");
    expect(response.body.coachState).toBe("asking");
  });

  it("starts a practice session from a custom scenario", async () => {
    const response = await request(app)
      .post("/api/session/start")
      .send({
        scenarioId: "custom-demo",
        taskId: "custom-task",
        customScenario: {
          id: "custom-demo",
          nameZh: "校园项目答辩",
          nameEn: "Custom",
          descriptionZh: "自定义答辩场景",
          tasks: [
            {
              id: "custom-task",
              titleZh: "解释项目价值",
              titleEn: "Custom practice",
              aiRoleZh: "AI 答辩老师",
              focus: "先说结论，再补数字",
              openingQuestion: "Could you explain the value of your project in one minute?"
            }
          ]
        }
      })
      .expect(200);

    expect(response.body.scenario.nameZh).toBe("校园项目答辩");
    expect(response.body.task.focus).toContain("数字");
    expect(response.body.aiText).toContain("explain the value");
  });

  it("transcribes uploaded audio into the shared transcript shape", async () => {
    const response = await request(app)
      .post("/api/asr/transcribe")
      .attach("audio", Buffer.from("mock audio"), "answer.webm")
      .expect(200);

    expect(response.body.text).toContain("project");
    expect(response.body.confidence).toBeGreaterThan(0);
    expect(response.body.words[0]).toHaveProperty("confidence");
    expect(response.body.speechRateWpm).toBeGreaterThan(0);
    expect(response.body.lowConfidenceWords[0]).toMatchObject({ word: "navigation" });
    expect(response.body.pronunciationNotes.join(" ")).toContain("规则估算");
  });

  it("returns a next AI turn and synthesized mock speech", async () => {
    const turn = await request(app)
      .post("/api/llm/turn")
      .send({
        sessionId: "session_test",
        scenarioId: "interview",
        taskId: "internship-intro",
        round: 1,
        userText: "This is my project, and I'm very proud of it."
      })
      .expect(200);

    expect(turn.body.aiText).toContain("result");
    expect(turn.body.hintZh).toContain("具体");
    expect(turn.body.correctionPreview).toContain("建议");
    expect(turn.body.correctionPreview).not.toContain("campus navigation");

    const speech = await request(app)
      .post("/api/tts/synthesize")
      .send({ text: turn.body.aiText })
      .expect(200);

    expect(speech.body.format).toBe("mock");
    expect(speech.body.audioBase64).toBeTruthy();
  });

  it("advances follow-up questions across repeated mock turns", async () => {
    const first = await request(app)
      .post("/api/llm/turn")
      .send({
        sessionId: "session_test",
        scenarioId: "interview",
        taskId: "internship-intro",
        round: 1,
        currentAiText: "Tell me about one project you are proud of.",
        userText: "I built a campus navigation app and improved the route flow."
      })
      .expect(200);

    const second = await request(app)
      .post("/api/llm/turn")
      .send({
        sessionId: "session_test",
        scenarioId: "interview",
        taskId: "internship-intro",
        round: 2,
        currentAiText: first.body.aiText,
        userText: "It improved planning speed by 20 percent for students.",
        turns: [
          {
            round: 1,
            aiText: "Tell me about one project you are proud of.",
            userText: "I built a campus navigation app and improved the route flow."
          }
        ]
      })
      .expect(200);

    expect(second.body.aiText).not.toBe(first.body.aiText);
    expect(second.body.aiText).toContain("example");
  });

  it("generates a report that matches the public schema", async () => {
    const response = await request(app)
      .post("/api/report/generate")
      .send({
        sessionId: "session_test",
        scenarioId: "interview",
        taskId: "internship-intro",
        turns: [
          {
            round: 1,
            aiText: "Tell me about a project you are proud of.",
            userText: "I built campus navigation app. It make route clear.",
            transcriptConfidence: 0.91,
            speechRateWpm: 118,
            lowConfidenceWords: [{ word: "navigation", start: 0.9, end: 1.4, confidence: 0.72 }],
            pauseEvents: [{ afterWord: "campus", beforeWord: "navigation", start: 0.8, end: 1.5, durationSec: 0.7 }],
            pronunciationNotes: ["低置信词：navigation。", "规则估算：语速稳定。"]
          }
        ]
      })
      .expect(200);

    const parsed = reportResultSchema.parse(response.body);
    expect(parsed.totalScore).toBeGreaterThanOrEqual(70);
    expect(parsed.dimensions).toHaveLength(5);
    expect(parsed.dimensionEvidence.find((item) => item.dimensionId === "pronunciation")?.evidenceZh).toContain(
      "navigation"
    );
    expect(parsed.dimensionEvidence.find((item) => item.dimensionId === "fluency")?.turnRefs).toContain(1);
    expect(parsed.corrections[0].explanationZh).toContain("时态");
  });
});
