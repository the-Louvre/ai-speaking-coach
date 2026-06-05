import { describe, expect, it } from "vitest";
import { scenarios } from "../server/data";

describe("scenario task coaching metadata", () => {
  it("gives every built-in task enough rubric and round guidance for coached practice", () => {
    const tasks = scenarios.flatMap((scenario) => scenario.tasks);

    expect(tasks).toHaveLength(9);
    for (const task of tasks) {
      expect(task.difficulty).toMatch(/^(A2|B1|B2)$/);
      expect(task.roundGoals).toHaveLength(5);
      expect(task.sampleAnswers.length).toBeGreaterThanOrEqual(2);
      expect(task.commonMistakes.length).toBeGreaterThanOrEqual(2);
      expect(task.rubric.map((item) => item.dimension)).toEqual([
        "pronunciation",
        "fluency",
        "grammar",
        "expression",
        "taskCompletion"
      ]);
    }
  });
});
