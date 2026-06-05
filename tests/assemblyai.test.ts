import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeWithConfiguredProvider, type LiveConfig } from "../server/providers/liveProviders";

const baseConfig: LiveConfig = {
  apiMode: "live",
  providerPreset: "custom",
  asrProvider: "assemblyai",
  asrApiKey: "assembly_test_secret",
  assemblyAiApiKey: "assembly_test_secret",
  llmProvider: "custom-openai-compatible",
  llmModel: "gpt-5.4-mini",
  openaiModel: "gpt-5.4-mini",
  ttsProvider: "mock",
  ttsVersion: "",
  ttsModel: "mock",
  cartesiaVersion: "",
  cartesiaModel: "mock",
  pronunciationProvider: "rule"
};

describe("AssemblyAI ASR provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads raw audio, submits a transcript job, and maps completed words", async () => {
    vi.stubEnv("ASSEMBLYAI_POLL_INTERVAL_MS", "1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ upload_url: "https://cdn.assemblyai.com/upload/test" }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "transcript_test", status: "queued" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "transcript_test",
            status: "completed",
            text: "Hello from AssemblyAI.",
            confidence: 0.93,
            audio_duration: 2.4,
            words: [
              { text: "Hello", start: 0, end: 420, confidence: 0.95 },
              { text: "from", start: 430, end: 700, confidence: 0.92 }
            ]
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeWithConfiguredProvider(
      {
        buffer: Buffer.from("audio"),
        mimetype: "audio/webm"
      } as Express.Multer.File,
      baseConfig
    );

    expect(result.provider).toBe("assemblyai");
    expect(result.text).toBe("Hello from AssemblyAI.");
    expect(result.words[0]).toMatchObject({ word: "Hello", start: 0, end: 0.42, confidence: 0.95 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.assemblyai.com/v2/upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "assembly_test_secret",
          "Content-Type": "application/octet-stream"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.assemblyai.com/v2/transcript",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "assembly_test_secret" })
      })
    );
  });
});
