export type Source = "AI" | "extension" | "raindrop";
export type Status = "待整理" | "稍后读" | "已归档";
export type ViewMode = "grid" | "list" | "board" | "tags";
export type SortKey = "recent" | "title" | "domain";
export type SyncPhase = "idle" | "syncing" | "success" | "error";
// TODO(pending): 新增主题方案（Claude / ElevenLabs / Mistral / Supabase / Cal / Notion）标为待定，
// 后续主题设计评审后再做样式与色彩收敛。现仅作为原型集成占位。
export type ThemeMode =
  | "light"
  | "dark"
  | "system"
  | "glass"
  | "claude"
  | "elevenlabs"
  | "mistral"
  | "supabase"
  | "cal"
  | "notion";

export type SectionKey =
  | "inbox"
  | "later"
  | "archive"
  | "design"
  | "engineering"
  | "notes";

export type SuggestionState = "pending" | "accepted" | "ignored" | "later";

export interface AiSuggestion {
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
export type RaindropConflictStrategy = "local" | "raindrop" | "ask";
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
  conflictStrategy: RaindropConflictStrategy;
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