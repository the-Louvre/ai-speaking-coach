import type { CoachState } from "../../shared/schemas";

// P0 SVG mascot. Keep the public surface narrow so it can be replaced by Lottie later.
export function MascotAvatar({ state, size = 220 }: { state: CoachState; size?: number }) {
  const speaking = state === "asking";
  const listening = state === "listening";
  const thinking = state === "thinking";

  return (
    <div
      className={`mascot mascot-${state}`}
      style={{ width: size, height: size }}
      aria-label={`虚拟教练状态：${state}`}
    >
      <svg viewBox="0 0 150 180" width={size} height={size} role="img">
        <ellipse cx="75" cy="172" rx="48" ry="6" fill="#E5E5E5" />
        <ellipse cx="75" cy="138" rx="38" ry="32" fill="#58CC02" />
        <circle cx="75" cy="78" r="46" fill="#89E219" />
        <ellipse cx="58" cy="78" rx="13" ry="15" fill="#fff" />
        <ellipse cx="92" cy="78" rx="13" ry="15" fill="#fff" />
        <circle cx={listening ? 60 : 60} cy={thinking ? 76 : 80} r="6.5" fill="#3a3a3a" />
        <circle cx={listening ? 90 : 90} cy={thinking ? 76 : 80} r="6.5" fill="#3a3a3a" />
        <circle cx="62" cy="77.5" r="2" fill="#fff" />
        <circle cx="92" cy="77.5" r="2" fill="#fff" />
        <ellipse cx="75" cy="98" rx="8" ry="5" fill="#FF9600" />
        {speaking ? (
          <ellipse cx="75" cy="110" rx="9" ry="7" fill="#fff" />
        ) : (
          <path d="M60 108 q15 12 30 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
        <circle cx="50" cy="96" r="5" fill="rgba(255,255,255,.5)" />
        <circle cx="100" cy="96" r="5" fill="rgba(255,255,255,.5)" />
      </svg>
    </div>
  );
}
