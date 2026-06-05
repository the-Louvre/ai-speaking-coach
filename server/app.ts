import cors from "cors";
import express from "express";
import multer from "multer";
import {
  applyRuntimeSettings,
  getConfig,
  getHealth,
  getRuntimeSettings,
  type AppOptions,
  type RuntimeSettingsInput
} from "./config";
import { createTaskMetadata, findScenarioTask, scenarios, type Scenario } from "./data";
import {
  generateReportWithLlm,
  generateTurnWithLlm,
  synthesizeWithCartesia,
  transcribeWithConfiguredProvider
} from "./providers/liveProviders";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function normalizeCustomScenario(value: unknown): Scenario | null {
  if (!value || typeof value !== "object") return null;
  const scenario = value as Partial<Scenario>;
  const task = scenario.tasks?.[0];
  if (!scenario.nameZh || !scenario.descriptionZh || !task?.titleZh || !task.openingQuestion) return null;

  return {
    id: scenario.id || `custom_${Date.now()}`,
    nameZh: scenario.nameZh,
    nameEn: scenario.nameEn || "Custom",
    descriptionZh: scenario.descriptionZh,
    tasks: [
      {
        id: task.id || "custom-task",
        titleZh: task.titleZh,
        titleEn: task.titleEn || "Custom practice",
        aiRoleZh: task.aiRoleZh || "AI 场景教练",
        focus: task.focus || "把目标说清楚",
        openingQuestion: task.openingQuestion,
        ...createTaskMetadata({
          focus: task.focus || "把目标说清楚",
          difficulty: task.difficulty,
          roundGoals: task.roundGoals,
          sampleAnswers: task.sampleAnswers,
          commonMistakes: task.commonMistakes
        })
      }
    ]
  };
}

function normalizeTurns(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const item = turn as Record<string, unknown>;
      return {
        round: Number(item.round || 0),
        aiText: String(item.aiText || ""),
        userText: String(item.userText || "")
      };
    })
    .filter((turn): turn is { round: number; aiText: string; userText: string } =>
      Boolean(turn?.round && turn.aiText.trim() && turn.userText.trim())
    );
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const config = getConfig(options);

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json(getHealth(config));
  });

  app.get("/api/settings", (_req, res) => {
    res.json(getRuntimeSettings(config));
  });

  app.post("/api/settings", (req, res) => {
    applyRuntimeSettings(config, req.body as RuntimeSettingsInput);
    res.json(getRuntimeSettings(config));
  });

  app.get("/api/scenarios", (_req, res) => {
    res.json({ scenarios });
  });

  app.post("/api/session/start", (req, res) => {
    const scenarioId = String(req.body?.scenarioId || "interview");
    const taskId = String(req.body?.taskId || "internship-intro");
    const customScenario = normalizeCustomScenario(req.body?.customScenario);
    const { scenario, task } = customScenario
      ? { scenario: customScenario, task: customScenario.tasks[0] }
      : findScenarioTask(scenarioId, taskId);
    res.json({
      sessionId: `session_${Date.now()}`,
      aiText: task.openingQuestion,
      hintZh: `这一轮重点：${task.focus}。先回答问题，再补一个具体例子。`,
      coachState: "asking",
      roundLimit: 5,
      scenario,
      task
    });
  });

  app.post("/api/asr/transcribe", upload.single("audio"), async (req, res) => {
    const result = await transcribeWithConfiguredProvider(req.file, config);
    res.json(result);
  });

  app.post("/api/llm/turn", async (req, res) => {
    const result = await generateTurnWithLlm(
      {
        scenarioId: String(req.body?.scenarioId || "interview"),
        taskId: String(req.body?.taskId || "internship-intro"),
        scenarioLabel: String(req.body?.scenarioLabel || ""),
        taskTitle: String(req.body?.taskTitle || ""),
        taskFocus: String(req.body?.taskFocus || ""),
        aiRoleZh: String(req.body?.aiRoleZh || ""),
        round: Number(req.body?.round || 1),
        currentAiText: String(req.body?.currentAiText || ""),
        userText: String(req.body?.userText || ""),
        turns: normalizeTurns(req.body?.turns)
      },
      config
    );
    res.json(result);
  });

  app.post("/api/tts/synthesize", async (req, res) => {
    const result = await synthesizeWithCartesia(String(req.body?.text || ""), config);
    res.json(result);
  });

  app.post("/api/report/generate", async (req, res) => {
    const result = await generateReportWithLlm(req.body, config);
    res.json(result);
  });

  return app;
}
