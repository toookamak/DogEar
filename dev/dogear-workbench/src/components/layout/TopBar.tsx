import { USER_PROFILE } from "@/data/mockSettings";

interface Props {
  onToggleSidebar: () => void;
  onMockSave: () => void;
}

export default function TopBar({ onToggleSidebar, onMockSave }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label="打开导航"
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        <a className="brand" href="#workbench" aria-label="DogEar 工作台">
          <span className="brand-mark">D</span>
          <span className="brand-name">DogEar</span>
          <span className="brand-sep">/</span>
          <span className="brand-mode">WORKBENCH</span>
        </a>
      </div>

      <div className="topbar-user">
        {/* AI 建议落点①「输入时」演示：模拟插件/Agent 保存，建议先行不自动写入 */}
        <button
          type="button"
          className="mini-action accent"
          onClick={onMockSave}
          title="模拟从插件/Agent 保存一条链接（AI 建议先行）"
        >
          + 模拟保存
        </button>
        <span className="user-avatar">{USER_PROFILE.initial}</span>
        <span className="user-name">{USER_PROFILE.name}</span>
      </div>
    </header>
  );
}
