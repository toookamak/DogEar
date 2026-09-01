import { useEffect, useState } from "react";
import { useBookmarks } from "@/hooks/useBookmarks";
import AppShell from "@/components/layout/AppShell";
import type { ThemeMode } from "@/types";

const THEME_STORAGE_KEY = "dogear-theme";

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (
    stored === "light" ||
    stored === "dark" ||
    stored === "system" ||
    stored === "glass" ||
    stored === "claude" ||
    stored === "elevenlabs" ||
    stored === "mistral" ||
    stored === "supabase" ||
    stored === "cal" ||
    stored === "notion"
  ) {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: ThemeMode): Exclude<ThemeMode, "system"> {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const bm = useBookmarks();
  const { detailOpen, sidebarOpen } = bm.state;
  const { closeDetail, setSidebar } = bm;

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    if (theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (detailOpen) closeDetail();
        if (sidebarOpen) setSidebar(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen, sidebarOpen, closeDetail, setSidebar]);

  function changeTheme(next: ThemeMode) {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
  }

  return <AppShell bm={bm} theme={theme} onThemeChange={changeTheme} />;
}