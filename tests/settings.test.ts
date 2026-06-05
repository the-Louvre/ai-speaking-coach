import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";

describe("runtime API settings", () => {
  it("updates provider configuration without exposing submitted secret values", async () => {
    const app = createApp({ apiMode: "mock" });

    const update = await request(app)
      .post("/api/settings")
      .send({
        apiMode: "live",
        deepgramApiKey: "dg_test_secret",
        openaiApiKey: "sk-test-secret",
        openaiModel: "gpt-4o-mini",
        cartesiaApiKey: "cartesia_test_secret",
        cartesiaVoiceId: "voice_test",
        cartesiaModel: "sonic-latest",
        cartesiaVersion: "2026-03-01"
      })
      .expect(200);

    expect(update.body.mode).toBe("live");
    expect(update.text).not.toContain("dg_test_secret");
    expect(update.text).not.toContain("sk-test-secret");
    expect(update.text).not.toContain("cartesia_test_secret");

    const health = await request(app).get("/api/health").expect(200);

    expect(health.body.mode).toBe("live");
    expect(health.body.providers.deepgram.configured).toBe(true);
    expect(health.body.providers.openai.configured).toBe(true);
    expect(health.body.providers.cartesia.configured).toBe(true);
    expect(health.text).not.toContain("sk-test-secret");
  });

  it("keeps existing runtime secrets when update fields are blank", async () => {
    const app = createApp({ apiMode: "mock" });

    await request(app)
      .post("/api/settings")
      .send({ apiMode: "live", openaiApiKey: "sk-existing-secret" })
      .expect(200);

    const update = await request(app)
      .post("/api/settings")
      .send({ apiMode: "mock", openaiApiKey: "", openaiModel: "gpt-4o-mini" })
      .expect(200);

    expect(update.body.providers.openai.configured).toBe(true);
    expect(update.text).not.toContain("sk-existing-secret");
  });
});
