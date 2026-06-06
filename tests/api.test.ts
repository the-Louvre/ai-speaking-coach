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

    expect(response.body.sessionId).toMatch(/^practice_session_/);
    expect(response.body.session.status).toBe("running");
    expect(response.body.session.duration).toBe(5 * 60);
    expect(response.body.remainingSeconds).toBe(5 * 60);
    expect(response.body).not.toHaveProperty("roundLimit");
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

  it("records Pipecat voice-agent turns into the active practice session", async () => {
    const started = await request(app)
      .post("/api/session/start")
      .send({ scenarioId: "interview", taskId: "internship-intro", durationMinutes: 7 })
      .expect(200);

    const userTurn = await request(app)
      .post(`/api/session/${started.body.sessionId}/turns`)
      .send({
        speaker: "user",
        text: "It is about my AI agent project.",
        timestamp: "2026-06-06T04:10:00.000Z",
        latencyMs: 820
      })
      .expect(200);

    expect(userTurn.body.turn).toMatchObject({
      speaker: "user",
      text: "It is about my AI agent project.",
      latencyMs: 820
    });
    expect(userTurn.body.session.conversation_turns).toHaveLength(2);

    const aiTurn = await request(app)
      .post(`/api/session/${started.body.sessionId}/turns`)
      .send({
        speaker: "ai",
        text: "Do you mean an AI agent project? What problem did it solve?",
        timestamp: "2026-06-06T04:10:02.000Z"
      })
      .expect(200);

    expect(aiTurn.body.session.conversation_turns.map((turn: { speaker: string }) => turn.speaker)).toEqual([
      "ai",
      "user",
      "ai"
    ]);
  });

  it("rejects Pipecat turn writes for missing sessions", async () => {
    const response = await request(app)
      .post("/api/session/practice_session_missing/turns")
      .send({ speaker: "user", text: "hello" })
      .expect(404);

    expect(response.body.error).toContain("practice_session");
  });

  it("marks a practice session ended before generating the final report", async () => {
    const started = await request(app)
      .post("/api/session/start")
      .send({ scenarioId: "interview", taskId: "internship-intro", durationMinutes: 5 })
      .expect(200);

    const ended = await request(app).post(`/api/session/${started.body.sessionId}/end`).expect(200);

    expect(ended.body.session.status).toBe("completed");
    expect(ended.body.session.end_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ended.body.session.final_report).toBeNull();
  });

  it("transcribes uploaded audio into the shared transcript shape", async () => {
    const response = await request(app)
      .post("/api/asr/transcribe")
      .attach("audio", Buffer.from("mock audio"), "answer.webm")
      .expect(200);

    expect(response.body.text).toContain("project");
    expect(response.body.confidence).toBeGreaterThan(0);
    expect(response.body.words[0]).toHaveProperty("confidence");
  });

  it("returns a next AI turn and synthesized mock speech", async () => {
    const turn = await request(app)
      .post("/api/llm/turn")
      .send({
        sessionId: "session_test",
        scenarioId: "interview",
        taskId: "internship-intro",
        round: 1,
        userText: "I built a campus navigation app and improved the route flow."
      })
      .expect(200);

    expect(turn.body.aiText).toContain("result");
    expect(turn.body.hintZh).toContain("具体");
    expect(typeof turn.body.positiveFeedback).toBe("string");
    expect(turn.body.positiveFeedback.length).toBeGreaterThan(0);

    const speech = await request(app)
      .post("/api/tts/synthesize")
      .send({ text: turn.body.aiText })
      .expect(200);

    expect(speech.body.format).toBe("mock");
    expect(speech.body.audioBase64).toBeTruthy();
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
            transcriptConfidence: 0.91
          }
        ]
      })
      .expect(200);

    const parsed = reportResultSchema.parse(response.body);
    expect(parsed.totalScore).toBeGreaterThanOrEqual(70);
    expect(parsed.dimensions.map((dimension) => dimension.id)).toEqual([
      "fluency",
      "pronunciation",
      "grammar",
      "vocabulary",
      "coherence",
      "task_completion",
      "interaction"
    ]);
    expect(parsed.corrections[0].explanationZh).toContain("时态");
    expect(parsed.sentenceAnalyses?.[0].highlights[0].reasonZh).toBeTruthy();
    expect(parsed.pronunciationTips?.[0].wordOrPhrase).toBeTruthy();
    expect(parsed.evidenceTurns?.[0].speaker).toBe("user");
    expect(parsed.nextPractice?.targetSentence).toContain("project");
  });
});
