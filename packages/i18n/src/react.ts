import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import {
  type Catalog,
  createTranslator,
  type DateLike,
  formatDate,
  formatNumber,
  formatRelative,
  type MessageKey,
  type Translate,
} from "./index";

interface I18n {
  readonly t: Translate;
  readonly locale: string;
}

const I18nContext = createContext<I18n | null>(null);

/** Props for {@link I18nProvider}. */
export interface I18nProviderProps {
  readonly locale: string;
  readonly catalog: Catalog;
  /** Namespace used for keys without a `ns:` prefix. Defaults to `common`. */
  readonly defaultNamespace?: string;
  readonly children: ReactNode;
}

/**
 * Provide the current locale's translator to the tree. The translator (and its compile cache) is
 * rebuilt only when the locale or catalog changes. No JSX so the package needs no JSX toolchain.
 */
export function I18nProvider({ locale, catalog, defaultNamespace, children }: I18nProviderProps) {
  const value = useMemo<I18n>(
    () => ({ t: createTranslator(locale, catalog, defaultNamespace), locale }),
    [locale, catalog, defaultNamespace],
  );
  return createElement(I18nContext.Provider, { value }, children);
}

function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) throw new Error("useT/useLocale must be used within <I18nProvider>");
  return value;
}

/**
 * The translator for the current locale. With no argument it resolves `"namespace:key"`. Pass a
 * namespace to get a scoped translator whose keys are bare (`useT("nav")` -> `t("signIn")`). Throws
 * when used outside an {@link I18nProvider}.
 */
export function useT(): Translate;
export function useT<N extends string>(namespace: N): Translate;
export function useT(namespace?: string): Translate {
  const t = useI18n().t;
  if (namespace === undefined) return t;
  return (key, values) => t(`${namespace}:${key}`, values);
}

/** The active BCP-47 locale, e.g. for `Intl.*` formatters. Throws outside an {@link I18nProvider}. */
export function useLocale(): string {
  return useI18n().locale;
}

/** Hooks bound to a catalog's KEY shape: `useT()` is fully typed, `useT("ns")` is scoped + typed. */
export interface TypedI18n<C extends Catalog> {
  useT(): Translate<MessageKey<C>>;
  useT<N extends keyof C & string>(namespace: N): Translate<keyof C[N] & string>;
  useLocale(): string;
}

/**
 * Bind the hooks to an app's catalog shape for end-to-end key typing with zero codegen and zero
 * casts: `export const { useT, useLocale } = createI18n<typeof enCatalog>()`. It is the same runtime
 * hooks, viewed through the catalog's literal-key types.
 */
export function createI18n<C extends Catalog>(): TypedI18n<C> {
  return { useT, useLocale };
}

/** A localized date formatter for the active locale. Returns "" for absent/invalid input. */
export function useDateFormat(options?: Intl.DateTimeFormatOptions): (value: DateLike) => string {
  const locale = useLocale();
  return useMemo(() => (value: DateLike) => formatDate(locale, value, options), [locale, options]);
}

/** A localized coarse relative-time formatter ("2 days ago"/"now"). Returns "" for absent/invalid. */
export function useRelativeTime(): (value: DateLike) => string {
  const locale = useLocale();
  return useMemo(() => (value: DateLike) => formatRelative(locale, value, Date.now()), [locale]);
}

/** A localized number formatter for the active locale. */
export function useNumberFormat(options?: Intl.NumberFormatOptions): (value: number) => string {
  const locale = useLocale();
  return useMemo(() => (value: number) => formatNumber(locale, value, options), [locale, options]);
}
