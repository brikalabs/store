import type { MessageKey } from "@brika/i18n";
import { createI18n } from "@brika/i18n/react";
import type enBarrel from "./locales/en";

/** The app's catalog shape (English is the source of truth for keys). */
export type AppCatalog = typeof enBarrel;
/** Every valid `"namespace:key"` for the app. A typo here is a compile error on the global `useT()`. */
export type AppKey = MessageKey<AppCatalog>;
/** Bare keys of a namespace, for typing key tables (e.g. the footer columns). */
export type FooterKey = keyof AppCatalog["footer"];
export type NavKey = keyof AppCatalog["nav"];

/**
 * The app's i18n surface, all from one import:
 * - `useT()` global typed (`t("nav:signIn")`, typos rejected), or `useT("nav")` scoped + typed.
 * - `useLocale()` for the active locale.
 * - `useDateFormat` / `useRelativeTime` / `useNumberFormat` for locale-aware formatting (no manual locale).
 */
export const { useT, useLocale } = createI18n<AppCatalog>();
export { useDateFormat, useNumberFormat, useRelativeTime } from "@brika/i18n/react";
