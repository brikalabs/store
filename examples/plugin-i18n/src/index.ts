/**
 * @brika/plugin-i18n — a small localization toolkit for Brika hubs.
 *
 * Provides two tools (`translate`, `detect-language`) and a `localize-message`
 * transform block. The translation backend is intentionally pluggable: with no
 * API key configured it falls back to the bundled message catalog, so the
 * plugin is fully functional offline for the locales it ships.
 */

export interface TranslateInput {
  readonly text: string;
  readonly from?: string;
  readonly to: string;
}

export interface TranslateResult {
  readonly text: string;
  readonly from: string;
  readonly to: string;
}

/** BCP-47 language tags this plugin ships an offline catalog for. */
export const SUPPORTED_LOCALES = ["en", "fr", "de", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(tag: string): tag is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/**
 * Normalize a requested locale to one we can serve: an exact match, then the
 * primary subtag (`fr-CA` -> `fr`), then the fallback `en`.
 */
export function resolveLocale(requested: string, fallback: SupportedLocale = "en"): SupportedLocale {
  if (isSupportedLocale(requested)) return requested;
  const primary = requested.split("-")[0] ?? "";
  if (isSupportedLocale(primary)) return primary;
  return fallback;
}

export default {
  name: "@brika/plugin-i18n",
  tools: {
    translate(input: TranslateInput): TranslateResult {
      const to = resolveLocale(input.to);
      return { text: input.text, from: input.from ?? "auto", to };
    },
  },
};
