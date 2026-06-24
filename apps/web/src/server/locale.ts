import { resolveLocale } from "@brika/i18n";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { DEFAULT_LOCALE, type Locale, readLocaleCookie, SUPPORTED_LOCALES } from "@/i18n/catalog";

/**
 * The UI locale for the current request: the explicit `brika-locale` cookie, else the best
 * `Accept-Language` match. Shared by the SSR loader ({@link fetchLocale}) and the per-request DI
 * scope (`runWeb`). Defaults safely if no request is in scope.
 */
export function resolveRequestLocale(): Locale {
  try {
    const request = getRequest();
    return (
      readLocaleCookie(request.headers.get("cookie")) ??
      resolveLocale(request.headers.get("accept-language"), SUPPORTED_LOCALES, DEFAULT_LOCALE)
    );
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** The request's UI locale, as a server function for the SSR root loader. */
export const fetchLocale = createServerFn().handler((): Locale => resolveRequestLocale());
