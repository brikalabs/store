/**
 * Store i18n configuration: the one place to tune locale behavior.
 *
 * The set of supported locales is AUTO-DETECTED from the `locales/<code>/` folders (see
 * `catalog.ts`), so adding a language is just dropping a folder, no list to maintain. This file only
 * sets the default, the cookie name, and an optional display order for the switcher.
 */
export const i18nConfig = {
  /** Locale used when a request has no usable cookie and no `Accept-Language` match. */
  defaultLocale: "en",
  /** Cookie that stores the user's explicit choice (overrides `Accept-Language`). */
  cookie: "brika-locale",
  /** Switcher display order; any detected locale not listed here is appended alphabetically. */
  order: ["en", "fr", "es", "de", "ja", "pt-BR"],
} as const;
