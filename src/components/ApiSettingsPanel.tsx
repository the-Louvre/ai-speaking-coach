import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type RuntimeSettingsResult } from "../api";

type SettingsForm = {
  apiMode: "mock" | "live";
  deepgramApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  cartesiaApiKey: string;
  cartesiaVersion: string;
  cartesiaModel: string;
  cartesiaVoiceId: string;
};

function createForm(settings: RuntimeSettingsResult | null): SettingsForm {
  return {
    apiMode: settings?.mode ?? "mock",
    deepgramApiKey: "",
    openaiApiKey: "",
    openaiModel: settings?.editable.openaiModel ?? "gpt-4o-mini",
    cartesiaApiKey: "",
    cartesiaVersion: settings?.editable.cartesiaVersion ?? "2026-03-01",
    cartesiaModel: settings?.editable.cartesiaModel ?? "sonic-latest",
    cartesiaVoiceId: settings?.editable.cartesiaVoiceId ?? ""
  };
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

  async function saveSettings() {
    setStatus("保存配置中");
    const result = await api.updateSettings(form);
    setSettings(result);
    setForm(createForm(result));
    onSaved(result);
    setStatus("已保存到本地后端内存，密钥未写入浏览器。");
  }

  const providerItems = [
    ["Deepgram ASR", settings?.providers.deepgram.configured],
    ["OpenAI LLM", settings?.providers.openai.configured],
    ["Cartesia TTS", settings?.providers.cartesia.configured]
  ] as const;

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

        <div className="provider-status">
          {providerItems.map(([label, configured]) => (
            <span key={label} className={configured ? "ready" : ""}>
              {label}: {configured ? "已配置" : "未配置"}
            </span>
          ))}
        </div>

        <div className="settings-grid">
          <label>
            Deepgram API Key
            <input
              type="password"
              autoComplete="off"
              value={form.deepgramApiKey}
              placeholder="留空则保持当前后端配置"
              onChange={(event) => setForm((current) => ({ ...current, deepgramApiKey: event.target.value }))}
            />
          </label>
          <label>
            OpenAI API Key
            <input
              type="password"
              autoComplete="off"
              value={form.openaiApiKey}
              placeholder="留空则保持当前后端配置"
              onChange={(event) => setForm((current) => ({ ...current, openaiApiKey: event.target.value }))}
            />
          </label>
          <label>
            OpenAI 模型
            <input
              value={form.openaiModel}
              onChange={(event) => setForm((current) => ({ ...current, openaiModel: event.target.value }))}
            />
          </label>
          <label>
            Cartesia API Key
            <input
              type="password"
              autoComplete="off"
              value={form.cartesiaApiKey}
              placeholder="留空则保持当前后端配置"
              onChange={(event) => setForm((current) => ({ ...current, cartesiaApiKey: event.target.value }))}
            />
          </label>
          <label>
            Cartesia Voice ID
            <input
              value={form.cartesiaVoiceId}
              placeholder="填写后 TTS provider 可进入已配置状态"
              onChange={(event) => setForm((current) => ({ ...current, cartesiaVoiceId: event.target.value }))}
            />
          </label>
          <label>
            Cartesia 模型
            <input
              value={form.cartesiaModel}
              onChange={(event) => setForm((current) => ({ ...current, cartesiaModel: event.target.value }))}
            />
          </label>
          <label>
            Cartesia Version
            <input
              value={form.cartesiaVersion}
              onChange={(event) => setForm((current) => ({ ...current, cartesiaVersion: event.target.value }))}
            />
          </label>
        </div>

        <p className="settings-note">
          密钥只发送到本地 Node API 的运行时内存，不写入仓库，也不保存到浏览器。刷新后如需持久化，请使用 `.env.local`。
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
