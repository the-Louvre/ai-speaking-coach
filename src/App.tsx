import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Headphones,
  Mic,
  PencilLine,
  Play,
  RefreshCw,
  Route,
  Send,
  Settings,
  Sparkles,
  Square,
  Target,
  Volume2
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachState,
  DialogueTurnResult,
  ReportResult,
  SpeechAudioResult,
  TranscriptResult
} from "../shared/schemas";
import { createTaskMetadata, type Scenario } from "../server/data";
import { api, type HealthResult, type SessionStart } from "./api";
import { ApiSettingsPanel } from "./components/ApiSettingsPanel";
import { CoachAvatar } from "./components/CoachAvatar";
import { WeekDots } from "./components/WeekDots";
import { getShanghaiDate, type CheckinState } from "./domain/checkin";
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

type Screen = "home" | "prep" | "practice" | "report";
type Turn = {
  round: number;
  aiText: string;
  userText: string;
  hintZh?: string;
  correctionPreview?: string;
  nextRoundGoal?: string;
  transcriptConfidence?: number;
  transcriptProvider?: string;
  speechRateWpm?: number;
  lowConfidenceWords?: TranscriptResult["lowConfidenceWords"];
  pauseEvents?: TranscriptResult["pauseEvents"];
  pronunciationNotes?: string[];
};
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
        openingQuestion: "Tell me about one project you are proud of.",
        ...createTaskMetadata({ focus: "把项目结果说清楚" })
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
  const [session, setSession] = useState<SessionStart | null>(null);
  const [coachState, setCoachState] = useState<CoachState>("idle");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [latestAiText, setLatestAiText] = useState("");
  const [latestHint, setLatestHint] = useState("");
  const [latestTranscript, setLatestTranscript] = useState<TranscriptResult | null>(null);
  const [speech, setSpeech] = useState<SpeechAudioResult | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [checkin, setCheckin] = useState<CheckinState>(() => loadCheckin());
  const [learning, setLearning] = useState<LearningState>(() => loadLearning());
  const [customForm, setCustomForm] = useState<CustomScenarioForm>(defaultCustomForm);
  const [busy, setBusy] = useState("");
  const [recording, setRecording] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const todayDone = checkin.completedDates.includes(getShanghaiDate());
  const currentRound = turns.length + 1;
  const roundLimit = session?.roundLimit ?? 5;
  const learningSummary = useMemo(() => summarizeLearning(learning), [learning]);
  const latestLearningRecord = learning.records[0] ?? null;
  const journeySteps = useMemo(
    () =>
      createJourneySteps({
        screen,
        busy,
        recording,
        turnCount: turns.length,
        hasDraft: Boolean(draft.trim()),
        hasReport: Boolean(report)
      }),
    [busy, draft, recording, report, screen, turns.length]
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

  const coachLine = useMemo(() => {
    if (screen === "report" && report) return report.coachCommentZh;
    if (todayDone) return "今日已完成，可以再练一轮，把答案压得更准。";
    return "今天别拖，5 分钟面试冲刺先完成。";
  }, [report, screen, todayDone]);

  async function startPractice() {
    setBusy("创建练习任务");
    setCoachState("thinking");
    const next = await api.startSession(scenario.id, task.id, isCustomScenario(scenario) ? scenario : undefined);
    setSession(next);
    setScenario(next.scenario);
    setTask(next.task);
    setLatestAiText(next.aiText);
    setLatestHint(next.hintZh);
    setTurns([]);
    setDraft("");
    setLatestTranscript(null);
    setReport(null);
    setCoachState("asking");
    setScreen("practice");
    setBusy("");
  }

  async function beginRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLatestHint("当前浏览器无法录音，可以直接输入回答或使用模拟转写。");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const audio = new Blob(chunksRef.current, { type: "audio/webm" });
      void runTranscription(audio);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setCoachState("listening");
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    setCoachState("thinking");
  }

  async function runTranscription(audio?: Blob) {
    setBusy("识别语音");
    setCoachState("thinking");
    const transcript = await api.transcribe(audio);
    setDraft(transcript.text);
    setLatestTranscript(transcript);
    setLatestHint(
      transcript.fallback
        ? "当前使用模拟转写，可直接编辑答案后提交。"
        : `转写置信度 ${(transcript.confidence * 100).toFixed(0)}%，语速 ${transcript.speechRateWpm} WPM，可编辑后提交。`
    );
    setCoachState("idle");
    setBusy("");
  }

  async function submitTurn() {
    if (!session || !draft.trim()) return;
    setBusy("生成追问");
    setCoachState("thinking");
    const turnResult: DialogueTurnResult = await api.nextTurn({
      sessionId: session.sessionId,
      scenarioId: scenario.id,
      taskId: task.id,
      scenarioLabel: `${scenario.nameZh} / ${scenario.nameEn}`,
      taskTitle: `${task.titleZh} / ${task.titleEn}`,
      taskFocus: task.focus,
      aiRoleZh: task.aiRoleZh,
      round: currentRound,
      currentAiText: latestAiText,
      userText: draft,
      turns
    });
    const speechResult = await api.synthesize(turnResult.aiText);
    const transcriptEvidence = createTurnTranscriptEvidence(latestTranscript);
    setTurns((items) => [
      ...items,
      {
        round: currentRound,
        aiText: latestAiText,
        userText: draft,
        hintZh: turnResult.hintZh,
        correctionPreview: turnResult.correctionPreview,
        nextRoundGoal: turnResult.nextRoundGoal,
        ...transcriptEvidence
      }
    ]);
    setLatestAiText(turnResult.aiText);
    setLatestHint(turnResult.hintZh);
    setSpeech(speechResult);
    setDraft("");
    setLatestTranscript(null);
    setCoachState(turnResult.coachState);
    setBusy("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function finishSession() {
    if (!session) return;
    setBusy("生成课后报告");
    setCoachState("reviewing");
    const result = await api.generateReport({
      sessionId: session.sessionId,
      scenarioId: scenario.id,
      taskId: task.id,
      scenarioNameZh: scenario.nameZh,
      taskTitleZh: task.titleZh,
      taskFocus: task.focus,
      turns
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
          roundCount: turns.length,
          report: result
        })
      )
    );
    setCoachState("celebrating");
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
          openingQuestion,
          ...createTaskMetadata({ focus })
        }
      ]
    };
    saveCustomScenario(nextScenario);
    setScenarios((items) => [nextScenario, ...items.filter((item) => item.id !== nextScenario.id)]);
    setScenario(nextScenario);
    setTask(nextScenario.tasks[0]);
  }

  function replaySpeech() {
    if (!latestAiText) return;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(latestAiText);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis?.speak(utterance);
  }

  return (
    <>
      <ProductTopBar />
      <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Speaking Coach</p>
          <h1>
            <span>5 分钟场景口语冲刺</span>
            <span>说完就复盘</span>
          </h1>
        </div>
        <div className="top-actions">
          <div className="api-pill">
            <Headphones size={16} />
            {health?.mode === "live" ? "Live API" : "Mock Demo"}
          </div>
          <button className="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            API 配置
          </button>
        </div>
      </header>

      <ApiSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(settings) => setHealth(settings)}
      />

      {screen === "home" && (
        <section className="home-grid">
          <div className="panel hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">今日任务</p>
              <h2>{todayDone ? "今日已点亮，可以继续加练" : "先完成一轮 5 分钟训练"}</h2>
              <p>{coachLine}</p>
              <div className="action-row">
                <button className="primary" onClick={() => setScreen("prep")}>
                  <Play size={18} />
                  {todayDone ? "再练一轮" : "开始今日练习"}
                </button>
              </div>
            </div>
            <CoachAvatar state={coachState} />
          </div>

          <LearningJourneyCard
            checkin={checkin}
            latestRecord={latestLearningRecord}
            scenario={scenario}
            task={task}
            steps={journeySteps}
            summary={learningSummary}
          />

          <HomeFocusGrid
            latestRecord={latestLearningRecord}
            scenario={scenario}
            summary={learningSummary}
            task={task}
            onStartPractice={() => setScreen("prep")}
          />

          <div className="scenario-list">
            {scenarios.map((item) => (
              <button
                key={item.id}
                className={`scenario-card ${scenario.id === item.id ? "selected" : ""}`}
                onClick={() => {
                  setScenario(item);
                  setTask(item.tasks[0]);
                }}
              >
                <strong>
                  {item.nameZh} <span>{item.nameEn}</span>
                </strong>
                <p>{item.descriptionZh}</p>
              </button>
            ))}
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
            <div className="task-meta-strip" aria-label="当前任务信息">
              <span>{task.difficulty}</span>
              <span>{task.aiRoleZh}</span>
              <span>{task.roundGoals.length} 轮目标</span>
              <span>{task.focus}</span>
            </div>
            <div className="active-goal prep-goal-card">
              <span>本轮教练策略</span>
              <strong>{task.roundGoals[0]}</strong>
              <small>每一轮右侧都会沉淀“教练建议、下一轮目标、语音证据”，不是只展示转写文本。</small>
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
            <TaskCoachingPanel task={task} />
            <CustomScenarioBuilder
              form={customForm}
              onChange={setCustomForm}
              onApply={applyCustomScenario}
            />
            <button className="primary" onClick={startPractice}>
              <Sparkles size={18} />
              开始 5 分钟练习
            </button>
          </div>
          <CoachAvatar state="idle" />
        </section>
      )}

      {screen === "practice" && (
        <section className="practice-layout">
          <aside className="panel coach-panel">
            <CoachAvatar state={coachState} />
            <p>{coachLine}</p>
          </aside>

          <section className="panel dialogue-panel">
            <div className="dialogue-header">
              <div>
                <p className="eyebrow">Round {currentRound} / {roundLimit}</p>
                <h2>{task.titleZh}</h2>
              </div>
              <button className="ghost" onClick={replaySpeech}>
                <Volume2 size={17} />
                重播 AI
              </button>
            </div>

            <div className="bubble ai">
              <strong>{task.aiRoleZh}</strong>
              <p>{latestAiText}</p>
            </div>

            <label className="transcript-box">
              <span>你的回答转写</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="可以录音识别，也可以直接输入英文回答..."
              />
            </label>

            <div className="control-row">
              {!recording ? (
                <button className="secondary" onClick={beginRecording}>
                  <Mic size={18} />
                  开始录音
                </button>
              ) : (
                <button className="danger" onClick={stopRecording}>
                  <Square size={18} />
                  停止并识别
                </button>
              )}
              <button className="secondary" onClick={() => runTranscription()}>
                <RefreshCw size={18} />
                使用模拟转写
              </button>
              <button className="primary" onClick={submitTurn} disabled={!draft.trim() || Boolean(busy)}>
                <Send size={18} />
                提交本轮
              </button>
            </div>

            <div className="hint-line">{busy || latestHint}</div>
            {speech && <div className="hint-line">TTS 状态：{speech.provider} / {speech.format}</div>}
          </section>

          <aside className="panel progress-panel">
            <h3>学习路径</h3>
            <p>{task.focus}</p>
            <FlowTracker steps={journeySteps} />
            <div className="latency-card">
              <span>播报状态</span>
              <strong>{speech ? `${speech.provider} / ${speech.format}` : "等待 AI 下一问"}</strong>
              <small>{speech ? `预计 ${speech.durationEstimateSec.toFixed(1)}s，可用“重播 AI”回听。` : "提交本轮后生成追问和播报状态。"}</small>
            </div>
            <SpeechEvidencePanel transcript={latestTranscript} turns={turns} />
            <div className="round-list">
              {turns.map((turn) => (
                <div key={turn.round}>
                  <span>Round {turn.round}</span>
                  <p className="round-answer">{turn.userText}</p>
                  {turn.correctionPreview && (
                    <small className="round-advice">
                      <b>教练建议</b>
                      {turn.correctionPreview}
                    </small>
                  )}
                  {turn.nextRoundGoal && (
                    <small className="round-goal">
                      <b>下一轮目标</b>
                      {turn.nextRoundGoal}
                    </small>
                  )}
                  {turn.transcriptConfidence !== undefined && (
                    <small className="round-evidence">
                      <b>语音证据</b>
                      转写 {formatPercent(turn.transcriptConfidence)} · {turn.speechRateWpm ?? "--"} WPM
                      {turn.lowConfidenceWords?.length
                        ? ` · 低置信词 ${formatLowConfidenceWords(turn.lowConfidenceWords)}`
                        : ""}
                    </small>
                  )}
                </div>
              ))}
            </div>
            <button className="primary wide" onClick={finishSession} disabled={turns.length === 0 || Boolean(busy)}>
              <BadgeCheck size={18} />
              结束并生成报告
            </button>
          </aside>
        </section>
      )}

      {screen === "report" && report && (
        <section className="report-grid">
          <div className="panel report-summary">
            <p className="eyebrow">Session Report</p>
            <h2>{report.totalScore}</h2>
            <p>{report.summaryZh}</p>
            <div className="checkin-banner">
              <BadgeCheck size={20} />
              今日已完成，连续练习 {checkin.currentStreak} 天
            </div>
            <WeekDots checkin={checkin} />
          </div>

          <div className="panel">
            <CoachAvatar state={coachState} />
            <p>{report.coachCommentZh}</p>
          </div>

          <LearningHistoryPanel state={learning} summary={learningSummary} />

          <div className="panel score-grid">
            {report.dimensions.map((item) => (
              <div className="score-card" key={item.id}>
                <strong>{item.score}</strong>
                <span>{item.labelZh}</span>
                <small>{item.explanationZh}</small>
                <em>{getDimensionEvidence(report, item.id)}</em>
              </div>
            ))}
          </div>

          <div className="panel correction-panel">
            <h3>逐句纠错</h3>
            {report.corrections.map((item) => (
              <div className="correction" key={item.original}>
                <p><b>原句：</b>{item.original}</p>
                <p><b>推荐：</b>{item.improved}</p>
                <small>{item.explanationZh}</small>
              </div>
            ))}
            <h3>下一轮建议</h3>
            <ul>
              {report.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="control-row">
              <button className="secondary" onClick={() => setScreen("prep")}>换个任务</button>
              <button className="primary" onClick={startPractice}>再练一轮</button>
            </div>
          </div>
        </section>
      )}
      </main>
    </>
  );
}

function ProductTopBar() {
  return (
    <div className="brand-top-bar">
      <div className="brand-top-bar-inner">
        <span className="brand-mark">AI Speaking Coach</span>
        <span className="brand-top-note">Scenario practice · Evidence report</span>
      </div>
    </div>
  );
}

function HomeFocusGrid({
  latestRecord,
  scenario,
  summary,
  task,
  onStartPractice
}: {
  latestRecord: LearningState["records"][number] | null;
  scenario: Scenario;
  summary: ReturnType<typeof summarizeLearning>;
  task: Scenario["tasks"][number];
  onStartPractice: () => void;
}) {
  return (
    <section className="home-focus-grid" aria-label="今日练习状态">
      <button className="focus-card primary-focus" type="button" onClick={onStartPractice}>
        <span>当前任务</span>
        <strong>{scenario.nameZh} · {task.titleZh}</strong>
        <small>{task.focus}</small>
      </button>
      <article className="focus-card">
        <span>下轮重点</span>
        <strong>{summary.priorityDimension}</strong>
        <small>{latestRecord?.nextGoal ?? task.roundGoals[0]}</small>
      </article>
      <article className="focus-card">
        <span>最近表现</span>
        <strong>{summary.latestScore ?? "--"} 分</strong>
        <small>
          {latestRecord
            ? `${latestRecord.scenarioNameZh} · ${latestRecord.correctionCount} 条纠错`
            : "完成一轮后生成可追踪报告"}
        </small>
      </article>
    </section>
  );
}

function TaskCoachingPanel({ task }: { task: Scenario["tasks"][number] }) {
  return (
    <section className="task-coaching-panel" aria-label="任务教练策略">
      <div>
        <p className="eyebrow">Round Goals</p>
        <ol>
          {task.roundGoals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ol>
      </div>
      <div>
        <p className="eyebrow">Watch List</p>
        <ul>
          {task.commonMistakes.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SpeechEvidencePanel({
  transcript,
  turns
}: {
  transcript: TranscriptResult | null;
  turns: Turn[];
}) {
  const latestTurn = [...turns].reverse().find((turn) => turn.transcriptConfidence !== undefined);
  const confidence = transcript?.confidence ?? latestTurn?.transcriptConfidence;
  const speechRateWpm = transcript?.speechRateWpm ?? latestTurn?.speechRateWpm;
  const lowConfidenceWords = transcript?.lowConfidenceWords ?? latestTurn?.lowConfidenceWords ?? [];
  const pauseEvents = transcript?.pauseEvents ?? latestTurn?.pauseEvents ?? [];
  const pronunciationNotes = transcript?.pronunciationNotes ?? latestTurn?.pronunciationNotes ?? [];

  return (
    <section className="speech-evidence-panel" aria-label="语音证据">
      <span>语音证据</span>
      {confidence === undefined ? (
        <>
          <strong>等待转写</strong>
          <small>录音或使用模拟转写后，这里会显示置信度、语速和低置信词。</small>
        </>
      ) : (
        <>
          <div className="evidence-metrics">
            <Metric icon={<Headphones size={18} />} value={formatPercent(confidence)} label="转写置信度" />
            <Metric icon={<BarChart3 size={18} />} value={speechRateWpm ?? "--"} label="WPM" />
            <Metric icon={<Target size={18} />} value={lowConfidenceWords.length} label="低置信词" />
          </div>
          <small>
            {lowConfidenceWords.length
              ? `优先回听：${formatLowConfidenceWords(lowConfidenceWords)}`
              : "本轮暂未发现明显低置信词。"}
            {pauseEvents.length ? ` 明显停顿 ${pauseEvents.length} 处。` : ""}
          </small>
          {pronunciationNotes[0] && <small>{pronunciationNotes[0]}</small>}
        </>
      )}
    </section>
  );
}

function isCustomScenario(scenario: Scenario) {
  return scenario.id.startsWith("custom-") || scenario.id.startsWith("custom_");
}

function createTurnTranscriptEvidence(transcript: TranscriptResult | null): Pick<
  Turn,
  | "transcriptConfidence"
  | "transcriptProvider"
  | "speechRateWpm"
  | "lowConfidenceWords"
  | "pauseEvents"
  | "pronunciationNotes"
> {
  if (!transcript) return {};
  return {
    transcriptConfidence: transcript.confidence,
    transcriptProvider: transcript.provider,
    speechRateWpm: transcript.speechRateWpm,
    lowConfidenceWords: transcript.lowConfidenceWords,
    pauseEvents: transcript.pauseEvents,
    pronunciationNotes: transcript.pronunciationNotes
  };
}

function createJourneySteps({
  screen,
  busy,
  recording,
  turnCount,
  hasDraft,
  hasReport
}: {
  screen: Screen;
  busy: string;
  recording: boolean;
  turnCount: number;
  hasDraft: boolean;
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
      detail: "录音转写后由 AI 追问并播报",
      status: hasReport || turnCount > 0 ? "done" : inPractice || recording || hasDraft ? "active" : "waiting"
    },
    {
      label: "发音评测",
      detail: "转写置信度、低置信词、语速聚合",
      status: hasReport || turnCount > 0 ? "done" : busy.includes("识别") || recording ? "active" : "waiting"
    },
    {
      label: "语法/表达纠错",
      detail: "练习中轻提示，报告页集中纠错",
      status: hasReport ? "done" : turnCount > 0 || busy.includes("追问") ? "active" : "waiting"
    },
    {
      label: "课后总结",
      detail: "五维评分、推荐表达、下一轮目标",
      status: hasReport ? "done" : reportActive ? "active" : "waiting"
    }
  ];
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatLowConfidenceWords(words: TranscriptResult["lowConfidenceWords"]) {
  return words
    .slice(0, 4)
    .map((word) => word.punctuatedWord || word.word)
    .join("、");
}

function getDimensionEvidence(
  report: ReportResult,
  dimensionId: ReportResult["dimensions"][number]["id"]
) {
  return report.dimensionEvidence.find((item) => item.dimensionId === dimensionId)?.evidenceZh ?? "本维度暂无证据说明。";
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
            <span>{record.score} 分 / {record.roundCount} 轮 / {record.correctionCount} 条纠错</span>
            <small>{record.nextGoal}</small>
          </article>
        ))}
      </div>
    </div>
  );
}
