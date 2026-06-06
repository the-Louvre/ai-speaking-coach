import { BarChart3, BookOpenCheck, MessageSquareText, Mic2, RotateCcw, Target, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { ConversationTurn, ReportResult, SentenceAnalysis } from "../../shared/schemas";
import type { Scenario } from "../../server/data";
import { createReportDiagnostics } from "../reportDiagnostics";

type ReportDashboardProps = {
  report: ReportResult;
  conversationTurns: ConversationTurn[];
  scenario: Scenario;
  targetGoal: string;
  onChangeTask: () => void;
  onPracticeAgain: () => void;
};

type ReportModal = "none" | "dialogue" | "expression" | "pronunciation" | "drill";

export function ReportDashboard({
  report,
  conversationTurns,
  scenario,
  targetGoal,
  onChangeTask,
  onPracticeAgain
}: ReportDashboardProps) {
  const [modal, setModal] = useState<ReportModal>("none");
  const diagnostics = useMemo(
    () => createReportDiagnostics(report, conversationTurns, targetGoal),
    [conversationTurns, report, targetGoal]
  );
  const primaryAnalysis = diagnostics.primaryAnalysis;
  const weakest = diagnostics.weakestDimension;
  const strongest = diagnostics.strongestDimension;

  return (
    <section className="one-report" aria-label="课后报告">
      <div className="one-report-hero">
        <div className="one-score-block">
          <span className="one-score-num">{report.totalScore}</span>
          <span className="one-score-denom">/ 100</span>
        </div>
        <div className="one-report-diagnosis">
          <span className="eyebrow">本次练习 · {scenario.nameZh}</span>
          <h2>{report.coachCommentZh}</h2>
          <div className="one-report-meta">
            <span>完成目标：{targetGoal}</span>
            <span>本次最该补强：{weakest?.labelZh ?? "表达细节"}</span>
            <span>最稳能力：{strongest?.labelZh ?? "任务完成"}</span>
          </div>
        </div>
        <div className="one-report-actions" aria-label="报告操作">
          <button className="secondary" onClick={onChangeTask}>
            换个任务
          </button>
          <button className="primary" onClick={onPracticeAgain}>
            <RotateCcw size={17} />
            再练一轮
          </button>
        </div>
      </div>

      <div className="one-report-body">
        <aside className="report-ability-panel">
          <div className="report-panel-head">
            <BarChart3 size={18} />
            <div>
              <span className="eyebrow">能力诊断</span>
              <h3>七维能力</h3>
            </div>
          </div>

          <div className="ability-compact-list">
            {report.dimensions.map((dimension) => (
              <div className="ability-compact-row" key={dimension.id}>
                <div>
                  <span>{dimension.labelZh}</span>
                  <strong>{dimension.score}</strong>
                </div>
                <div className="dim-bar">
                  <i style={{ width: `${dimension.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          <AbilityRadar dimensions={report.dimensions} />

          <div className="ability-summary">
            <p>
              <strong>优势：</strong>
              {strongest?.labelZh ?? "任务完成"}保持得不错。
            </p>
            <p>
              <strong>短板：</strong>
              {weakest?.labelZh ?? "表达细节"}需要下一轮优先打磨。
            </p>
          </div>
        </aside>

        <section className="report-correction-panel">
          <div className="report-panel-head">
            <MessageSquareText size={18} />
            <div>
              <span className="eyebrow">对话纠错</span>
              <h3>本次最值得改的表达</h3>
            </div>
          </div>

          <div className="evidence-stack">
            {diagnostics.evidenceTurns.slice(0, 3).map((turn) => (
              <article className="evidence-card" key={`${turn.text}-${turn.reasonZh}`}>
                <span>用户原话</span>
                <p>{turn.text}</p>
                <small>{turn.reasonZh}</small>
              </article>
            ))}
          </div>

          {primaryAnalysis ? (
            <CorrectionAnalysis analysis={primaryAnalysis} />
          ) : (
            <p className="muted">本次报告暂无可展示的逐句纠错。</p>
          )}

          {diagnostics.sentenceAnalyses.length > 1 && (
            <div className="secondary-corrections">
              {diagnostics.sentenceAnalyses.slice(1, 3).map((analysis) => (
                <article className="mini-fix" key={analysis.original}>
                  <span>{analysis.issueType}</span>
                  <p>{analysis.original}</p>
                  <strong>{analysis.improved}</strong>
                </article>
              ))}
            </div>
          )}

          <button className="text-button" onClick={() => setModal("dialogue")}>
            查看完整对话
          </button>
        </section>

        <aside className="report-guidance-panel">
          <div className="report-panel-head">
            <Target size={18} />
            <div>
              <span className="eyebrow">提升指导</span>
              <h3>下一步怎么练</h3>
            </div>
          </div>

          <GuidanceButton
            icon={<BookOpenCheck size={18} />}
            title="表达优化"
            summary="减少 maybe / things，先说结果，再补数字"
            action="查看"
            onClick={() => setModal("expression")}
          />
          <GuidanceButton
            icon={<Mic2 size={18} />}
            title="发音技巧"
            summary="重音、连读、弱读、句尾语调"
            action="查看"
            onClick={() => setModal("pronunciation")}
          />
          <GuidanceButton
            icon={<RotateCcw size={18} />}
            title="推荐重练句"
            summary={diagnostics.nextPractice.targetSentence}
            action="开始"
            onClick={() => setModal("drill")}
          />

          <div className="report-summary-note">
            <span className="eyebrow">总评</span>
            <p>{report.summaryZh}</p>
          </div>
        </aside>
      </div>

      <ReportModalView
        modal={modal}
        report={report}
        turns={conversationTurns}
        diagnostics={diagnostics}
        onClose={() => setModal("none")}
        onPracticeAgain={onPracticeAgain}
      />
    </section>
  );
}

function CorrectionAnalysis({ analysis }: { analysis: SentenceAnalysis }) {
  return (
    <article className="primary-fix">
      <div className="fix-label-row">
        <span>{analysis.issueType}</span>
        <strong>{analysis.explanationZh}</strong>
      </div>
      <div className="fix-compare">
        <div>
          <span>Original</span>
          <p>{renderHighlightedText(analysis.original, analysis.highlights.map((item) => item.originalText), "report-diff-bad")}</p>
        </div>
        <div>
          <span>Better</span>
          <p>{renderHighlightedText(analysis.improved, analysis.highlights.map((item) => item.improvedText), "report-diff-good")}</p>
        </div>
      </div>
      <div className="phrase-diff-list">
        {analysis.highlights.map((highlight) => (
          <div className="phrase-diff" key={`${highlight.originalText}-${highlight.improvedText}`}>
            <div>
              <span className="report-diff-bad">{highlight.originalText}</span>
              <span className="diff-arrow">to</span>
              <span className="report-diff-good">{highlight.improvedText}</span>
            </div>
            <p>{highlight.reasonZh}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function GuidanceButton({
  icon,
  title,
  summary,
  action,
  onClick
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button className="report-guide-button" onClick={onClick}>
      <span className="guide-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      <em>{action}</em>
    </button>
  );
}

function ReportModalView({
  modal,
  report,
  turns,
  diagnostics,
  onClose,
  onPracticeAgain
}: {
  modal: ReportModal;
  report: ReportResult;
  turns: ConversationTurn[];
  diagnostics: ReturnType<typeof createReportDiagnostics>;
  onClose: () => void;
  onPracticeAgain: () => void;
}) {
  if (modal === "none") return null;

  const titleMap: Record<Exclude<ReportModal, "none">, string> = {
    dialogue: "完整对话",
    expression: "表达优化",
    pronunciation: "发音技巧",
    drill: "推荐重练句"
  };

  return (
    <div className="report-modal-backdrop" role="presentation">
      <div className="report-modal-card" role="dialog" aria-modal="true" aria-label={titleMap[modal]}>
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
        <span className="eyebrow">课后诊断</span>
        <h3>{titleMap[modal]}</h3>

        {modal === "dialogue" && <DialogueModal turns={turns} />}
        {modal === "expression" && <ExpressionModal report={report} diagnostics={diagnostics} />}
        {modal === "pronunciation" && <PronunciationModal diagnostics={diagnostics} />}
        {modal === "drill" && <DrillModal diagnostics={diagnostics} onPracticeAgain={onPracticeAgain} />}
      </div>
    </div>
  );
}

function DialogueModal({ turns }: { turns: ConversationTurn[] }) {
  if (!turns.length) return <p className="muted">本次暂无完整对话记录。</p>;

  return (
    <div className="modal-dialogue-list">
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

function ExpressionModal({
  report,
  diagnostics
}: {
  report: ReportResult;
  diagnostics: ReturnType<typeof createReportDiagnostics>;
}) {
  const analysis = diagnostics.primaryAnalysis;
  return (
    <div className="modal-section-stack">
      <section>
        <strong>本次问题</strong>
        <p>{analysis?.explanationZh || "回答能完成任务，但表达还可以更具体、更像真实面试复盘。"}</p>
      </section>
      <section>
        <strong>推荐结构</strong>
        <p>{"Result -> Action -> Evidence：先说结果，再说你做了什么，最后补一个数字或用户影响。"}</p>
      </section>
      <section>
        <strong>可替换表达</strong>
        <ul>
          {report.suggestions.slice(0, 3).map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PronunciationModal({ diagnostics }: { diagnostics: ReturnType<typeof createReportDiagnostics> }) {
  return (
    <div className="modal-section-stack">
      {diagnostics.pronunciationTips.map((tip) => (
        <section key={tip.wordOrPhrase}>
          <strong>{tip.wordOrPhrase}</strong>
          <p>{tip.issueZh}</p>
          <p>{tip.tipZh}</p>
          <small>{tip.example}</small>
        </section>
      ))}
    </div>
  );
}

function DrillModal({
  diagnostics,
  onPracticeAgain
}: {
  diagnostics: ReturnType<typeof createReportDiagnostics>;
  onPracticeAgain: () => void;
}) {
  const nextPractice = diagnostics.nextPractice;
  return (
    <div className="modal-section-stack">
      <section className="target-sentence-box">
        <strong>Target sentence</strong>
        <p>{nextPractice.targetSentence}</p>
      </section>
      <section>
        <strong>Chunk 练习</strong>
        <div className="chunk-list">
          {nextPractice.chunks.map((chunk, index) => (
            <span key={`${chunk}-${index}`}>{chunk}</span>
          ))}
        </div>
      </section>
      <section>
        <strong>训练步骤</strong>
        <ul>
          {nextPractice.drills.map((drill) => (
            <li key={drill}>{drill}</li>
          ))}
        </ul>
      </section>
      <button className="primary" onClick={onPracticeAgain}>
        用这句再练一轮
      </button>
    </div>
  );
}

function AbilityRadar({ dimensions }: { dimensions: ReportResult["dimensions"] }) {
  const size = 190;
  const center = size / 2;
  const maxRadius = 60;
  const angleStep = (Math.PI * 2) / dimensions.length;
  const points = dimensions.map((dimension, index) => {
    const angle = -Math.PI / 2 + angleStep * index;
    const radius = (dimension.score / 100) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  });
  const grid = [0.34, 0.68, 1].map((scale) =>
    dimensions
      .map((_, index) => {
        const angle = -Math.PI / 2 + angleStep * index;
        return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
      })
      .join(" ")
  );

  return (
    <div className="radar-wrap compact">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="七维口语评分雷达图">
        {grid.map((polygon) => (
          <polygon className="radar-grid" key={polygon} points={polygon} />
        ))}
        {dimensions.map((dimension, index) => {
          const angle = -Math.PI / 2 + angleStep * index;
          const x = center + Math.cos(angle) * (maxRadius + 22);
          const y = center + Math.sin(angle) * (maxRadius + 22);
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
                {dimension.labelZh.replace("度", "").replace("表达", "")}
              </text>
            </g>
          );
        })}
        <polygon className="radar-score" points={points.join(" ")} />
      </svg>
    </div>
  );
}

function renderHighlightedText(text: string, phrases: string[], className: string) {
  const validPhrases = phrases.filter(Boolean);
  if (!validPhrases.length) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  validPhrases.forEach((phrase, index) => {
    const found = text.indexOf(phrase, cursor);
    if (found === -1) return;
    if (found > cursor) nodes.push(text.slice(cursor, found));
    nodes.push(
      <mark className={className} key={`${phrase}-${index}`}>
        {phrase}
      </mark>
    );
    cursor = found + phrase.length;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes.length ? nodes : text;
}
