import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseCookies } from "@/lib/auth/auth-cookies";

/** Light/dark theme, persisted in a cookie so the server can render the right `data-mode` at SSR. */
export type Theme = "light" | "dark";

const COOKIE = "brika-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * The explicit theme choice from a `Cookie` header (server) or `document.cookie` (client), or null
 * when none is set, which leaves the client to resolve it from the OS `prefers-color-scheme`. A
 * cookie (not localStorage) so the server can read it and render a matching `data-mode`.
 */
export function readThemeCookie(cookieHeader: string | null): Theme | null {
  const value = parseCookies(cookieHeader)[COOKIE];
  return value === "dark" || value === "light" ? value : null;
}

/**
 * Inline `<head>` script that applies the theme before first paint (no flash). The cookie choice wins
 * (so it matches the server-rendered `data-mode`). With no cookie, it resolves from a legacy
 * localStorage value or the OS preference AND writes the cookie, so the next load is server-rendered
 * and matches - leaving only the very first paint as the case the server cannot know.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(COOKIE)},c=document.cookie.match(new RegExp("(?:^|; )"+k+"=(dark|light)")),m;if(c){m=c[1]}else{var l=localStorage.getItem(k);m=(l==="dark"||l==="light")?l:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.cookie=k+"="+m+"; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax"}var e=document.documentElement;e.dataset.mode=m;e.classList.toggle("dark",m==="dark")}catch(e){}})();`;

function domTheme(): Theme {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  el.dataset.mode = theme;
  el.classList.toggle("dark", theme === "dark");
  // biome-ignore lint/suspicious/noDocumentCookie: a sync write is needed (the boot script reads it on the next load); the Cookie Store API is async and not universally supported.
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export interface ThemeApi {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggle: () => void;
}

export const ThemeContext = createContext<ThemeApi | null>(null);

/**
 * Owns the theme state for the document root: seeded with the server-known cookie choice (`initial`)
 * so SSR and hydration render the same `data-mode`, then adopts whatever the boot script applied
 * (the no-cookie OS-preference case) after mount. Returns the live theme for `<html>` plus the
 * {@link ThemeApi} to provide via {@link ThemeContext}.
 */
export function useThemeController(initial: Theme | null): { theme: Theme; api: ThemeApi } {
  const [theme, setThemeState] = useState<Theme>(initial ?? "light");
  useEffect(() => {
    setThemeState(domTheme());
  }, []);
  const api = useMemo<ThemeApi>(() => {
    const set = (next: Theme) => {
      applyTheme(next);
      setThemeState(next);
    };
    return { theme, setTheme: set, toggle: () => set(theme === "dark" ? "light" : "dark") };
  }, [theme]);
  return { theme, api };
}

/** The current theme + setters, from the provider rendered by the document root. */
export function useTheme(): ThemeApi {
  return useContext(ThemeContext) ?? { theme: "light", setTheme: () => {}, toggle: () => {} };
}
