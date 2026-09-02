export type Source = "AI" | "extension" | "raindrop";

// 三态口径（PRD v1.0.7 §2.1.1）：待处理 / 已确认 / 搁置。
// 禁止在 UI 出现「已归档」；「稍后再读」是 Scene（保存意图），不是状态。
export type Status = "待处理" | "已确认" | "搁置";

// AERR 行为原型（PRD §2.0.3）：系统层内部类型，不展示给用户。
export type AERR = "Action" | "Explore" | "Read" | "Reference";

export type ViewMode = "grid" | "list" | "board" | "tags";
export type SortKey = "recent" | "title" | "domain";
export type SyncPhase = "idle" | "syncing" | "success" | "error";
// TODO(pending): 主题方案（Claude / Claude Dark / Notion / Notion Dark）标为待定，
// 后续主题设计评审后再做样式与色彩收敛。现仅作为原型集成占位。
export type ThemeMode =
  | "light"
  | "dark"
  | "system"
  | "claude"
  | "claude-dark"
  | "notion"
  | "notion-dark";

export type SectionKey = NavKey;

// 左侧导航键：状态三视图 + 导航页占位 + Scene（sc-）+ Folder（fd-）
export type NavKey =
  | "inbox"
  | "confirmed"
  | "shelved"
  | "navpage"
  | `sc-${string}`
  | `fd-${string}`;

// Scene：可配置数据（PRD §2.0.1），禁止硬编码枚举。
// AERR 只影响默认排序 / 信息密度 / 主按钮，工作台只有一套。
export interface SceneDef {
  key: NavKey;
  name: string;
  description: string;
  archetype: AERR;
  defaultSort: SortKey;
  density: "cozy" | "compact";
  primaryAction: string;
}

export type SuggestionState = "pending" | "accepted" | "ignored" | "later";

export interface AiSuggestion {
  // 建议先行（PRD §6.1）：优先建议 1 个 Scene，其次少量 Folder/Tag；
  // 一律不自动写入，须用户确认后才生效。
  scene?: string;
  folder: string;
  tags: string[];
  note: string;
  state: SuggestionState;
}

export interface Bookmark {
  id: number;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  source: Source;
  status: Status;
  scenes: string[];
  folder: string;
  tags: string[];
  createdAt: string;
  ts: number;
  progress: number;
  art: string;
  mark: string;
  suggestion?: AiSuggestion;
}

export interface Filters {
  section: SectionKey;
  query: string;
  tag: string;
  source: Source | "全部";
  sort: SortKey;
}

export type UndoAction =
  | { type: "restoreStatus"; entries: { id: number; status: Status }[] }
  | {
      type: "restoreSuggestion";
      id: number;
      folder: string;
      tags: string[];
    }
  | { type: "restoreTrash"; items: TrashItem[] };

export interface ToastMsg {
  id: number;
  kind: "success" | "error";
  message: string;
  actionLabel?: string;
  undo?: UndoAction;
}

export interface SectionDef {
  key: SectionKey;
  label: string;
}

export interface SyncState {
  phase: SyncPhase;
  attempts: number;
  lastSyncAt: string;
}

export type SettingsTabKey = "status" | "raindrop" | "backup" | "agent" | "log" | "trash";

export type RaindropQueueOp = "create" | "update" | "delete";
export type RaindropQueueStatus = "pending" | "synced" | "failed" | "conflict";
export type RaindropRateStatus = "normal" | "backoff";

export interface RaindropQueueItem {
  id: number;
  op: RaindropQueueOp;
  direction: "push" | "pull";
  title: string;
  status: RaindropQueueStatus;
  retries: number;
}

export interface RaindropRateLimit {
  status: RaindropRateStatus;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  retries429: number;
}

export interface RaindropConfig {
  token: string;
  connected: boolean;
  queue: RaindropQueueItem[];
  rateLimit: RaindropRateLimit;
}

export type LogType =
  | "新增" | "编辑" | "删除" | "整理" | "恢复" | "同步" | "备份" | "Agent";
export type LogSource = "工作台" | "Agent" | "AI" | "同步";
export type BackupKind = "webdav" | "s3";
export type BackupFrequency = "manual" | "daily" | "weekly";

export interface AgentCapabilities {
  query: boolean;
  save: boolean;
  edit: boolean;
  batch: boolean;
  delete: boolean;
}

export interface AgentLimits {
  readPerMinute: number;
  writePerMinute: number;
  batchMax: number;
}

export interface AgentStats {
  todayRequests: number;
  writeCount: number;
  blockedCount: number;
}

export interface BackupTarget {
  id: string;
  type: BackupKind;
  name: string;
  enabled: boolean;
  config: Record<string, string>;
  lastBackupAt?: string;
  lastSize?: string;
  lastResult?: "success" | "fail";
}

export interface BackupHistoryItem {
  id: number;
  at: string;
  type: "csv" | "zip" | "webdav" | "s3";
  target: string;
  result: "success" | "fail";
  size: string;
}

export interface LogEntry {
  id: number;
  at: string;
  type: LogType;
  action: string;
  object: string;
  source: LogSource;
  result: "success" | "fail";
}

export interface TrashItem {
  id: number;
  bookmark: Bookmark;
  deletedAt: string;
  expiresAt: string;
}

export interface AppSettings {
  sync: { enabled: boolean; pushSeconds: number; pullMinutes: number };
  raindrop: RaindropConfig;
  agent: {
    enabled: boolean;
    baseUrl: string;
    agentName: string;
    apiKey: string;
    capabilities: AgentCapabilities;
    limits: AgentLimits;
    stats: AgentStats;
  };
  backup: {
    schedule: { enabled: boolean; frequency: BackupFrequency };
    targets: BackupTarget[];
    history: BackupHistoryItem[];
  };
  logs: { retentionCount: number; retentionDays: number };
  trash: { retentionDays: number };
}

export interface UserProfile {
  name: string;
  initial: string;
}