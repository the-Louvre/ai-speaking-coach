import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { LiveConfig } from "./providers/liveProviders";
import { findScenarioTask, type Scenario } from "./data";
import { addConversationTurn, completePracticeSession, getRemainingSeconds, markSessionPaused, markSessionRunning } from "./practiceSession";
import { generateReportWithLlm, generateTurnWithLlm, synthesizeWithCartesia } from "./providers/liveProviders";
import { practiceSessionStore } from "./sessionStore";

type RealtimeClientEvent =
  | {
      type: "start";
      scenarioId?: string;
      taskId?: string;
      durationMinutes?: number;
      customScenario?: Scenario;
    }
  | { type: "user_utterance"; sessionId: string; text: string; transcriptConfidence?: number; audioDurationSec?: number }
  | { type: "silence"; sessionId: string }
  | { type: "pause"; sessionId: string }
  | { type: "resume"; sessionId: string }
  | { type: "end"; sessionId: string };

type RealtimeServerOptions = {
  config: LiveConfig;
};

const SILENCE_PROMPT_MS = 6000;

function send(socket: WebSocket, type: string, payload: Record<string, unknown>) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

function getScenarioTask(event: Extract<RealtimeClientEvent, { type: "start" }>) {
  if (event.customScenario?.tasks?.[0]) {
    return { scenario: event.customScenario, task: event.customScenario.tasks[0] };
  }
  return findScenarioTask(event.scenarioId || "interview", event.taskId || "internship-intro");
}

function keywordsForGoal(targetGoal: string) {
  if (/项目|结果|面试/.test(targetGoal)) {
    return ["background", "role", "technical solution", "measurable result", "challenge", "reflection"];
  }
  if (/点餐|偏好/.test(targetGoal)) {
    return ["preference", "recommendation", "allergy", "budget", "polite request"];
  }
  return ["opinion", "reason", "example", "clarification", "next step"];
}

async function replyToUser({
  socket,
  config,
  sessionId,
  userText,
  transcriptConfidence,
  audioDurationSec
}: {
  socket: WebSocket;
  config: LiveConfig;
  sessionId: string;
  userText: string;
  transcriptConfidence?: number;
  audioDurationSec?: number;
}) {
  const session = practiceSessionStore.get(sessionId);
  if (!session) {
    send(socket, "error", { message: "practice_session 不存在，请重新开始训练。" });
    return;
  }

  const userTurn = addConversationTurn(session, {
    speaker: "user",
    text: userText,
    timestamp: new Date().toISOString(),
    transcriptConfidence,
    audioDurationSec
  });
  send(socket, "transcript_final", { sessionId, turn: userTurn });
  send(socket, "status", { sessionId, status: "thinking", remainingSeconds: getRemainingSeconds(session) });

  const turnResult = await generateTurnWithLlm(
    {
      scenarioId: session.scenario_id,
      taskId: session.scenario_id,
      scenarioLabel: session.scenario_label,
      taskTitle: session.scenario_label,
      taskFocus: session.target_goal,
      aiRoleZh: "AI 口语面试官",
      round: Math.max(1, session.conversation_turns.filter((turn) => turn.speaker === "user").length),
      userText
    },
    config
  );
  const aiTurn = addConversationTurn(session, {
    speaker: "ai",
    text: turnResult.aiText,
    timestamp: new Date().toISOString(),
    hintZh: turnResult.hintZh,
    keywords: keywordsForGoal(session.target_goal)
  });
  const speech = await synthesizeWithCartesia(turnResult.aiText, config);
  send(socket, "ai_reply", {
    sessionId,
    turn: aiTurn,
    speech,
    hintZh: turnResult.hintZh,
    positiveFeedback: turnResult.positiveFeedback,
    correctionPreview: turnResult.correctionPreview,
    keywords: keywordsForGoal(session.target_goal),
    remainingSeconds: getRemainingSeconds(session)
  });
}

async function finishSession(socket: WebSocket, config: LiveConfig, sessionId: string, status: "completed" | "expired") {
  const session = practiceSessionStore.get(sessionId);
  if (!session) {
    send(socket, "error", { message: "practice_session 不存在，无法生成报告。" });
    return;
  }
  session.status = status;
  const report = await generateReportWithLlm(
    {
      sessionId,
      scenarioId: session.scenario_id,
      scenarioLabel: session.scenario_label,
      targetGoal: session.target_goal,
      conversation_turns: session.conversation_turns
    },
    config
  );
  completePracticeSession(session, report, new Date(), status);
  send(socket, "session_finished", { session, report });
}

export function attachRealtimeServer(server: Server, options: RealtimeServerOptions) {
  const wss = new WebSocketServer({ server, path: "/api/practice/ws" });

  wss.on("connection", (socket) => {
    let activeSessionId = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let durationTimer: ReturnType<typeof setTimeout> | null = null;

    function clearSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    function scheduleSilencePrompt() {
      clearSilenceTimer();
      silenceTimer = setTimeout(() => {
        if (!activeSessionId) return;
        void replyToUser({
          socket,
          config: options.config,
          sessionId: activeSessionId,
          userText: "I need a hint.",
          transcriptConfidence: 1
        });
      }, SILENCE_PROMPT_MS);
    }

    socket.on("message", (raw) => {
      void (async () => {
        const event = JSON.parse(String(raw)) as RealtimeClientEvent;
        if (event.type === "start") {
          const { scenario, task } = getScenarioTask(event);
          const session = practiceSessionStore.create({
            scenarioId: scenario.id,
            scenarioLabel: `${scenario.nameZh} / ${scenario.nameEn}`,
            targetGoal: task.focus,
            durationMinutes: event.durationMinutes,
            openingAiText: task.openingQuestion
          });
          activeSessionId = session.id;
          send(socket, "session_started", {
            session,
            aiText: task.openingQuestion,
            remainingSeconds: session.duration,
            keywords: keywordsForGoal(task.focus)
          });
          durationTimer = setTimeout(() => {
            void finishSession(socket, options.config, session.id, "expired");
          }, session.duration * 1000);
          scheduleSilencePrompt();
          return;
        }

        if (event.type === "pause") {
          const session = practiceSessionStore.get(event.sessionId);
          if (session) markSessionPaused(session);
          clearSilenceTimer();
          send(socket, "status", { sessionId: event.sessionId, status: "paused" });
          return;
        }

        if (event.type === "resume") {
          const session = practiceSessionStore.get(event.sessionId);
          if (session) markSessionRunning(session);
          send(socket, "status", { sessionId: event.sessionId, status: "listening" });
          scheduleSilencePrompt();
          return;
        }

        if (event.type === "user_utterance") {
          clearSilenceTimer();
          await replyToUser({
            socket,
            config: options.config,
            sessionId: event.sessionId,
            userText: event.text,
            transcriptConfidence: event.transcriptConfidence,
            audioDurationSec: event.audioDurationSec
          });
          scheduleSilencePrompt();
          return;
        }

        if (event.type === "silence") {
          clearSilenceTimer();
          await replyToUser({
            socket,
            config: options.config,
            sessionId: event.sessionId,
            userText: "I am not sure how to continue.",
            transcriptConfidence: 1
          });
          scheduleSilencePrompt();
          return;
        }

        if (event.type === "end") {
          clearSilenceTimer();
          if (durationTimer) clearTimeout(durationTimer);
          await finishSession(socket, options.config, event.sessionId, "completed");
        }
      })().catch((error) => {
        send(socket, "error", { message: error instanceof Error ? error.message : "实时对话服务异常" });
      });
    });

    socket.on("close", () => {
      clearSilenceTimer();
      if (durationTimer) clearTimeout(durationTimer);
    });
  });

  return wss;
}
