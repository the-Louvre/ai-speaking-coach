import type { CoachState } from "../../shared/schemas";

export function CoachAvatar({ state }: { state: CoachState }) {
  return (
    <div className={`coach-stage coach-${state}`} aria-label={`虚拟教练状态：${state}`}>
      <div className="coach-aura" />
      <div className="coach-figure">
        <div className="coach-hair" />
        <div className="coach-face">
          <span className="eye left" />
          <span className="eye right" />
          <span className="mouth" />
        </div>
        <div className="coach-jacket" />
      </div>
      <div className="coach-status">
        {state === "listening" && "正在听你说"}
        {state === "thinking" && "分析回答中"}
        {state === "asking" && "准备追问"}
        {state === "reviewing" && "生成课后点评"}
        {state === "celebrating" && "今日已打卡"}
        {state === "idle" && "待机陪练中"}
      </div>
    </div>
  );
}
