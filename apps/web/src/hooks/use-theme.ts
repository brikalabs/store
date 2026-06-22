import { useSyncExternalStore } from "react";

/** Light/dark theme, persisted to localStorage and applied as `data-mode` on `<html>`. */
export type Theme = "light" | "dark";

const STORAGE_KEY = "brika-theme";

/**
 * Inline `<head>` script that applies the theme before first paint (to avoid a flash). An explicit
 * stored choice wins; otherwise it follows the OS `prefers-color-scheme`.
 */
export const themeBootScript = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(m!=="dark"&&m!=="light")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var e=document.documentElement;e.dataset.mode=m;e.classList.toggle("dark",m==="dark");}catch(e){}})();`;

function snapshot(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const element = document.documentElement;
  element.dataset.mode = theme;
  element.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage may be unavailable (private mode); the attribute still applies.
  }
  for (const onChange of listeners) onChange();
}

export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light" as const);
  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
