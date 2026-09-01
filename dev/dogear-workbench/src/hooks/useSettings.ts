import { useCallback, useEffect, useState } from "react";
import { createDefaultSettings } from "@/data/mockSettings";
import type { AppSettings, BackupTarget } from "@/types";

const STORAGE_KEY = "dogear-settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    const parsed = JSON.parse(raw) as AppSettings;
    const defaults = createDefaultSettings();
    return {
      ...defaults,
      ...parsed,
      backup: { ...defaults.backup, ...(parsed.backup ?? {}), targets: parsed.backup?.targets ?? defaults.backup.targets, history: parsed.backup?.history ?? defaults.backup.history },
      agent: { ...defaults.agent, ...(parsed.agent ?? {}), capabilities: { ...defaults.agent.capabilities, ...(parsed.agent?.capabilities ?? {}) }, limits: { ...defaults.agent.limits, ...(parsed.agent?.limits ?? {}) }, stats: { ...defaults.agent.stats, ...(parsed.agent?.stats ?? {}) } },
      logs: { ...defaults.logs, ...(parsed.logs ?? {}) },
      trash: { ...defaults.trash, ...(parsed.trash ?? {}) },
      sync: { ...defaults.sync, ...(parsed.sync ?? {}) },
      raindrop: {
        ...defaults.raindrop,
        ...(parsed.raindrop ?? {}),
        queue: parsed.raindrop?.queue ?? defaults.raindrop.queue,
        rateLimit: { ...defaults.raindrop.rateLimit, ...(parsed.raindrop?.rateLimit ?? {}) },
      },
    };
  } catch {
    return createDefaultSettings();
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback(
    (updater: (s: AppSettings) => AppSettings) => {
      setSettings((prev) => updater(prev));
    },
    []
  );

  const upsertTarget = useCallback(
    (target: BackupTarget) => {
      updateSettings((s) => ({
        ...s,
        backup: {
          ...s.backup,
          targets: s.backup.targets.some((t) => t.id === target.id)
            ? s.backup.targets.map((t) => (t.id === target.id ? target : t))
            : [...s.backup.targets, target],
        },
      }));
    },
    [updateSettings]
  );

  const removeTarget = useCallback(
    (id: string) => {
      updateSettings((s) => ({
        ...s,
        backup: { ...s.backup, targets: s.backup.targets.filter((t) => t.id !== id) },
      }));
    },
    [updateSettings]
  );

  return { settings, updateSettings, upsertTarget, removeTarget };
}