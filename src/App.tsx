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
import type { CoachState, DialogueTurnResult, ReportResult, SpeechAudioResult } from "../shared/schemas";
import type { Scenario } from "../server/data";
import { api, type HealthResult, type SessionStart } from "./api";
import { ApiSettingsPanel } from "./components/ApiSettingsPanel";
import { BrandGuideSections, BrandTopBar, GuideCardGrid } from "./components/BrandGuidelines";
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
  transcriptConfidence?: number;
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
  const [session, setSession] = useState<SessionStart | null>(null);
  const [coachState, setCoachState] = useState<CoachState>("idle");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [latestAiText, setLatestAiText] = useState("");
  const [latestHint, setLatestHint] = useState("");
  const [speech, setSpeech] = useState<SpeechAudioResult | null>(null);
  const [speechNotice, setSpeechNotice] = useState("");
  const [speechAudioSrc, setSpeechAudioSrc] = useState("");
  const [report, setReport] = useState<ReportResult | null>(null);
  const [checkin, setCheckin] = useState<CheckinState>(() => loadCheckin());
  const [learning, setLearning] = useState<LearningState>(() => loadLearning());
  const [customForm, setCustomForm] = useState<CustomScenarioForm>(defaultCustomForm);
  const [busy, setBusy] = useState("");
  const [startError, setStartError] = useState("");
  const [recording, setRecording] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const coachLine = useMemo(() => {
    if (screen === "report" && report) return report.coachCommentZh;
    if (todayDone) return "今日已完成，可以再练一轮，把答案压得更准。";
    return "今天别拖，5 分钟面试冲刺先完成。";
  }, [report, screen, todayDone]);

  async function startPractice() {
    setBusy("创建练习任务");
    setStartError("");
    setSpeechNotice("");
    setSpeechAudioSrc("");
    setSpeech(null);
    setCoachState("thinking");

    try {
      const next = await api.startSession(scenario.id, task.id, isCustomScenario(scenario) ? scenario : undefined);
      setSession(next);
      setScenario(next.scenario);
      setTask(next.task);
      setLatestAiText(next.aiText);
      setLatestHint(next.hintZh);
      setTurns([]);
      setDraft("");
      setReport(null);
      setCoachState("asking");
      setScreen("practice");
      setBusy("生成教练语音");

      void api
        .synthesize(next.aiText)
        .then((speechResult) => {
          setSpeech(speechResult);
          playSpeech(speechResult, next.aiText);
        })
        .catch(() => {
          setSpeechNotice("真人 TTS 暂时不可用，可以先开始练习，稍后再重播。");
        })
        .finally(() => setBusy(""));
    } catch {
      setBusy("");
      setCoachState("idle");
      setStartError("无法创建练习任务，请确认本地 API 服务 5174 正常运行后再试。");
    }
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
    setLatestHint(
      transcript.fallback
        ? "当前使用模拟转写，可直接编辑答案后提交。"
        : `转写置信度 ${(transcript.confidence * 100).toFixed(0)}%，可编辑后提交。`
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
      userText: draft
    });
    const speechResult = await api.synthesize(turnResult.aiText);
    setTurns((items) => [
      ...items,
      {
        round: currentRound,
        aiText: latestAiText,
        userText: draft,
        hintZh: turnResult.hintZh,
        correctionPreview: turnResult.correctionPreview,
        transcriptConfidence: 0.93
      }
    ]);
    setLatestAiText(turnResult.aiText);
    setLatestHint(turnResult.hintZh);
    setSpeech(speechResult);
    playSpeech(speechResult, turnResult.aiText);
    setDraft("");
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
          openingQuestion
        }
      ]
    };
    saveCustomScenario(nextScenario);
    setScenarios((items) => [nextScenario, ...items.filter((item) => item.id !== nextScenario.id)]);
    setScenario(nextScenario);
    setTask(nextScenario.tasks[0]);
  }

  function speakWithBrowser(text: string) {
    if (!text) return;
    setSpeechNotice("当前没有可用真人 TTS 音频，临时使用浏览器合成音。");
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis?.speak(utterance);
  }

  function playSpeech(result: SpeechAudioResult | null, text: string) {
    setSpeechNotice("");
    // 优先播放后端返回的真实 TTS 音频（Cartesia/Qwen）；只有 mock 模式才回退浏览器合成音。
    const hasRealAudio = Boolean(result?.audioBase64) && result?.format !== "mock" && !result?.fallback;
    if (!hasRealAudio || !result?.audioBase64) {
      setSpeechAudioSrc("");
      if (result?.provider === "mock" || result?.format === "mock") {
        speakWithBrowser(text);
      } else {
        setSpeechNotice("真人 TTS 音频不可用，请检查 TTS Key 或 provider 配置。");
      }
      return;
    }

    try {
      window.speechSynthesis?.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      setSpeechAudioSrc("");

      const binary = atob(result.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const mime = result.format === "wav" ? "audio/wav" : "audio/mpeg";
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      audioUrlRef.current = url;
      setSpeechAudioSrc(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplaying = () => setSpeechNotice("正在播放真人教练语音。");
      audio.onended = () => setSpeechNotice("");
      audio.onerror = () => setSpeechNotice("真人 TTS 音频解码失败，请重新生成或更换 voice。");
      void audio.play().catch(() => {
        setSpeechNotice("浏览器拦截了自动播放，点击“重播 AI”播放真人教练语音。");
      });
    } catch {
      setSpeechNotice("真人 TTS 音频播放失败，请重新生成或更换 voice。");
    }
  }

  function replaySpeech() {
    playSpeech(speech, latestAiText);
  }

  return (
    <>
      <BrandTopBar />
      <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Speaking Coach · lingo coach</p>
          <h1>
            <span>像每日闯关</span>
            <span>一样练英语口语</span>
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

          <GuideCardGrid onStartPractice={() => setScreen("prep")} />

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

          <BrandGuideSections />
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
            <button className="primary" onClick={startPractice} disabled={Boolean(busy)}>
              <Sparkles size={18} />
              {busy || "开始 5 分钟练习"}
            </button>
            {startError && <div className="hint-line">{startError}</div>}
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
            {speechNotice && <div className="hint-line">{speechNotice}</div>}
            {speech && <div className="hint-line">TTS 状态：{speech.provider} / {speech.format}</div>}
            {speechAudioSrc && (
              <audio
                className="tts-player"
                controls
                src={speechAudioSrc}
                aria-label="AI 教练真人语音播放器"
              />
            )}
          </section>

          <aside className="panel progress-panel">
            <h3>学习路径</h3>
            <p>{task.focus}</p>
            <FlowTracker steps={journeySteps} />
            <div className="latency-card">
              <span>端到端链路</span>
              <strong>ASR -&gt; LLM -&gt; TTS</strong>
              <small>{speech ? `最近 TTS ${speech.durationEstimateSec.toFixed(1)}s / ${speech.provider}` : "提交后展示播报状态"}</small>
            </div>
            <div className="round-list">
              {turns.map((turn) => (
                <div key={turn.round}>
                  <span>Round {turn.round}</span>
                  <p>{turn.userText}</p>
                  {turn.correctionPreview && <small>{turn.correctionPreview}</small>}
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

function isCustomScenario(scenario: Scenario) {
  return scenario.id.startsWith("custom-") || scenario.id.startsWith("custom_");
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
