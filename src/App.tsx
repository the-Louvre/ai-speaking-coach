import {
  Award,
  BadgeCheck,
  CalendarDays,
  Headphones,
  Mic,
  Play,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Square,
  Volume2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoachState, DialogueTurnResult, ReportResult, SpeechAudioResult } from "../shared/schemas";
import type { Scenario } from "../server/data";
import { api, type HealthResult, type SessionStart } from "./api";
import { ApiSettingsPanel } from "./components/ApiSettingsPanel";
import { CoachAvatar } from "./components/CoachAvatar";
import { WeekDots } from "./components/WeekDots";
import { getShanghaiDate, type CheckinState } from "./domain/checkin";
import { completeToday, loadCheckin } from "./storage";

type Screen = "home" | "prep" | "practice" | "report";
type Turn = {
  round: number;
  aiText: string;
  userText: string;
  hintZh?: string;
  correctionPreview?: string;
  transcriptConfidence?: number;
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
  const [report, setReport] = useState<ReportResult | null>(null);
  const [checkin, setCheckin] = useState<CheckinState>(() => loadCheckin());
  const [busy, setBusy] = useState("");
  const [recording, setRecording] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const todayDone = checkin.completedDates.includes(getShanghaiDate());
  const currentRound = turns.length + 1;
  const roundLimit = session?.roundLimit ?? 5;

  useEffect(() => {
    void api.health().then(setHealth).catch(() => null);
    void api
      .scenarios()
      .then((result) => {
        setScenarios(result.scenarios);
        setScenario(result.scenarios[0]);
        setTask(result.scenarios[0].tasks[0]);
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
    const next = await api.startSession(scenario.id, task.id);
    setSession(next);
    setLatestAiText(next.aiText);
    setLatestHint(next.hintZh);
    setTurns([]);
    setDraft("");
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
      turns
    });
    setReport(result);
    setCheckin(completeToday(result.totalScore, result.reportId));
    setCoachState("celebrating");
    setScreen("report");
    setBusy("");
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
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Speaking Coach</p>
          <h1>英语口语场景冲刺</h1>
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

          <div className="panel stats-panel">
            <div className="stat">
              <CalendarDays size={20} />
              <span>{checkin.currentStreak} 天</span>
              <small>连续练习</small>
            </div>
            <div className="stat">
              <Award size={20} />
              <span>{checkin.todayBestScore ?? "--"}</span>
              <small>今日最高分</small>
            </div>
            <WeekDots checkin={checkin} />
          </div>

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
            <h3>任务进度</h3>
            <p>{task.focus}</p>
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
  );
}
