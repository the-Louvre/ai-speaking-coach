import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MascotAvatar } from "../src/components/MascotAvatar";

describe("MascotAvatar layered coach", () => {
  it("renders the white-haired layered coach instead of the legacy green mascot", () => {
    const markup = renderToStaticMarkup(<MascotAvatar state="idle" size={240} />);

    expect(markup).toContain("layered-coach-avatar");
    expect(markup).toContain("hair-back");
    expect(markup).toContain("glasses");
    expect(markup).toContain("brow-left");
    expect(markup).not.toContain("#89E219");
  });

  it("exposes visible state layers for thinking and reviewing feedback", () => {
    const thinkingMarkup = renderToStaticMarkup(<MascotAvatar state="thinking" size={240} />);
    const reviewingMarkup = renderToStaticMarkup(<MascotAvatar state="reviewing" size={240} />);

    expect(thinkingMarkup).toContain("thinking-dots");
    expect(thinkingMarkup).toContain("layered-coach-thinking");
    expect(reviewingMarkup).toContain("correction-mark");
    expect(reviewingMarkup).toContain("layered-coach-reviewing");
  });
});
