import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type RuntimeSettingsResult } from "../api";

type SettingsForm = {
  apiMode: "mock" | "live";
  providerPreset: string;
  asrProvider: string;
  asrApiKey: string;
  llmProvider: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  ttsProvider: string;
  ttsApiKey: string;
  ttsVersion: string;
  ttsModel: string;
  ttsVoiceId: string;
  pronunciationProvider: string;
};

const PRESET_DEFAULTS: Record<string, Partial<SettingsForm>> = {
  "china-qwen": {
    asrProvider: "mock",
    llmProvider: "qwen",
    llmBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    llmModel: "qwen-plus",
    ttsProvider: "mock",
    ttsVersion: "",
    ttsModel: "mock",
    pronunciationProvider: "rule"
  },
  "global-mixed": {
    asrProvider: "deepgram",
    llmProvider: "openai",
    llmBaseUrl: "",
    llmModel: "gpt-4o-mini",
    ttsProvider: "cartesia",
    ttsVersion: "2026-03-01",
    ttsModel: "sonic-latest",
    pronunciationProvider: "rule"
  },
  custom: {}
};

const PRESETS = [
  {
    id: "china-qwen",
    title: "国内初跑",
    description: "通义千问负责对话和报告，语音先用 mock 兜底。"
  },
  {
    id: "global-mixed",
    title: "海外混合",
    description: "Deepgram + OpenAI + Cartesia，保留原始演示路线。"
  },
  {
    id: "custom",
    title: "自定义",
    description: "手动替换 ASR / LLM / TTS provider 和模型。"
  }
];

const ASR_OPTIONS = [
  ["mock", "Mock 演示转写"],
  ["deepgram", "Deepgram Nova-3"],
  ["aliyun-isi", "阿里云智能语音"],
  ["iflytek", "讯飞语音识别"]
];

const LLM_OPTIONS = [
  ["qwen", "通义千问 / 百炼"],
  ["doubao", "火山方舟 / 豆包"],
  ["kimi", "Kimi / Moonshot"],
  ["openai", "OpenAI"],
  ["custom-openai-compatible", "自定义兼容接口"]
];

const TTS_OPTIONS = [
  ["mock", "Mock 播放状态"],
  ["cartesia", "Cartesia Sonic"],
  ["aliyun-isi", "阿里云语音合成"],
  ["iflytek", "讯飞语音合成"]
];

const PRONUNCIATION_OPTIONS = [
  ["rule", "规则聚合评分"],
  ["iflytek", "讯飞语音评测"]
];

function createForm(settings: RuntimeSettingsResult | null): SettingsForm {
  return {
    apiMode: settings?.mode ?? "mock",
    providerPreset: settings?.editable.providerPreset ?? "china-qwen",
    asrProvider: settings?.editable.asrProvider ?? "mock",
    asrApiKey: "",
    llmProvider: settings?.editable.llmProvider ?? "qwen",
    llmApiKey: "",
    llmBaseUrl: settings?.editable.llmBaseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    llmModel: settings?.editable.llmModel ?? "qwen-plus",
    ttsProvider: settings?.editable.ttsProvider ?? "mock",
    ttsApiKey: "",
    ttsVersion: settings?.editable.ttsVersion ?? "",
    ttsModel: settings?.editable.ttsModel ?? "mock",
    ttsVoiceId: settings?.editable.ttsVoiceId ?? "",
    pronunciationProvider: settings?.editable.pronunciationProvider ?? "rule"
  };
}

function statusText(status?: string) {
  if (status === "ready") return "可用";
  if (status === "planned") return "已预留";
  if (status === "missing-key") return "缺少 Key";
  return "未检测";
}

function optionLabel(options: string[][], value: string) {
  return options.find(([id]) => id === value)?.[1] ?? value;
}

export function ApiSettingsPanel({
  open,
  onClose,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (settings: RuntimeSettingsResult) => void;
}) {
  const [settings, setSettings] = useState<RuntimeSettingsResult | null>(null);
  const [form, setForm] = useState<SettingsForm>(() => createForm(null));
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("读取当前 API 配置");
    void api
      .settings()
      .then((result) => {
        setSettings(result);
        setForm(createForm(result));
        setStatus("");
      })
      .catch(() => setStatus("无法读取配置，确认本地 API 服务是否运行。"));
  }, [open]);

  if (!open) return null;

  function choosePreset(preset: string) {
    setForm((current) => ({
      ...current,
      ...PRESET_DEFAULTS[preset],
      providerPreset: preset
    }));
  }

  async function saveSettings() {
    setStatus("保存配置中");
    const result = await api.updateSettings(form);
    setSettings(result);
    setForm(createForm(result));
    onSaved(result);
    setStatus("已保存到本地后端内存，密钥未写入浏览器。");
  }

  const providerItems = [
    {
      label: "ASR",
      value: optionLabel(ASR_OPTIONS, settings?.providers.asr.provider ?? form.asrProvider),
      status: settings?.providers.asr.status
    },
    {
      label: "LLM",
      value: `${optionLabel(LLM_OPTIONS, settings?.providers.llm.provider ?? form.llmProvider)} / ${
        settings?.providers.llm.model ?? form.llmModel
      }`,
      status: settings?.providers.llm.status
    },
    {
      label: "TTS",
      value: optionLabel(TTS_OPTIONS, settings?.providers.tts.provider ?? form.ttsProvider),
      status: settings?.providers.tts.status
    },
    {
      label: "Pron.",
      value: optionLabel(
        PRONUNCIATION_OPTIONS,
        settings?.providers.pronunciation.provider ?? form.pronunciationProvider
      ),
      status: settings?.providers.pronunciation.status
    }
  ];

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="API 配置">
      <section className="settings-panel panel">
        <div className="settings-header">
          <div>
            <p className="eyebrow">Local API Settings</p>
            <h2>API 配置</h2>
          </div>
          <button className="ghost icon-only" onClick={onClose} aria-label="关闭 API 配置">
            <X size={18} />
          </button>
        </div>

        <div className="mode-switch" role="group" aria-label="API 模式">
          <button
            className={form.apiMode === "mock" ? "selected" : ""}
            onClick={() => setForm((current) => ({ ...current, apiMode: "mock" }))}
          >
            Mock 演示
          </button>
          <button
            className={form.apiMode === "live" ? "selected" : ""}
            onClick={() => setForm((current) => ({ ...current, apiMode: "live" }))}
          >
            Live API
          </button>
        </div>

        <div className="preset-grid" aria-label="Provider 预设">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={form.providerPreset === preset.id ? "preset-card selected" : "preset-card"}
              onClick={() => choosePreset(preset.id)}
            >
              <strong>{preset.title}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="provider-status">
          {providerItems.map((item) => (
            <span key={item.label} className={item.status === "ready" ? "ready" : ""}>
              {item.label}: {item.value} · {statusText(item.status)}
            </span>
          ))}
        </div>

        <div className="settings-section-title">
          <span>三段式链路</span>
          <small>ASR → LLM → TTS，可先只让国内 LLM 进入 live。</small>
        </div>

        <div className="settings-grid">
          <label>
            ASR Provider
            <select
              value={form.asrProvider}
              onChange={(event) =>
                setForm((current) => ({ ...current, asrProvider: event.target.value, providerPreset: "custom" }))
              }
            >
              {ASR_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ASR API Key
            <input
              type="password"
              autoComplete="off"
              value={form.asrApiKey}
              placeholder="留空则保持当前后端配置"
              onChange={(event) => setForm((current) => ({ ...current, asrApiKey: event.target.value }))}
            />
          </label>
          <label>
            LLM Provider
            <select
              value={form.llmProvider}
              onChange={(event) =>
                setForm((current) => ({ ...current, llmProvider: event.target.value, providerPreset: "custom" }))
              }
            >
              {LLM_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            LLM API Key
            <input
              type="password"
              autoComplete="off"
              value={form.llmApiKey}
              placeholder="DASHSCOPE_API_KEY / ARK_API_KEY / MOONSHOT_API_KEY"
              onChange={(event) => setForm((current) => ({ ...current, llmApiKey: event.target.value }))}
            />
          </label>
          <label>
            LLM Base URL
            <input
              value={form.llmBaseUrl}
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              onChange={(event) => setForm((current) => ({ ...current, llmBaseUrl: event.target.value }))}
            />
          </label>
          <label>
            LLM Model
            <input
              value={form.llmModel}
              onChange={(event) => setForm((current) => ({ ...current, llmModel: event.target.value }))}
            />
          </label>
          <label>
            TTS Provider
            <select
              value={form.ttsProvider}
              onChange={(event) =>
                setForm((current) => ({ ...current, ttsProvider: event.target.value, providerPreset: "custom" }))
              }
            >
              {TTS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            TTS API Key
            <input
              type="password"
              autoComplete="off"
              value={form.ttsApiKey}
              placeholder="留空则保持当前后端配置"
              onChange={(event) => setForm((current) => ({ ...current, ttsApiKey: event.target.value }))}
            />
          </label>
          <label>
            TTS Model
            <input
              value={form.ttsModel}
              onChange={(event) => setForm((current) => ({ ...current, ttsModel: event.target.value }))}
            />
          </label>
          <label>
            TTS Voice ID
            <input
              value={form.ttsVoiceId}
              placeholder="语音 provider 需要时再填"
              onChange={(event) => setForm((current) => ({ ...current, ttsVoiceId: event.target.value }))}
            />
          </label>
          <label>
            TTS Version
            <input
              value={form.ttsVersion}
              placeholder="Cartesia 等 provider 使用"
              onChange={(event) => setForm((current) => ({ ...current, ttsVersion: event.target.value }))}
            />
          </label>
          <label>
            发音评测
            <select
              value={form.pronunciationProvider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  pronunciationProvider: event.target.value,
                  providerPreset: "custom"
                }))
              }
            >
              {PRONUNCIATION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="settings-note">
          国内初跑默认使用通义千问 / 百炼 OpenAI 兼容接口。密钥只发送到本地 Node API 的运行时内存，不写入仓库，也不保存到浏览器。刷新后如需持久化，请使用 `.env.local`。
        </p>

        <div className="settings-actions">
          <span>{status}</span>
          <button className="primary" onClick={saveSettings}>
            <Settings size={18} />
            保存配置
          </button>
        </div>
      </section>
    </div>
  );
}
