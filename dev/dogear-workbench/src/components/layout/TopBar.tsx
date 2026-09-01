import { USER_PROFILE } from "@/data/mockSettings";

interface Props {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: Props) {
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
        <span className="user-avatar">{USER_PROFILE.initial}</span>
        <span className="user-name">{USER_PROFILE.name}</span>
      </div>
    </header>
  );
}