import { IntlMessageFormat } from "intl-messageformat";

/** One namespace's messages: key -> ICU MessageFormat source string. */
export type Namespace = Record<string, string>;

/** The structural shape of a catalog: namespace -> its messages. */
export type CatalogShape = Record<string, Namespace>;

/** One locale's catalog: namespace -> its messages. */
export type Catalog = CatalogShape;

/** Interpolation values for a message (`{count}`, `{name}`, ...). */
export type Values = Record<string, string | number | Date | boolean>;

/**
 * Every valid key for catalog shape `C`: each `"namespace:key"`, plus the bare keys of the default
 * namespace `D`. Derived by `tsc` from a typed (`as const`) catalog, so a typo is a compile error
 * with no codegen step. Collapses to `string` when `C` is the wide {@link CatalogShape} (e.g. the
 * package's untyped React hook), keeping unparameterized use loose.
 */
export type MessageKey<C extends CatalogShape, D extends keyof C & string = never> =
  | { [N in keyof C & string]: `${N}:${keyof C[N] & string}` }[keyof C & string]
  | (D extends never ? never : keyof C[D & keyof C] & string);

/** Resolve an ICU message by key. `K` carries the literal key union when the catalog is typed. */
export type Translate<K extends string = string> = (key: K, values?: Values) => string;

/**
 * Build a translator for one locale. ICU messages are parsed lazily and cached per key, so repeat
 * calls (lists, re-renders) reuse the compiled format. A missing key returns the key itself, so gaps
 * are visible in the UI rather than silently empty. Pass a typed (`as const`) catalog to get a
 * `Translate` whose keys are checked at compile time.
 */
export function createTranslator<C extends CatalogShape, D extends keyof C & string = never>(
  locale: string,
  catalog: C,
  defaultNamespace?: D,
): Translate<MessageKey<C, D>> {
  const shape: CatalogShape = catalog;
  const fallbackNamespace = defaultNamespace ?? "common";
  const cache = new Map<string, IntlMessageFormat>();
  return (key, values) => {
    const sep = key.indexOf(":");
    const ns = sep === -1 ? fallbackNamespace : key.slice(0, sep);
    const id = sep === -1 ? key : key.slice(sep + 1);
    const message = shape[ns]?.[id];
    if (message === undefined) return key;
    let format = cache.get(key);
    if (format === undefined) {
      format = new IntlMessageFormat(message, locale);
      cache.set(key, format);
    }
    const out = format.format(values);
    return typeof out === "string" ? out : String(out);
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
    if (!match) continue;
    const [, locale, namespace] = match;
    if (!locale || !namespace) continue;
    const catalog = catalogs[locale] ?? {};
    catalog[namespace] = messages;
    catalogs[locale] = catalog;
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
