import { buildCatalogs, type Catalog, CIMODE, pickCatalog, resolveLocale } from "@brika/i18n";
import { i18nConfig } from "@/i18n/config";
import { parseCookies } from "@/lib/auth/auth-cookies";

// One line of bundler glob; the package assembles it. The barrel (locales/en/index.ts) is the type
// source for message keys; this is the runtime source for every locale.
const catalogs = buildCatalogs(
  import.meta.glob<Record<string, string>>("./locales/*/*.json", {
    eager: true,
    import: "default",
  }),
);

export const defaultLocale: string = i18nConfig.defaultLocale;

/** Supported locale codes, auto-detected from the `locales/<code>/` folders, in config order. */
export const locales: readonly string[] = Object.keys(catalogs).sort((a, b) => {
  const ia = i18nConfig.order.findIndex((code) => code === a);
  const ib = i18nConfig.order.findIndex((code) => code === b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
});

/** The catalog for `locale`, falling back to the default locale's (then empty). */
export function catalogFor(locale: string): Catalog {
  return pickCatalog(catalogs, locale, defaultLocale);
}

/** The UI locale chosen via the cookie, or null when unset or unsupported. `cimode` is dev-only. */
export function readLocaleCookie(cookieHeader: string | null): string | null {
  const value = parseCookies(cookieHeader)[i18nConfig.cookie];
  if (!value) return null;
  if (import.meta.env.DEV && value === CIMODE) return CIMODE;
  return locales.includes(value) ? value : null;
}

/** The best-supported locale for an `Accept-Language` header (falls back to the default). */
export function localeFromHeader(header: string | null): string {
  return resolveLocale(header, locales, defaultLocale);
}
