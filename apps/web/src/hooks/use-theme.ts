import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseCookies } from "@/lib/auth/auth-cookies";

/** The applied appearance (drives `data-mode`/`.dark`). */
export type Theme = "light" | "dark";
/** The user's choice: an explicit theme, or `system` to follow the OS `prefers-color-scheme`. */
export type ThemeMode = Theme | "system";

const COOKIE = "brika-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * The saved theme MODE from a `Cookie` header (server) or `document.cookie` (client), or null when
 * none is set. A cookie (not localStorage) so the server can read it: an explicit `light`/`dark` is
 * rendered at SSR with no hydration mismatch; `system` and null are resolved client-side.
 */
export function readThemeMode(cookieHeader: string | null): ThemeMode | null {
  const value = parseCookies(cookieHeader)[COOKIE];
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

/**
 * Inline `<head>` script that applies the theme before first paint (no flash). An explicit mode
 * matches the server-rendered `data-mode`; `system` resolves from the OS preference. With no cookie
 * it migrates a legacy `light`/`dark` localStorage value (else defaults to `system`) and writes the
 * cookie, so the next load is server-rendered.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(COOKIE)},c=document.cookie.match(new RegExp("(?:^|; )"+k+"=(light|dark|system)")),o=c?c[1]:null;if(!o){var l=localStorage.getItem(k);o=(l==="light"||l==="dark")?l:"system";document.cookie=k+"="+o+"; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax"}var t=o==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):o;var e=document.documentElement;e.dataset.mode=t;e.classList.toggle("dark",t==="dark")}catch(e){}})();`;

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function domTheme(): Theme {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

/**
 * Run `apply` with all CSS transitions disabled, so a theme flip is instant instead of a staggered
 * color fade across every `transition-colors` element. The override is removed on the next frame
 * (after a reflow flushes the change), so hover/focus transitions resume immediately.
 */
function withoutTransitions(apply: () => void): void {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none !important}";
  document.head.appendChild(style);
  apply();
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => style.remove());
}

function applyMode(mode: ThemeMode): void {
  const theme = mode === "system" ? systemTheme() : mode;
  withoutTransitions(() => {
    const el = document.documentElement;
    el.dataset.mode = theme;
    el.classList.toggle("dark", theme === "dark");
  });
  // biome-ignore lint/suspicious/noDocumentCookie: a sync write is needed (the boot script reads it on the next load); the Cookie Store API is async and not universally supported.
  document.cookie = `${COOKIE}=${mode}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export interface ThemeApi {
  /** The user's choice (drives the switcher's active state). */
  readonly mode: ThemeMode;
  /** The resolved appearance. */
  readonly theme: Theme;
  readonly setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeApi | null>(null);

/**
 * Owns the theme state for the document root. Seeds from the server-known cookie mode (`initial`): an
 * explicit `light`/`dark` renders the same `data-mode` on server and client; `system`/null render a
 * placeholder that the post-mount effect replaces with the boot-script-resolved value. While in
 * `system` mode it follows live OS changes. Returns the resolved theme for `<html>` plus the
 * {@link ThemeApi} to provide via {@link ThemeContext}.
 */
export function useThemeController(initial: ThemeMode | null): { theme: Theme; api: ThemeApi } {
  const [mode, setModeState] = useState<ThemeMode>(initial ?? "system");
  const [theme, setThemeState] = useState<Theme>(
    initial === "light" || initial === "dark" ? initial : "light",
  );

  useEffect(() => {
    setThemeState(domTheme());
    if (mode !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyMode("system");
      setThemeState(domTheme());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const api = useMemo<ThemeApi>(
    () => ({
      mode,
      theme,
      setMode: (next) => {
        applyMode(next);
        setModeState(next);
        setThemeState(domTheme());
      },
    }),
    [mode, theme],
  );
  return { theme, api };
}

/** The current mode + resolved theme + setter, from the provider rendered by the document root. */
export function useTheme(): ThemeApi {
  return useContext(ThemeContext) ?? { mode: "system", theme: "light", setMode: () => {} };
}
