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
import { findScenarioTask, scenarios } from "./data";
import {
  generateReportWithOpenAI,
  generateTurnWithOpenAI,
  synthesizeWithCartesia,
  transcribeWithDeepgram
} from "./providers/liveProviders";
import { mockStartSession } from "./providers/mockProviders";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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
    const { scenario, task } = findScenarioTask(scenarioId, taskId);
    res.json({
      ...mockStartSession(scenario.id, task.id),
      scenario,
      task
    });
  });

  app.post("/api/asr/transcribe", upload.single("audio"), async (req, res) => {
    const result = await transcribeWithDeepgram(req.file, config);
    res.json(result);
  });

  app.post("/api/llm/turn", async (req, res) => {
    const result = await generateTurnWithOpenAI(
      {
        scenarioId: String(req.body?.scenarioId || "interview"),
        taskId: String(req.body?.taskId || "internship-intro"),
        round: Number(req.body?.round || 1),
        userText: String(req.body?.userText || "")
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
    const result = await generateReportWithOpenAI(req.body, config);
    res.json(result);
  });

  return app;
}
