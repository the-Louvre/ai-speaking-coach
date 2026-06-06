import type { CoachState } from "../../shared/schemas";
import { MascotAvatar } from "./MascotAvatar";

const STATUS_ZH: Record<CoachState, string> = {
  idle: "准备陪你练",
  listening: "正在听你说",
  thinking: "思考你的回答",
  asking: "正在回应你",
  reviewing: "整理练习报告",
  celebrating: "报告已完成"
};

export function CoachAvatar({ state, size }: { state: CoachState; size?: number }) {
  return (
    <div className={`coach-stage coach-${state}`} aria-label={`虚拟教练状态：${state}`}>
      <MascotAvatar state={state} size={size} />
      <div className="coach-status">{STATUS_ZH[state]}</div>
    </div>
  );
}
