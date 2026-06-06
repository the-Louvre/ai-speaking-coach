import { describe, expect, it } from "vitest";
import { shouldDetachBotAudioTrack } from "../src/pipecatVoiceClient";

function audioTrack(readyState: MediaStreamTrackState) {
  return {
    kind: "audio",
    readyState
  } as MediaStreamTrack;
}

describe("Pipecat bot audio track lifecycle", () => {
  it("keeps a live audio track attached while WebRTC is temporarily muted", () => {
    expect(shouldDetachBotAudioTrack(audioTrack("live"))).toBe(false);
  });

  it("detaches the audio track only when WebRTC ends it", () => {
    expect(shouldDetachBotAudioTrack(audioTrack("ended"))).toBe(true);
  });
});
