import { createContext, useContext, useMemo, useState } from "react";
import { i18nConfig } from "@/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface LocaleApi {
  readonly locale: string;
  readonly setLocale: (locale: string) => void;
}

export const LocaleContext = createContext<LocaleApi | null>(null);

/**
 * Owns the active locale for the document, seeded from the server-resolved value. Writing the cookie
 * keeps the next SSR in sync; updating state re-renders every `t()`/`useLocale()` consumer instantly
 * (all locales' catalogs are already bundled), so the switch is immediate with no reload or flash.
 */
export function useLocaleController(initial: string): LocaleApi {
  const [locale, setLocale] = useState<string>(initial);
  return useMemo<LocaleApi>(
    () => ({
      locale,
      setLocale: (next) => {
        // biome-ignore lint/suspicious/noDocumentCookie: a sync write keeps the next SSR in sync; the Cookie Store API is async and not universally supported.
        document.cookie = `${i18nConfig.cookie}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        setLocale(next);
      },
    }),
    [locale],
  );
}

/** The current locale + setter, from the provider rendered by the document root. */
export function useLocalePref(): LocaleApi {
  const api = useContext(LocaleContext);
  if (api === null) throw new Error("useLocalePref must be used within the document root");
  return api;
}
