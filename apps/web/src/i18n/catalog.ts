import { defineI18n } from "@brika/i18n";

/**
 * Store i18n config: the whole runtime is assembled by the `@brika/i18n` engine from this one call.
 * Supported locales are auto-detected from the `locales/<code>/` folders, so adding a language is just
 * dropping a folder of JSON. `order` is an optional switcher display order; `dev` enables the `cimode`
 * key-inspection locale.
 */
export const i18n = defineI18n({
  messages: import.meta.glob<Record<string, string>>("./locales/*/*.json", {
    eager: true,
    import: "default",
  }),
  defaultLocale: "en",
  cookie: "brika-locale",
  order: ["en", "fr", "es", "de", "ja", "pt-BR"],
  dev: import.meta.env.DEV,
});
