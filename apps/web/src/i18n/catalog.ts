import { buildCatalogs, type Catalog, pickCatalog } from "@brika/i18n";
import { parseCookies } from "@/lib/auth/auth-cookies";

/** Locales we ship UI strings for. Add one by dropping `locales/<locale>/<namespace>.json` files. */
export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "ja", "pt-BR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the user's explicit locale choice (overrides Accept-Language). */
export const LOCALE_COOKIE = "brika-locale";

/** The chosen locale from a `Cookie` header, or null when unset or unsupported. */
export function readLocaleCookie(cookieHeader: string | null): Locale | null {
  const value = parseCookies(cookieHeader)[LOCALE_COOKIE];
  return SUPPORTED_LOCALES.find((locale) => locale === value) ?? null;
}

// One line of bundler glob; the package does the assembly. The barrel (locales/en/index.ts) is the
// type source; this is the runtime source for every locale.
const catalogs = buildCatalogs(
  import.meta.glob<Record<string, string>>("./locales/*/*.json", {
    eager: true,
    import: "default",
  }),
);

/** The catalog for `locale`, falling back to the default locale's (then empty). */
export function catalogFor(locale: string): Catalog {
  return pickCatalog(catalogs, locale, DEFAULT_LOCALE);
}
