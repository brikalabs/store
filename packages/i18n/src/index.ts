import { IntlMessageFormat } from "intl-messageformat";

/** One namespace's messages: key -> ICU MessageFormat source string. */
export type Namespace = Record<string, string>;

/** One locale's catalog: namespace -> its messages. Also the structural bound for typed catalogs. */
export type Catalog = Record<string, Namespace>;

/** Interpolation values for a message (`{count}`, `{name}`, ...). */
export type Values = Record<string, string | number | Date | boolean>;

/** A timestamp input: an ISO string, a `Date`, or absent. */
export type DateLike = string | Date | undefined;

/**
 * Every valid `"namespace:key"` for catalog `C`. Derived by `tsc` from a typed (`as const`) catalog,
 * so a typo is a compile error with no codegen step. Collapses to `string` when `C` is the wide
 * {@link Catalog} (e.g. the package's untyped React hook), keeping unparameterized use loose.
 */
export type MessageKey<C extends Catalog> = Catalog extends C
  ? string
  : { [N in keyof C & string]: `${N}:${keyof C[N] & string}` }[keyof C & string];

/** Resolve an ICU message by key. `K` carries the literal key union when the catalog is typed. */
export type Translate<K extends string = string> = (key: K, values?: Values) => string;

/**
 * A reserved pseudo-locale that makes the translator echo each key verbatim instead of resolving it.
 * Use it in development to see exactly which message key backs every string on screen (i18next calls
 * this `cimode`). Never enable it in production.
 */
export const CIMODE = "cimode";

/**
 * Build a translator for one locale. ICU messages are parsed lazily and cached per key, so repeat
 * calls (lists, re-renders) reuse the compiled format. A missing key returns the key itself, so gaps
 * are visible in the UI rather than silently empty. Pass a typed (`as const`) catalog to get a
 * `Translate` whose keys are checked at compile time.
 */
export function createTranslator<C extends Catalog>(
  locale: string,
  catalog: C,
  defaultNamespace = "common",
): Translate<MessageKey<C>> {
  if (locale === CIMODE) return (key) => key; // dev key-inspection: show the key, not the value
  const shape: Catalog = catalog;
  const cache = new Map<string, IntlMessageFormat>();
  return (key, values) => {
    const sep = key.indexOf(":");
    const ns = sep === -1 ? defaultNamespace : key.slice(0, sep);
    const id = sep === -1 ? key : key.slice(sep + 1);
    const message = shape[ns]?.[id];
    if (message === undefined) return key;
    let format = cache.get(key);
    if (format === undefined) {
      format = new IntlMessageFormat(message, locale);
      cache.set(key, format);
    }
    return String(format.format(values));
  };
}

/**
 * Pick the best-supported locale from an `Accept-Language` header (or any comma-separated tag list).
 * Matches the full tag first, then its primary subtag (`en-US` -> `en`); falls back when none match.
 */
export function resolveLocale<L extends string>(
  header: string | null | undefined,
  supported: readonly L[],
  fallback: L,
): L {
  if (!header) return fallback;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const base = tag.split("-")[0];
    const hit = supported.find((l) => l === tag || l === base);
    if (hit) return hit;
  }
  return fallback;
}

/**
 * Assemble per-locale catalogs from a bundler glob map (e.g. Vite `import.meta.glob`) whose keys are
 * paths ending in `<locale>/<namespace>.json` and whose values are the parsed messages. Lets an app
 * keep one line of glob and no assembly boilerplate.
 */
export function buildCatalogs(modules: Record<string, Namespace>): Record<string, Catalog> {
  const catalogs: Record<string, Catalog> = {};
  for (const [path, messages] of Object.entries(modules)) {
    const match = /\/([^/]+)\/([^/]+)\.json$/.exec(path);
    const locale = match?.[1];
    const namespace = match?.[2];
    if (locale && namespace) {
      const catalog = catalogs[locale] ?? {};
      catalog[namespace] = messages;
      catalogs[locale] = catalog;
    }
  }
  return catalogs;
}

/** Pick a locale's catalog from {@link buildCatalogs} output, falling back to `fallback` then empty. */
export function pickCatalog(
  catalogs: Record<string, Catalog>,
  locale: string,
  fallback: string,
): Catalog {
  return catalogs[locale] ?? catalogs[fallback] ?? {};
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function timeOf(value: DateLike): number | undefined {
  if (value === undefined) return undefined;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** A localized date for `value` in `locale`; "" for absent/invalid input. */
export function formatDate(
  locale: string,
  value: DateLike,
  options: Intl.DateTimeFormatOptions = SHORT_DATE,
): string {
  const ms = timeOf(value);
  return ms === undefined ? "" : new Intl.DateTimeFormat(locale, options).format(ms);
}

/** A localized coarse relative time of `value` against `nowMs` ("2 days ago"/"now"); "" if absent. */
export function formatRelative(locale: string, value: DateLike, nowMs: number): string {
  const ms = timeOf(value);
  if (ms === undefined) return "";
  const diff = ms - nowMs;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, step] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= step) return rtf.format(Math.round(diff / step), unit);
  }
  return rtf.format(0, "second");
}

/** A localized number for `value` in `locale`. */
export function formatNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Read one cookie's value from a `Cookie` header (locale codes are ASCII, so no decoding needed). */
function cookieValue(header: string | null, name: string): string | undefined {
  if (header === null) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** Configuration for {@link defineI18n}: the bundler glob plus a few defaults. */
export interface I18nSetup {
  /** Eager glob of `locales/<code>/<namespace>.json` (e.g. Vite `import.meta.glob(..., {eager:true,import:"default"})`). */
  readonly messages: Record<string, Namespace>;
  /** Locale used when neither the cookie nor `Accept-Language` resolves. */
  readonly defaultLocale: string;
  /** Cookie name holding the user's explicit choice. Defaults to `locale`. */
  readonly cookie?: string;
  /** Optional display order; detected locales not listed are appended alphabetically. */
  readonly order?: readonly string[];
  /** When true, the cookie may select {@link CIMODE} (dev key inspection). Keep off in production. */
  readonly dev?: boolean;
}

/** The runtime returned by {@link defineI18n}: everything an app needs, derived from the glob. */
export interface I18nRuntime {
  /** Supported locales, auto-detected from the glob, in `order` then alphabetical. */
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  /** The cookie name (for the client to persist a choice). */
  readonly cookie: string;
  /** A locale's catalog, falling back to the default locale's then empty. */
  catalogFor(locale: string): Catalog;
  /** The locale chosen via the cookie, or null when unset/unsupported (`cimode` allowed when `dev`). */
  localeFromCookie(cookieHeader: string | null): string | null;
  /** The best-supported locale for an `Accept-Language` header (falls back to the default). */
  localeFromHeader(header: string | null): string;
  /** The locale for a request: the cookie choice, else the best `Accept-Language` match. */
  localeForRequest(request: Request): string;
}

/**
 * Assemble a complete i18n runtime from one config object: locales auto-detected from the glob,
 * catalog lookup, and cookie/header/request resolution. The app keeps only this call (plus its locale
 * JSON); the engine does the rest.
 */
export function defineI18n(setup: I18nSetup): I18nRuntime {
  const catalogs = buildCatalogs(setup.messages);
  const cookie = setup.cookie ?? "locale";
  const order = setup.order ?? [];
  const locales = Object.keys(catalogs).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  const localeFromCookie = (header: string | null): string | null => {
    const value = cookieValue(header, cookie);
    if (value === undefined) return null;
    if (setup.dev === true && value === CIMODE) return CIMODE;
    return locales.includes(value) ? value : null;
  };
  const localeFromHeader = (header: string | null): string =>
    resolveLocale(header, locales, setup.defaultLocale);
  return {
    locales,
    defaultLocale: setup.defaultLocale,
    cookie,
    catalogFor: (locale) => pickCatalog(catalogs, locale, setup.defaultLocale),
    localeFromCookie,
    localeFromHeader,
    localeForRequest: (request) =>
      localeFromCookie(request.headers.get("cookie")) ??
      localeFromHeader(request.headers.get("accept-language")),
  };
}
