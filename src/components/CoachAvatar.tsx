import type { CoachState } from "../../shared/schemas";
import { MascotAvatar } from "./MascotAvatar";

const STATUS_ZH: Record<CoachState, string> = {
  idle: "待机陪练中",
  listening: "正在听你说",
  thinking: "分析回答中",
  asking: "准备追问",
  reviewing: "生成课后点评",
  celebrating: "今日已打卡"
};

export function CoachAvatar({ state, size }: { state: CoachState; size?: number }) {
  return (
    <div className={`coach-stage coach-${state}`} aria-label={`虚拟教练状态：${state}`}>
      <MascotAvatar state={state} size={size} />
      <div className="coach-status">{STATUS_ZH[state]}</div>
    </div>
  );
}
