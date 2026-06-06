import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
}

describe("homepage Just. say it copy", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createLocalStorageMock()
    });
  });

  it("renders the approved teacher-led mission card and gamified streak copy", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("YOUR TEACHER IS LISTENING");
    expect(markup).toContain("Just");
    expect(markup).toContain("say it");
    expect(markup).toContain("不用先想完美答案。");
    expect(markup).toContain("你先开口，我先听完，再帮你改。");
    expect(markup).toContain("Say it");
    expect(markup).toContain("火花燃烧中");
    expect(markup).toContain("你真的忍心吗，已经三天的火花了");
    expect(markup).toContain("冻结保护");
    expect(markup).toContain("成长轨迹");
    expect(markup).toContain("68 → 72 → 76");
    expect(markup).toContain("查看成长轨迹");
  });
});
