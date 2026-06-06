import {
  Award,
  BarChart3,
  CalendarDays,
  Headphones,
  PencilLine,
  Play,
  Route,
  Settings,
  Sparkles,
  Square,
  Target
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoachState, ConversationTurn, PracticeSession, ReportResult } from "../shared/schemas";
import type { Scenario } from "../server/data";
import { api, checkPipecatHealth, createPipecatOfferUrl, type HealthResult } from "./api";
import { ApiSettingsPanel } from "./components/ApiSettingsPanel";
import { BrandTopBar } from "./components/BrandGuidelines";
import { CoachAvatar } from "./components/CoachAvatar";
import { WeekDots } from "./components/WeekDots";
import { HOME_COPY, REPORT_COPY, VALUE_CARDS } from "./copy/coachCopy";
import { getShanghaiDate, type CheckinState } from "./domain/checkin";
import { GROWTH_MOCK } from "./domain/growthMock";
import {
  completeToday,
  loadCheckin,
  loadCustomScenarios,
  loadLearning,
  recordLearning,
  saveCustomScenario
} from "./storage";
import {
  createLearningRecord,
  summarizeLearning,
  type LearningState
} from "./domain/learning";
import { createPipecatVoiceClient, type PipecatVoiceClient, type PipecatVoiceTurn } from "./pipecatVoiceClient";
import {
  getPracticeExperienceCopy,
  mapPracticeStartError,
  practiceStatusLabel,
  type PracticeStatus
} from "./practiceExperience";

type Screen = "home" | "prep" | "practice" | "report";
type JourneyStatus = "done" | "active" | "waiting";
type JourneyStep = {
  label: string;
  detail: string;
  status: JourneyStatus;
};
type CustomScenarioForm = {
  sceneName: string;
  aiRole: string;
  taskTitle: string;
  focus: string;
  openingQuestion: string;
};

const fallbackScenarios: Scenario[] = [
  {
    id: "interview",
    nameZh: "面试",
    nameEn: "Interview",
    descriptionZh: "练习项目经历和面试追问。",
    tasks: [
      {
        id: "internship-intro",
        titleZh: "实习面试自我介绍",
        titleEn: "Internship introduction",
        aiRoleZh: "AI 面试官",
        focus: "把项目结果说清楚",
        openingQuestion: "Tell me about one project you are proud of."
      }
    ]
  }
];

const defaultCustomForm: CustomScenarioForm = {
  sceneName: "校园项目答辩",
  aiRole: "AI 答辩老师",
  taskTitle: "解释项目价值",
  focus: "先说结论，再补用户价值和一个数字",
  openingQuestion: "Could you explain the value of your project in one minute?"
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(fallbackScenarios);
  const [scenario, setScenario] = useState<Scenario>(fallbackScenarios[0]);
  const [task, setTask] = useState<Scenario["tasks"][number]>(fallbackScenarios[0].tasks[0]);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [practiceStatus, setPracticeStatus] = useState<PracticeStatus>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(5 * 60);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(5);
  const [coachState, setCoachState] = useState<CoachState>("idle");
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [latestAiText, setLatestAiText] = useState("");
  const [report, setReport] = useState<ReportResult | null>(null);
  const [checkin, setCheckin] = useState<CheckinState>(() => loadCheckin());
  const [learning, setLearning] = useState<LearningState>(() => loadLearning());
  const [customForm, setCustomForm] = useState<CustomScenarioForm>(defaultCustomForm);
  const [busy, setBusy] = useState("");
  const [startError, setStartError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voiceClientRef = useRef<PipecatVoiceClient | null>(null);
  const countdownRef = useRef<number | null>(null);
  const recordedTurnKeysRef = useRef(new Set<string>());

  const todayDone = checkin.completedDates.includes(getShanghaiDate());
  const learningSummary = useMemo(() => summarizeLearning(learning), [learning]);
  const latestLearningRecord = learning.records[0] ?? null;
  const userTurnCount = conversationTurns.filter((turn) => turn.speaker === "user").length;
  const practiceCopy = useMemo(
    () => getPracticeExperienceCopy({ status: practiceStatus, busy, error: startError }),
    [busy, practiceStatus, startError]
  );
  const journeySteps = useMemo(
    () =>
      createJourneySteps({
        screen,
        busy,
        turnCount: userTurnCount,
        hasReport: Boolean(report)
      }),
    [busy, report, screen, userTurnCount]
  );

  useEffect(() => {
    void api.health().then(setHealth).catch(() => null);
    void api
      .scenarios()
      .then((result) => {
        const mergedScenarios = [...result.scenarios, ...loadCustomScenarios()];
        setScenarios(mergedScenarios);
        setScenario(mergedScenarios[0]);
        setTask(mergedScenarios[0].tasks[0]);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);

  useEffect(() => {
    return () => {
      void voiceClientRef.current?.disconnect();
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
    };
  }, []);

  const coachLine = useMemo(() => {
    if (screen === "report" && report) return report.coachCommentZh;
    if (todayDone) return "今日已完成，可以再练一轮，把答案压得更准。";
    return "今天别拖，5 分钟面试冲刺先完成。";
  }, [report, screen, todayDone]);

  function enterPracticeRoom() {
    setStartError("");
    setScreen("practice");
  }

  function startCountdown(initialSeconds: number, sessionId: string) {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    setRemainingSeconds(initialSeconds);
    countdownRef.current = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          void endTraining(sessionId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  function updatePracticeStatusFromPipecat(status: string) {
    if (status === "connecting" || status === "initializing" || status === "authenticating") {
      setPracticeStatus("connecting");
      setCoachState("thinking");
      return;
    }
    if (status === "bot-speaking") {
      setBusy("");
      setPracticeStatus("speaking");
      setCoachState("asking");
      return;
    }
    if (status === "user-speaking" || status === "ready" || status === "bot-ready" || status === "connected") {
      setBusy("");
      setPracticeStatus("listening");
      setCoachState("listening");
    }
  }

  function createTurnKey(speaker: ConversationTurn["speaker"], text: string) {
    return `${speaker}:${text.replace(/\s+/g, " ").trim()}`;
  }

  function seedRecordedTurnKeys(turns: ConversationTurn[]) {
    recordedTurnKeysRef.current = new Set(turns.map((turn) => createTurnKey(turn.speaker, turn.text)));
  }

  function dedupeVoiceTurn(turn: PipecatVoiceTurn) {
    const normalizedText = turn.text.replace(/\s+/g, " ").trim();
    if (!normalizedText) return true;
    const key = createTurnKey(turn.speaker, normalizedText);
    if (recordedTurnKeysRef.current.has(key)) return true;
    recordedTurnKeysRef.current.add(key);
    return false;
  }

  async function recordVoiceTurn(turn: PipecatVoiceTurn, sessionId: string) {
    if (dedupeVoiceTurn(turn)) return;
    const text = turn.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    const result = await api.addSessionTurn(sessionId, {
      speaker: turn.speaker,
      text,
      timestamp: turn.timestamp || new Date().toISOString()
    });
    setPracticeSession(result.session);
    setConversationTurns(result.session.conversation_turns);
    if (turn.speaker === "ai") {
      setLatestAiText(text);
      setPracticeStatus("speaking");
      setCoachState("asking");
      window.setTimeout(() => setPracticeStatus("listening"), 800);
    }
  }

  async function startConversation() {
    setBusy("Checking voice service");
    setStartError("");
    setConversationTurns([]);
    setLatestAiText("");
    setPracticeSession(null);
    setReport(null);
    setPracticeStatus("connecting");
    setCoachState("thinking");
    recordedTurnKeysRef.current.clear();

    try {
      await voiceClientRef.current?.disconnect();
      await checkPipecatHealth();
      setBusy("Opening live voice connection");
      const started = await api.startSession(
        scenario.id,
        task.id,
        isCustomScenario(scenario) ? scenario : undefined,
        selectedDurationMinutes
      );
      setPracticeSession(started.session);
      setConversationTurns(started.session.conversation_turns);
      seedRecordedTurnKeys(started.session.conversation_turns);
      setLatestAiText(started.aiText);
      setRemainingSeconds(started.remainingSeconds);
      startCountdown(started.remainingSeconds, started.sessionId);

      const client = createPipecatVoiceClient({
        webrtcUrl: createPipecatOfferUrl({
          sessionId: started.sessionId,
          scenarioId: scenario.id,
          taskId: task.id,
          targetGoal: task.focus
        }),
        callbacks: {
          onStatus: updatePracticeStatusFromPipecat,
          onTurn: (turn) => {
            void recordVoiceTurn(turn, started.sessionId).catch((error) => {
              setStartError(error instanceof Error ? error.message : "写入实时对话记录失败。");
            });
          },
          onError: (message) => {
            setStartError(mapPracticeStartError(new Error(message)));
            setBusy("");
            setPracticeStatus((current) => (current === "connecting" ? "idle" : current));
            setCoachState((current) => (current === "thinking" ? "idle" : current));
          },
          onDisconnected: () => {
            setBusy("");
            setPracticeStatus((current) => (current === "completed" ? current : "ended"));
            setCoachState("reviewing");
          }
        }
      });
      voiceClientRef.current = client;
      await client.connect();
      if (voiceClientRef.current !== client) return;
      setBusy("");
      setPracticeStatus("listening");
      setCoachState("listening");
    } catch (error) {
      setBusy("");
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      await voiceClientRef.current?.disconnect().catch(() => null);
      voiceClientRef.current = null;
      setPracticeStatus("idle");
      setCoachState("idle");
      setStartError(mapPracticeStartError(error));
    }
  }

  async function endTraining(sessionIdOverride?: string) {
    const activeSessionId = sessionIdOverride || practiceSession?.id;
    if (!activeSessionId) return;
    setBusy("关闭实时语音连接");
    await voiceClientRef.current?.disconnect().catch(() => null);
    voiceClientRef.current = null;
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    const ended = await api.endSession(activeSessionId).catch(() => null);
    if (ended) setPracticeSession(ended.session);
    setPracticeStatus("ended");
    setCoachState("reviewing");
    setBusy("");
  }

  async function generatePracticeReport() {
    if (!practiceSession) return;
    setBusy("生成课后报告");
    setCoachState("reviewing");
    setPracticeStatus("thinking");

    const result = await api.generateReport({
      sessionId: practiceSession.id,
      scenarioId: scenario.id,
      taskId: task.id,
      scenarioNameZh: scenario.nameZh,
      taskTitleZh: task.titleZh,
      taskFocus: task.focus,
      conversation_turns: conversationTurns
    });
    setReport(result);
    setCheckin(completeToday(result.totalScore, result.reportId));
    setLearning(
      recordLearning(
        createLearningRecord({
          date: getShanghaiDate(),
          scenarioNameZh: scenario.nameZh,
          scenarioNameEn: scenario.nameEn,
          taskTitleZh: task.titleZh,
          focus: task.focus,
          roundCount: userTurnCount,
          report: result
        })
      )
    );
    setCoachState("celebrating");
    setPracticeStatus("completed");
    setScreen("report");
    setBusy("");
  }

  function applyCustomScenario() {
    const sceneName = customForm.sceneName.trim() || defaultCustomForm.sceneName;
    const taskTitle = customForm.taskTitle.trim() || defaultCustomForm.taskTitle;
    const focus = customForm.focus.trim() || defaultCustomForm.focus;
    const openingQuestion = customForm.openingQuestion.trim() || defaultCustomForm.openingQuestion;
    const nextScenario: Scenario = {
      id: `custom-${Date.now()}`,
      nameZh: sceneName,
      nameEn: "Custom",
      descriptionZh: `自定义场景：${focus}`,
      tasks: [
        {
          id: "custom-task",
          titleZh: taskTitle,
          titleEn: "Custom practice",
          aiRoleZh: customForm.aiRole.trim() || defaultCustomForm.aiRole,
          focus,
          openingQuestion
        }
      ]
    };
    saveCustomScenario(nextScenario);
    setScenarios((items) => [nextScenario, ...items.filter((item) => item.id !== nextScenario.id)]);
    setScenario(nextScenario);
    setTask(nextScenario.tasks[0]);
  }

  return (
    <>
      <BrandTopBar />
      <nav className="screen-tabs" aria-label="主要页面">
        <div className="screen-tabs-inner">
          <div className="screen-tab-list">
            <button
              className={`screen-tab ${screen === "home" ? "active" : ""}`}
              type="button"
              onClick={() => setScreen("home")}
            >
              ① 首页
            </button>
            <button
              className={`screen-tab ${screen === "practice" || screen === "prep" ? "active" : ""}`}
              type="button"
              onClick={() => setScreen(practiceSession ? "practice" : "prep")}
            >
              ② 练习页
            </button>
            <button
              className={`screen-tab ${screen === "report" ? "active" : ""}`}
              type="button"
              disabled={!report}
              onClick={() => report && setScreen("report")}
            >
              ③ 报告页
            </button>
          </div>
          <div className="screen-tab-actions">
            <div className="api-pill">
              <Headphones size={16} />
              {health?.mode === "live" ? "Live API" : "Mock Demo"}
            </div>
            <button className="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings size={16} />
              API 配置
            </button>
          </div>
        </div>
      </nav>
      <main className="app-shell">
      <ApiSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(settings) => setHealth(settings)}
      />

      {screen === "home" && (
        <section className="home-screen">
          <div className="home-hero">
            <section className="panel home-task">
              <span className="eyebrow">今日任务</span>
              <h2 className="home-task-title">
                <span>今天只练 5 分钟，</span>
                <span>把一个回答说清楚。</span>
              </h2>
              <p className="muted">{HOME_COPY.subtitle}</p>
              <div className="goal-box">🎯 本轮目标：{task.focus}</div>
              <div className="top-actions">
                <button className="primary" onClick={enterPracticeRoom}>
                  <Play size={18} />
                  {HOME_COPY.startButton}
                </button>
                <button className="secondary" onClick={() => setScreen("prep")}>
                  {HOME_COPY.changeScene}
                </button>
                {report && (
                  <button className="secondary" onClick={() => setScreen("report")}>
                    {HOME_COPY.lastReport}
                  </button>
                )}
              </div>
              <p className="muted low-pressure-note">{HOME_COPY.lowPressureNote}</p>
            </section>

            <section className="panel home-coach">
              <div className="home-bubble">Ready for a 5-minute interview practice? 😊</div>
              <CoachAvatar state={coachState === "idle" ? "idle" : coachState} size={240} />
            </section>

            <section className="panel home-growth">
              <span className="eyebrow">我的成长轨迹</span>
              <div className="growth-row">
                <span className="muted">连续练习</span>
                <span className="growth-big">{GROWTH_MOCK.streakDays} 天 🔥</span>
              </div>
              <div className="growth-row">
                <span className="muted">累计口语时间</span>
                <strong>{GROWTH_MOCK.totalMinutes} 分钟</strong>
              </div>
              <div className="growth-row">
                <span className="muted">最近得分</span>
                <strong>{GROWTH_MOCK.lastScore}</strong>
              </div>
              <div className="growth-row">
                <span className="muted">当前薄弱项</span>
                <span className="pill">{GROWTH_MOCK.weakAreaZh}</span>
              </div>
              <div className="next-target">
                📌 推荐下一练：{GROWTH_MOCK.nextPracticeZh}
                <br />
                {GROWTH_MOCK.nextTipZh}
              </div>
            </section>
          </div>

          <span className="eyebrow section-kicker">为什么用 lingo coach</span>
          <div className="value-row">
            {VALUE_CARDS.map((value) => (
              <div className="value-card" key={value.titleZh}>
                <div className="value-icon">{value.icon}</div>
                <strong>{value.titleZh}</strong>
                <p className="muted">{value.descZh}</p>
              </div>
            ))}
          </div>

          <span className="eyebrow section-kicker">选择真实场景</span>
          <div className="scene-grid">
            {scenarios.slice(0, 3).map((item, index) => (
              <button
                type="button"
                className="scene-card"
                key={item.id}
                style={{ background: ["#58CC02", "#1CB0F6", "#CE82FF"][index % 3] }}
                onClick={() => {
                  setScenario(item);
                  setTask(item.tasks[0]);
                  setScreen("prep");
                }}
              >
                <div className="scene-tags">
                  <span>{index === 0 ? "推荐" : index === 1 ? "低压力入门" : "进阶"}</span>
                  <span>{item.tasks[0]?.titleZh}</span>
                </div>
                <h3>{item.nameZh} {item.nameEn}</h3>
                <div className="scene-meta">
                  训练目标：{item.tasks[0]?.focus}
                  <br />
                  核心能力：结构表达 · 真实追问 · 课后复盘
                  <br />
                  适合：5 分钟练习 · 中文用户英文开口
                </div>
                <div className="scene-go">开始练习</div>
              </button>
            ))}
            <button type="button" className="scene-card custom" onClick={() => setScreen("prep")}>
              <div className="plus">+</div>
              <h3>自定义场景</h3>
              <div className="scene-meta">自己设定 AI 角色、任务与开场问题</div>
            </button>
          </div>
        </section>
      )}

      {screen === "prep" && (
        <section className="panel prep-panel">
          <div>
            <p className="eyebrow">
              {scenario.nameZh} {scenario.nameEn}
            </p>
            <h2>选择本轮任务</h2>
            <p>教练会保留对话节奏，只在关键节点给轻提示，完整纠错放到课后报告。</p>
            <div className="requirement-strip" aria-label="题目硬需求覆盖">
              <span>场景选择</span>
              <span>实时语音</span>
              <span>发音评测</span>
              <span>语法纠错</span>
              <span>课后总结</span>
            </div>
            <div className="task-list">
              {scenario.tasks.map((item) => (
                <button
                  key={item.id}
                  className={`task-card ${task.id === item.id ? "selected" : ""}`}
                  onClick={() => setTask(item)}
                >
                  <strong>{item.titleZh}</strong>
                  <span>{item.titleEn}</span>
                  <small>{item.aiRoleZh} · {item.focus}</small>
                </button>
              ))}
            </div>
            <CustomScenarioBuilder
              form={customForm}
              onChange={setCustomForm}
              onApply={applyCustomScenario}
            />
            <div className="duration-picker" aria-label="训练时长">
              {[3, 5, 7, 10].map((minutes) => (
                <button
                  type="button"
                  key={minutes}
                  className={selectedDurationMinutes === minutes ? "active" : ""}
                  onClick={() => setSelectedDurationMinutes(minutes)}
                >
                  {minutes} 分钟
                </button>
              ))}
            </div>
            <button className="primary" onClick={enterPracticeRoom} disabled={Boolean(busy)}>
              <Sparkles size={18} />
              {busy || "进入对话房间"}
            </button>
            {startError && <div className="hint-line">{startError}</div>}
          </div>
          <CoachAvatar state="idle" />
        </section>
      )}

      {screen === "practice" && (
        <>
        <div className="practice-top">
          <span className="practice-chip green">{scenario.nameZh} · {scenario.nameEn}</span>
          <span className="practice-chip">剩余 {formatSeconds(remainingSeconds)}</span>
          <span className="practice-chip">状态：{practiceStatusLabel(practiceStatus)}</span>
          <span className="practice-chip goal">🎯 {task.focus}</span>
        </div>
        <section className="practice-grid">
          <div className={`stage dialogue-room practice-${practiceStatus}`}>
            <div className="coach-focus">
              <div className="coach-prompt">
                {latestAiText || "Click Start Training and your coach will begin the conversation."}
              </div>
              <div className="coach-avatar-wrap">
                <CoachAvatar state={coachState} size={230} />
              </div>
              <div className={`coach-state-panel ${startError ? "error" : ""}`} aria-live="polite">
                <span>{practiceCopy.headline}</span>
                <p>{practiceCopy.helper}</p>
              </div>
            </div>
            <div className="voice-primary-controls" aria-label="实时训练控制">
              <button
                className="primary wide"
                onClick={startConversation}
                disabled={Boolean(busy) || (practiceStatus !== "idle" && practiceStatus !== "completed")}
              >
                <Play size={18} />
                开始训练
              </button>
              <button
                className="danger wide"
                onClick={() => void endTraining()}
                disabled={!practiceSession || practiceStatus === "ended" || practiceStatus === "completed" || Boolean(busy)}
              >
                <Square size={17} />
                结束训练
              </button>
              <button
                className="secondary wide"
                onClick={generatePracticeReport}
                disabled={!practiceSession || practiceStatus !== "ended" || Boolean(busy)}
              >
                <Sparkles size={17} />
                生成报告
              </button>
            </div>
          </div>

          <aside className="practice-side voice-log-side" aria-label="实时对话记录">
            <span className="eyebrow">实时对话记录</span>
            <div className="caption-stream voice-only-log">
              {conversationTurns.length === 0 ? (
                <div className="caption-line system">Start training and your complete conversation will appear here.</div>
              ) : (
                conversationTurns.map((turn) => (
                  <div className={`caption-line ${turn.speaker}`} key={turn.id}>
                    <span>{turn.speaker === "ai" ? "AI" : turn.speaker === "user" ? "You" : "System"}</span>
                    <p>{turn.text}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>
        </>
      )}

      {screen === "report" && report && (
        <section className="report-grid">
          <div className="score-hero">
            <div>
              <div className="score-num">{report.totalScore}</div>
              <div className="score-denom">/ 100</div>
            </div>
            <div>
              <span className="eyebrow">本次练习 · {scenario.nameZh}</span>
              <h2>{report.coachCommentZh}</h2>
              <p>完成目标：{task.focus}</p>
            </div>
          </div>

          <div className="panel">
            <span className="eyebrow">{REPORT_COPY.dimensionsLabel}</span>
            {report.dimensions.map((dimension) => (
              <div className="dim" key={dimension.id}>
                <div className="dim-t">
                  <span>{dimension.labelZh}</span>
                  <span>{dimension.score}</span>
                </div>
                <div className="dim-bar">
                  <i style={{ width: `${dimension.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="panel report-radar-card">
            <span className="eyebrow">评分雷达图</span>
            <AbilityRadar dimensions={report.dimensions} />
          </div>

          <div className="panel report-conversation-card">
            <span className="eyebrow">完整对话回放</span>
            <ConversationLog turns={conversationTurns} />
          </div>

          <div className="panel">
            <span className="eyebrow">{REPORT_COPY.bestFixLabel}</span>
            {report.corrections[0] && (
              <>
                <p className="fix-orig">Original: {report.corrections[0].original}</p>
                <p className="fix-better">Better: {report.corrections[0].improved}</p>
                <p className="muted">{report.corrections[0].explanationZh}</p>
              </>
            )}
          </div>

          <div className="panel">
            <span className="eyebrow">{REPORT_COPY.replayLabel}</span>
            <ul className="replay-list">
              {report.suggestions.map((suggestion) => (
                <li className="replay-li" key={suggestion}>{suggestion}</li>
              ))}
            </ul>
            <div className="control-row">
              <button className="secondary" onClick={() => setScreen("prep")}>换个任务</button>
              <button className="primary" onClick={enterPracticeRoom}>再练一轮</button>
            </div>
          </div>

          <div className="encourage">🌱 {report.summaryZh}</div>
        </section>
      )}
      </main>
    </>
  );
}

function isCustomScenario(scenario: Scenario) {
  return scenario.id.startsWith("custom-") || scenario.id.startsWith("custom_");
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function AbilityRadar({ dimensions }: { dimensions: ReportResult["dimensions"] }) {
  const size = 238;
  const center = size / 2;
  const maxRadius = 78;
  const angleStep = (Math.PI * 2) / dimensions.length;
  const points = dimensions.map((dimension, index) => {
    const angle = -Math.PI / 2 + angleStep * index;
    const radius = (dimension.score / 100) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  });

  const grid = [0.33, 0.66, 1].map((scale) =>
    dimensions
      .map((_, index) => {
        const angle = -Math.PI / 2 + angleStep * index;
        return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
      })
      .join(" ")
  );

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="七维口语评分雷达图">
        {grid.map((polygon) => (
          <polygon className="radar-grid" key={polygon} points={polygon} />
        ))}
        {dimensions.map((dimension, index) => {
          const angle = -Math.PI / 2 + angleStep * index;
          const x = center + Math.cos(angle) * (maxRadius + 26);
          const y = center + Math.sin(angle) * (maxRadius + 26);
          return (
            <g key={dimension.id}>
              <line
                className="radar-axis"
                x1={center}
                y1={center}
                x2={center + Math.cos(angle) * maxRadius}
                y2={center + Math.sin(angle) * maxRadius}
              />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle">
                {dimension.labelZh.replace("度", "")}
              </text>
            </g>
          );
        })}
        <polygon className="radar-score" points={points.join(" ")} />
      </svg>
    </div>
  );
}

function ConversationLog({ turns }: { turns: ConversationTurn[] }) {
  if (turns.length === 0) {
    return <p className="muted">本次报告暂无对话记录。</p>;
  }

  return (
    <div className="conversation-log">
      {turns.map((turn) => (
        <article className={`conversation-row ${turn.speaker}`} key={turn.id}>
          <span>{turn.speaker === "ai" ? "AI" : turn.speaker === "user" ? "You" : "System"}</span>
          <p>{turn.text}</p>
          <small>{new Date(turn.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</small>
        </article>
      ))}
    </div>
  );
}

function createJourneySteps({
  screen,
  busy,
  turnCount,
  hasReport
}: {
  screen: Screen;
  busy: string;
  turnCount: number;
  hasReport: boolean;
}): JourneyStep[] {
  const inPractice = screen === "practice";
  const reportActive = busy.includes("报告");

  return [
    {
      label: "场景目标",
      detail: "面试 / 点餐 / 会议 / 自定义",
      status: screen === "home" ? "active" : "done"
    },
    {
      label: "实时语音对话",
      detail: "教练会听完你的回答后自然追问",
      status: hasReport || turnCount > 0 ? "done" : inPractice ? "active" : "waiting"
    },
    {
      label: "发音评测",
      detail: "整段对话进入课后七维评估",
      status: hasReport || turnCount > 0 ? "done" : busy.includes("voice") ? "active" : "waiting"
    },
    {
      label: "语法/表达纠错",
      detail: "练习中轻提示，报告页集中纠错",
      status: hasReport ? "done" : turnCount > 0 || busy.includes("追问") ? "active" : "waiting"
    },
    {
      label: "课后总结",
      detail: "七维评分、推荐表达、下一次目标",
      status: hasReport ? "done" : reportActive ? "active" : "waiting"
    }
  ];
}

function LearningJourneyCard({
  checkin,
  latestRecord,
  scenario,
  task,
  steps,
  summary
}: {
  checkin: CheckinState;
  latestRecord: LearningState["records"][number] | null;
  scenario: Scenario;
  task: Scenario["tasks"][number];
  steps: JourneyStep[];
  summary: ReturnType<typeof summarizeLearning>;
}) {
  return (
    <aside className="panel stats-panel learning-journey-card">
      <div className="journey-header">
        <div>
          <p className="eyebrow">Learning Track</p>
          <h3>全流程学习跟踪</h3>
        </div>
        <Route size={24} />
      </div>
      <div className="journey-metrics">
        <Metric icon={<CalendarDays size={18} />} value={`${checkin.currentStreak} 天`} label="连续练习" />
        <Metric icon={<Award size={18} />} value={summary.latestScore ?? "--"} label="最近得分" />
        <Metric icon={<BarChart3 size={18} />} value={summary.averageScore ?? "--"} label="平均分" />
      </div>
      <div className="active-goal">
        <span>当前目标</span>
        <strong>{scenario.nameZh} · {task.titleZh}</strong>
        <small>{task.focus}</small>
      </div>
      <FlowTracker steps={steps} compact />
      <div className="journey-note">
        <strong>{latestRecord ? `上次练习：${latestRecord.scenarioNameZh} ${latestRecord.score} 分` : "完成一轮后生成成长轨迹"}</strong>
        <span>重点补强：{summary.priorityDimension}</span>
      </div>
      <WeekDots checkin={checkin} />
    </aside>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="metric">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FlowTracker({ steps, compact = false }: { steps: JourneyStep[]; compact?: boolean }) {
  return (
    <ol className={`flow-tracker ${compact ? "compact" : ""}`}>
      {steps.map((step) => (
        <li key={step.label} className={step.status}>
          <span className="flow-dot" />
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomScenarioBuilder({
  form,
  onChange,
  onApply
}: {
  form: CustomScenarioForm;
  onChange: (form: CustomScenarioForm) => void;
  onApply: () => void;
}) {
  function update(field: keyof CustomScenarioForm, value: string) {
    onChange({ ...form, [field]: value });
  }

  return (
    <section className="custom-scenario-box" aria-label="自定义训练场景">
      <div className="custom-scenario-header">
        <div>
          <p className="eyebrow">Custom Scene</p>
          <h3>定制一个训练场景</h3>
        </div>
        <PencilLine size={22} />
      </div>
      <div className="custom-form-grid">
        <label>
          场景名称
          <input value={form.sceneName} onChange={(event) => update("sceneName", event.target.value)} />
        </label>
        <label>
          AI 角色
          <input value={form.aiRole} onChange={(event) => update("aiRole", event.target.value)} />
        </label>
        <label>
          任务标题
          <input value={form.taskTitle} onChange={(event) => update("taskTitle", event.target.value)} />
        </label>
        <label>
          训练重点
          <input value={form.focus} onChange={(event) => update("focus", event.target.value)} />
        </label>
        <label className="custom-question">
          开场问题
          <input value={form.openingQuestion} onChange={(event) => update("openingQuestion", event.target.value)} />
        </label>
      </div>
      <button className="secondary" type="button" onClick={onApply}>
        <Target size={18} />
        使用这个场景
      </button>
    </section>
  );
}

function LearningHistoryPanel({
  state,
  summary
}: {
  state: LearningState;
  summary: ReturnType<typeof summarizeLearning>;
}) {
  const recent = state.records.slice(0, 3);

  return (
    <div className="panel learning-history-panel">
      <p className="eyebrow">Growth Trail</p>
      <h3>口语能力变化</h3>
      <div className="history-metrics">
        <Metric icon={<Sparkles size={18} />} value={summary.totalSessions} label="累计报告" />
        <Metric icon={<BarChart3 size={18} />} value={summary.strongestDimension} label="当前优势" />
        <Metric icon={<Target size={18} />} value={summary.priorityDimension} label="下轮重点" />
      </div>
      <div className="history-list">
        {recent.map((record) => (
          <article key={record.reportId}>
            <strong>{record.scenarioNameZh} · {record.taskTitleZh}</strong>
            <span>{record.score} 分 / {record.roundCount} 句回答 / {record.correctionCount} 条纠错</span>
            <small>{record.nextGoal}</small>
          </article>
        ))}
      </div>
    </div>
  );
}
