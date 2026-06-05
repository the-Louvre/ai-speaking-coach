import { Check, Clipboard, PackageOpen } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type GuideCardConfig = {
  id: string;
  title: string;
  description: string;
  cta: string;
  color: string;
  variant: "practice" | "speech" | "coach" | "streak" | "report";
  onClick?: () => void;
};

type ColorToken = {
  name: string;
  hex: string;
  rgb: string;
  cmyk: string;
  pms: string;
};

const colorTokens: ColorToken[] = [
  { name: "Feather Green", hex: "#58CC02", rgb: "88 204 2", cmyk: "58 0 96 0", pms: "361 C / 2421 U" },
  { name: "Mask Green", hex: "#89E219", rgb: "137 226 25", cmyk: "42 0 87 0", pms: "368 C / 2293 U" },
  { name: "Macaw", hex: "#1CB0F6", rgb: "28 176 246", cmyk: "81 2 6 0", pms: "306 C / 306 U" },
  { name: "Cardinal", hex: "#FF4B4B", rgb: "255 75 75", cmyk: "0 83 61 0", pms: "1787 C / Red 032 U" },
  { name: "Bee", hex: "#FFC800", rgb: "255 200 0", cmyk: "0 21 93 0", pms: "123 C / 109 U" },
  { name: "Fox", hex: "#FF9600", rgb: "255 150 0", cmyk: "0 47 90 0", pms: "1375 C / 123 U" },
  { name: "Eel", hex: "#4B4B4B", rgb: "75 75 75", cmyk: "3 0 21 88", pms: "418 C / Black 6 U" },
  { name: "Wolf", hex: "#777777", rgb: "119 119 119", cmyk: "5 1 1 68", pms: "Cool Gray 9 C / 418 U" },
  { name: "Hare", hex: "#AFAFAF", rgb: "175 175 175", cmyk: "0 0 3 88", pms: "Cool Gray 5 C / U" },
  { name: "Swan", hex: "#E5E5E5", rgb: "229 229 229", cmyk: "1 1 2 13", pms: "Cool Gray 1 C / U" },
  { name: "Snow", hex: "#FFFFFF", rgb: "255 255 255", cmyk: "0 0 0 0", pms: "-" }
];

export function BrandTopBar() {
  return (
    <div className="brand-top-bar">
      <div className="brand-top-bar-inner">
        <span className="brand-mark">lingo coach</span>
        <span className="brand-top-note">AI English speaking practice</span>
      </div>
    </div>
  );
}

export function GuideCardGrid({
  onStartPractice
}: {
  onStartPractice: () => void;
}) {
  const cards: GuideCardConfig[] = [
    {
      id: "practice",
      title: "scenes",
      description: "支持面试、点餐、会议和自定义场景，先定目标再进入真实对话。",
      cta: "PICK SCENE",
      color: "var(--feather-green)",
      variant: "practice",
      onClick: onStartPractice
    },
    {
      id: "speech",
      title: "voice",
      description: "ASR -> LLM -> TTS 串成端到端语音链路，保留延迟和 fallback 状态。",
      cta: "VOICE FLOW",
      color: "var(--macaw)",
      variant: "speech"
    },
    {
      id: "coach",
      title: "coach",
      description: "虚拟教练按倾听、思考、追问、评价切状态，让多轮对话更自然。",
      cta: "MEET COACH",
      color: "var(--purple)",
      variant: "coach"
    },
    {
      id: "feedback",
      title: "feedback",
      description: "用转写置信度、低置信词和 rubric 聚合发音评测、语法和表达纠错。",
      cta: "CHECK GROWTH",
      color: "var(--bee)",
      variant: "streak"
    },
    {
      id: "report",
      title: "summary",
      description: "课后报告沉淀五维评分、逐句纠错、推荐表达和下一轮学习目标。",
      cta: "VIEW REPORT",
      color: "var(--coral)",
      variant: "report"
    }
  ];

  return (
    <section className="guide-card-grid" aria-label="口语陪练功能导航">
      {cards.map((card) => (
        <GuideCard key={card.id} card={card} />
      ))}
      <div className="guide-card-empty" aria-hidden="true" />
    </section>
  );
}

function GuideCard({ card }: { card: GuideCardConfig }) {
  return (
    <button
      className="guide-card"
      style={{ backgroundColor: card.color }}
      onClick={card.onClick}
      type="button"
      aria-label={`${card.title}: ${card.cta}`}
    >
      <span className="guide-card-title">{card.title}</span>
      <span className="guide-card-description">{card.description}</span>
      <span className="guide-card-cta">
        {card.cta}
        <span aria-hidden="true">-&gt;</span>
      </span>
      <GuideIllustration variant={card.variant} />
    </button>
  );
}

function GuideIllustration({ variant }: { variant: GuideCardConfig["variant"] }) {
  if (variant === "practice") {
    return (
      <svg className="guide-illustration practice-sketch" viewBox="0 0 220 170" aria-hidden="true">
        <path d="M36 124c20-54 54-84 102-92 29-5 50 2 63 20" />
        <path d="M60 102c20-28 45-44 76-48 19-2 34 1 45 10" />
        <circle cx="65" cy="70" r="18" />
        <circle cx="138" cy="48" r="13" />
        <path d="M37 126c36 12 79 7 128-16" />
      </svg>
    );
  }

  if (variant === "speech") {
    return (
      <svg className="guide-illustration book-stack" viewBox="0 0 230 170" aria-hidden="true">
        <rect x="72" y="92" width="116" height="26" rx="8" fill="#FFC800" />
        <rect x="56" y="66" width="122" height="26" rx="8" fill="#CE82FF" />
        <rect x="88" y="40" width="104" height="26" rx="8" fill="#FF9600" />
        <rect x="112" y="16" width="70" height="28" rx="9" fill="#58CC02" />
        <path d="M92 105h74M76 78h72M112 52h56" />
      </svg>
    );
  }

  if (variant === "coach") {
    return (
      <svg className="guide-illustration people-row" viewBox="0 0 230 170" aria-hidden="true">
        <circle cx="70" cy="66" r="26" fill="#F6B48C" />
        <circle cx="126" cy="50" r="30" fill="#8D5A42" />
        <circle cx="174" cy="74" r="24" fill="#FFD4B8" />
        <path d="M39 142c8-28 27-42 57-42s49 14 57 42" fill="#58CC02" />
        <path d="M91 143c6-36 29-55 68-55 33 0 55 18 66 55" fill="#1CB0F6" />
        <path d="M139 144c7-24 24-36 50-36 24 0 40 12 48 36" fill="#FFC800" />
      </svg>
    );
  }

  if (variant === "streak") {
    return (
      <svg className="guide-illustration city-board" viewBox="0 0 230 170" aria-hidden="true">
        <rect x="55" y="48" width="118" height="78" rx="18" fill="#FFFFFF" />
        <rect x="72" y="66" width="82" height="12" rx="6" fill="#58CC02" />
        <rect x="72" y="88" width="62" height="12" rx="6" fill="#1CB0F6" />
        <path d="M76 126v28M154 126v28M34 154h166" />
        <path d="M189 78h20v76h-20zM22 98h24v56H22z" fill="#FF9600" />
      </svg>
    );
  }

  return (
    <svg className="guide-illustration resource-box" viewBox="0 0 230 170" aria-hidden="true">
      <path d="M53 76h124l-16 78H69z" fill="#FFC800" />
      <path d="M53 76l33-34h124l-33 34z" fill="#FF9600" />
      <path d="M177 76l33-34-16 78-33 34z" fill="#CE82FF" />
      <rect x="86" y="22" width="58" height="44" rx="10" fill="#FFFFFF" />
      <path d="M98 42h34M98 54h24" />
    </svg>
  );
}

export function BrandGuideSections() {
  return (
    <div className="brand-guide-stack">
      <IllustrationShowcase />
      <LogoGuidelines />
      <TypographyGuidelines />
      <ColorPalette />
      <Footer />
    </div>
  );
}

function SectionHeader({
  label,
  title,
  description
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-header">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function IllustrationShowcase() {
  return (
    <section className="brand-section illustration-showcase" aria-labelledby="illustration-title">
      <SectionHeader
        label="Illustration"
        title="Friendly characters for a global learning world"
        description="Use simple shapes, bold colors, and expressive poses to create approachable moments across every product touchpoint."
      />
      <div className="people-stage" aria-hidden="true">
        <FlatPerson skin="#F0B88D" shirt="#58CC02" pants="#1CB0F6" hair="#2E2E2E" height={150} />
        <FlatPerson skin="#8D5A42" shirt="#CE82FF" pants="#4B4B4B" hair="#1F1F1F" height={176} />
        <FlatPerson skin="#FFD4B8" shirt="#FFC800" pants="#58CC02" hair="#D46B2D" height={138} />
        <FlatPerson skin="#B97753" shirt="#1CB0F6" pants="#FF9600" hair="#111111" height={164} />
        <FlatPerson skin="#F6C7A8" shirt="#FF7A7A" pants="#CE82FF" hair="#5A321F" height={154} />
        <FlatPerson skin="#C88A65" shirt="#89E219" pants="#4B4B4B" hair="#262626" height={168} />
        <FlatPerson skin="#E8A982" shirt="#FF9600" pants="#1CB0F6" hair="#6B3A20" height={145} />
      </div>
    </section>
  );
}

function FlatPerson({
  skin,
  shirt,
  pants,
  hair,
  height
}: {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  height: number;
}) {
  return (
    <svg className="flat-person" width="92" height={height} viewBox={`0 0 92 ${height}`} aria-hidden="true">
      <circle cx="46" cy="30" r="22" fill={skin} />
      <path d="M25 30c3-19 17-28 36-23 10 3 17 11 19 23-14-8-34-8-55 0z" fill={hair} />
      <path d="M22 84c4-23 17-35 39-35 17 0 27 12 31 35H22z" fill={shirt} />
      <path d="M31 83h17v56H31zM55 83h17v56H55z" fill={pants} />
      <circle cx="38" cy="31" r="3" fill="#2C2C2C" />
      <circle cx="55" cy="31" r="3" fill="#2C2C2C" />
      <path d="M38 42c6 5 13 5 19 0" fill="none" stroke="#2C2C2C" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function LogoGuidelines() {
  return (
    <section className="brand-section logo-guidelines">
      <div>
        <p className="section-label">Logo Usage</p>
        <h2>Keep the coach unmistakable</h2>
        <p>
          Clear space keeps the wordmark confident. Use consistent spacing, alignment, and scale relationships to keep
          the brand recognizable across every surface.
        </p>
      </div>
      <div className="logo-board" aria-label="lingo coach logo clear space guide">
        <span className="wordmark">lingo coach</span>
        <span className="guide-line guide-cap" />
        <span className="guide-line guide-x" />
        <span className="guide-line guide-base" />
        <span className="guide-line guide-left" />
        <span className="guide-line guide-right" />
        <span className="guide-label label-x">X</span>
        <span className="guide-label label-y">Y</span>
        <span className="guide-label label-half">1/2Y</span>
      </div>
    </section>
  );
}

function TypographyGuidelines() {
  return (
    <section className="brand-section typography-guidelines">
      <TypographyRow label="Long headlines">
        <p className="type-long">In a world of language barriers, you're building language bridges.</p>
      </TypographyRow>
      <TypographyRow label="Supporting Feather Bold">
        <p className="type-word">wanted</p>
        <p className="type-support">
          Door openers. Boundary pushers. Dial movers.
          <br />
          Planet shrinkers. Language liberators.
        </p>
      </TypographyRow>
      <TypographyRow label="Sub-headings and body copy">
        <p className="type-subhead">WHERE WILL LINGO TAKE YOU?</p>
        <p className="type-body">
          From a student learning a new language to speak with family, to the traveler preparing for a new city, our
          learning world makes language feel fast, fun, and effective — something to enjoy, not endure.
        </p>
      </TypographyRow>
    </section>
  );
}

function TypographyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="type-row">
      <div className="type-label">{label}</div>
      <div className="type-content">{children}</div>
    </div>
  );
}

function ColorPalette() {
  return (
    <section className="color-palette">
      <SectionHeader
        label="Color Palette"
        title="Bright, useful colors for a friendly learning experience."
        description="Use green as the primary brand color, supported by expressive accent colors and neutral grays."
      />
      <div className="color-grid">
        {colorTokens.map((token) => (
          <ColorCard key={token.hex} token={token} />
        ))}
      </div>
    </section>
  );
}

function ColorCard({ token }: { token: ColorToken }) {
  const [copied, setCopied] = useState(false);

  async function copyHex() {
    await navigator.clipboard?.writeText(token.hex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="color-card">
      <div className="color-swatch" style={{ backgroundColor: token.hex }} />
      <div className="color-card-header">
        <div>
          <h3>{token.name}</h3>
          <p>{token.hex}</p>
        </div>
        <button type="button" className="copy-button" onClick={copyHex} aria-label={`复制 ${token.name} Hex`}>
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <dl className="color-meta">
        <div>
          <dt>Hex</dt>
          <dd>{token.hex}</dd>
        </div>
        <div>
          <dt>RGB</dt>
          <dd>{token.rgb}</dd>
        </div>
        <div>
          <dt>CMYK</dt>
          <dd>{token.cmyk}</dd>
        </div>
        <div>
          <dt>PMS</dt>
          <dd>{token.pms}</dd>
        </div>
      </dl>
    </article>
  );
}

function Footer() {
  return (
    <footer className="brand-footer">
      <PackageOpen size={22} />
      <span>lingo coach brand kit for the AI Speaking Coach demo.</span>
    </footer>
  );
}
