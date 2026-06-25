import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { localeFromHeader, readLocaleCookie } from "@/i18n/catalog";

/**
 * The UI locale for a request: the explicit `brika-locale` cookie, else the best `Accept-Language`
 * match. Pure (it takes the request), so server-only callers can import it without dragging a
 * server-only `getRequest()` into a client-reachable module. Shared by {@link fetchLocale} and the
 * per-request DI scope (`runWeb`).
 */
export function localeForRequest(request: Request): string {
  return (
    readLocaleCookie(request.headers.get("cookie")) ??
    localeFromHeader(request.headers.get("accept-language"))
  );
}

/** The request's UI locale, as a server function for the SSR root loader. */
export const fetchLocale = createServerFn().handler((): string => localeForRequest(getRequest()));
