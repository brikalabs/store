import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readThemeMode, type ThemeMode } from "@/hooks/use-theme";

/**
 * The saved theme mode from the request cookie, or null when none is set. Read at SSR so the document
 * root renders the matching `data-mode` for an explicit `light`/`dark`; `system` and null are the
 * only cases the server cannot resolve (the OS preference is client-only).
 */
export const fetchThemeMode = createServerFn().handler((): ThemeMode | null =>
  readThemeMode(getRequest().headers.get("cookie")),
);
