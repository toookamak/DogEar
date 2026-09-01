import type {
  AppSettings,
  BackupHistoryItem,
  BackupTarget,
  LogEntry,
  RaindropQueueItem,
  UserProfile,
} from "@/types";

export const USER_PROFILE: UserProfile = {
  name: "maxxie",
  initial: "MX",
};

export const DEFAULT_BACKUP_TARGETS: BackupTarget[] = [
  {
    id: "t-webdav-01",
    type: "webdav",
    name: "免费 WebDAV（坚果云）",
    enabled: true,
    config: {
      server: "https://dav.jianguoyun.com/dav",
      path: "/DogEar/backups",
      username: "maxxie@example.com",
      password: "",
    },
    lastBackupAt: "昨天 22:31",
    lastSize: "186 KB",
    lastResult: "success",
  },
  {
    id: "t-s3-01",
    type: "s3",
    name: "MinIO 自建",
    enabled: false,
    config: {
      endpoint: "http://192.168.1.10:9000",
      region: "us-east-1",
      bucket: "dogear-backup",
      prefix: "snapshots",
      accessKey: "",
      secretKey: "",
    },
    lastResult: "fail",
  },
];

export const DEFAULT_BACKUP_HISTORY: BackupHistoryItem[] = [
  { id: 1, at: "昨天 22:31", type: "webdav", target: "免费 WebDAV（坚果云）", result: "success", size: "186 KB" },
  { id: 2, at: "08-29 09:12", type: "zip", target: "本地 ZIP", result: "success", size: "142 KB" },
  { id: 3, at: "08-27 18:04", type: "s3", target: "MinIO 自建", result: "fail", size: "—" },
  { id: 4, at: "08-25 11:40", type: "csv", target: "本地 CSV", result: "success", size: "58 KB" },
];

export const DEFAULT_RAINDROP_QUEUE: RaindropQueueItem[] = [
  { id: 101, op: "create", direction: "push", title: "Vite 6 发布说明", status: "pending", retries: 0 },
  { id: 102, op: "update", direction: "push", title: "Local-first software…", status: "pending", retries: 0 },
  { id: 103, op: "delete", direction: "push", title: "旧版主题截图存档", status: "failed", retries: 2 },
  { id: 104, op: "create", direction: "pull", title: "Figma 插件开发手册", status: "conflict", retries: 0 },
];

export function createDefaultSettings(): AppSettings {
  return {
    sync: { enabled: true, pushSeconds: 30, pullMinutes: 5 },
    raindrop: {
      token: "",
      connected: false,
      conflictStrategy: "local",
      queue: DEFAULT_RAINDROP_QUEUE,
      rateLimit: { status: "normal", limit: 60, remaining: 57, resetInSeconds: 42, retries429: 3 },
    },
    agent: {
      enabled: false,
      baseUrl: "http://localhost:3000",
      agentName: "",
      apiKey: "",
      capabilities: { query: true, save: true, edit: false, batch: false, delete: false },
      limits: { readPerMinute: 60, writePerMinute: 10, batchMax: 20 },
      stats: { todayRequests: 42, writeCount: 9, blockedCount: 2 },
    },
    backup: {
      schedule: { enabled: false, frequency: "manual" },
      targets: DEFAULT_BACKUP_TARGETS,
      history: DEFAULT_BACKUP_HISTORY,
    },
    logs: { retentionCount: 5000, retentionDays: 30 },
    trash: { retentionDays: 7 },
  };
}

export const SEED_LOGS: LogEntry[] = [
  { id: 1, at: "14:26", type: "同步", action: "推送", object: "3 条待推送书签", source: "同步", result: "success" },
  { id: 2, at: "14:20", type: "整理", action: "采纳 AI 建议", object: "The craft of interface typography", source: "工作台", result: "success" },
  { id: 3, at: "14:12", type: "新增", action: "保存书签", object: "Vite 6 发布说明", source: "工作台", result: "success" },
  { id: 4, at: "13:58", type: "编辑", action: "移动状态", object: "Local-first software…", source: "工作台", result: "success" },
  { id: 5, at: "13:41", type: "删除", action: "移至回收站", object: "旧版主题截图存档", source: "工作台", result: "success" },
  { id: 6, at: "13:30", type: "Agent", action: "查询", object: "list_bookmarks（2 条）", source: "Agent", result: "success" },
  { id: 7, at: "12:15", type: "备份", action: "导出 ZIP", object: "全量快照 142 KB", source: "工作台", result: "success" },
  { id: 8, at: "11:02", type: "同步", action: "拉取", object: "新增 5 条 / 冲突 1 条", source: "同步", result: "fail" },
  { id: 9, at: "10:48", type: "整理", action: "批量加标签", object: "「前端」× 4 条", source: "工作台", result: "success" },
  { id: 10, at: "09:30", type: "恢复", action: "从回收站恢复", object: "Web 无障碍清单", source: "工作台", result: "success" },
];

export const SIM_TOTAL = 284;
export const SIM_CAPACITY = 600;
export const SYNC_METRICS = {
  rate: "12 条/秒",
  latency: "186 ms",
  successRate: "97%",
  retries429: 3,
};