import { useState } from "react";

interface Props {
  value: string;
  onGenerate: () => string;
  onNotify: (message: string) => void;
}

export default function KeyField({ value, onGenerate, onNotify }: Props) {
  const [visible, setVisible] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");

  function handleGenerate() {
    const key = onGenerate();
    setRevealedKey(key);
    setVisible(true);
    onNotify("API Key 已生成，仅显示一次，请立即保存");
  }

  function handleCopy() {
    if (!revealedKey) return;
    navigator.clipboard?.writeText(revealedKey).catch(() => undefined);
    onNotify("API Key 已复制到剪贴板");
  }

  if (!value && !revealedKey) {
    return (
      <div className="key-field">
        <span className="config-label">API Key</span>
        <button type="button" className="primary-action key-generate" onClick={handleGenerate}>
          生成 API Key
        </button>
        <span className="config-hint">密钥仅显示一次，请妥善保存</span>
      </div>
    );
  }

  const shown = revealedKey || value;
  return (
    <div className="key-field">
      <span className="config-label">API Key</span>
      <div className="key-row">
        <code className="key-output">{visible ? shown : "••••••••••••"}</code>
        <button type="button" className="mini-action" onClick={() => setVisible((v) => !v)}>
          {visible ? "隐藏" : "显示"}
        </button>
        <button type="button" className="mini-action" onClick={handleCopy}>
          复制
        </button>
      </div>
      <span className="config-hint">密钥仅显示一次，请立即保存</span>
    </div>
  );
}