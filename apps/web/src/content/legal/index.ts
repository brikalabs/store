import { defaultLocale } from "@/i18n/catalog";

/** The legal/policy documents, one markdown file per locale under `<locale>/<slug>.md`. */
export type LegalSlug = "terms" | "privacy" | "licenses" | "cookies" | "acceptable-use";

// One line of bundler glob; markdown is loaded raw (the renderer parses it). Auto-discovers a new
// locale folder or document.
const files = import.meta.glob<string>("./*/*.md", {
  query: "?raw",
  eager: true,
  import: "default",
});

const byLocale: Record<string, Record<string, string>> = {};
for (const [path, raw] of Object.entries(files)) {
  const match = /\/([^/]+)\/([^/]+)\.md$/.exec(path);
  if (!match) continue;
  const [, locale, slug] = match;
  if (!locale || !slug) continue;
  const docs = byLocale[locale] ?? {};
  docs[slug] = raw;
  byLocale[locale] = docs;
}

/** The markdown for `slug` in `locale`, falling back to the default locale, then empty. */
export function legalDoc(slug: LegalSlug, locale: string): string {
  return byLocale[locale]?.[slug] ?? byLocale[defaultLocale]?.[slug] ?? "";
}
