import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readThemeCookie, type Theme } from "@/hooks/use-theme";

/**
 * The saved theme choice from the request cookie, or null to let the client resolve it from the OS
 * preference. Read at SSR so the document root renders the matching `data-mode` and hydration does
 * not mismatch (the no-cookie case is the only one the server cannot know).
 */
export const fetchTheme = createServerFn().handler((): Theme | null =>
  readThemeCookie(getRequest().headers.get("cookie")),
);
