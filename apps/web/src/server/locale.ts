import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { i18n } from "@/i18n/config";

/** The request's UI locale, as a server function for the SSR root loader. */
export const fetchLocale = createServerFn().handler((): string =>
  i18n.localeForRequest(getRequest()),
);
