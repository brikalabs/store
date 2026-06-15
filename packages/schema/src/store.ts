import * as z from "zod";
import { PluginPackageSchema } from "./plugin";

/**
 * Store / registry metadata that sits on top of the plugin manifest.
 *
 * Following the Apple App Store / Google Play model, listable assets (icon,
 * screenshots) are referenced from `package.json` by relative path, while the
 * localized marketing copy lives in `locales/<lang>/store.json` files inside the
 * tarball. The registry treats `@brika/schema` as the single source of truth for
 * both shapes so the publish CLI, the registry worker, and the storefront all
 * validate against the same definitions.
 */

/**
 * A relative path to an asset bundled inside the published tarball. Absolute
 * paths and parent-directory traversal are rejected so a manifest can never
 * point the storefront at bytes outside the package root.
 */
const assetPath = z
  .string()
  .min(1)
  .refine(
    (value) => !value.startsWith("/") && !value.split(/[/\\]/).includes(".."),
    "must be a relative path inside the package (no leading slash, no '..')",
  )
  .describe("Path relative to the package root");

/** Maximum number of screenshots a listing may declare. */
const MAX_SCREENSHOTS = 10;

/**
 * One locale file: `locales/<lang>/store.json`. The directory name is the BCP-47
 * tag (e.g. `en`, `fr`, `pt-BR`); the default locale's title/description fall
 * back to the manifest `displayName`/`description` when a translation is absent.
 * Serve-time resolution is requested locale -> `en` -> first declared, the same
 * rule the localized readme/changelog docs use.
 *
 * `screenshotCaptions` localizes the captions for the manifest `screenshots`,
 * aligned by index; a missing or shorter entry falls back to each screenshot's
 * default `caption`.
 */
export const StoreLocaleSchema = z.object({
  title: z.string().min(1).max(80).describe("Localized plugin title"),
  description: z.string().min(1).max(4000).describe("Localized long description (markdown)"),
  screenshotCaptions: z.optional(
    z
      .array(z.string().min(1).max(120))
      .max(MAX_SCREENSHOTS)
      .describe("Localized screenshot captions, aligned by index to `screenshots`"),
  ),
});

export type StoreLocale = z.infer<typeof StoreLocaleSchema>;

// ============================================================================
// Locale-file validation (the bundled `locales/<lang>/store.json` files)
// ============================================================================

/** BCP-47-ish locale tag: a language subtag plus optional script/region subtags. */
const LOCALE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** Matches a localized store-metadata file path and captures its locale tag. */
const STORE_LOCALE_FILE = /^locales\/([^/]+)\/store\.json$/;

/**
 * The locale tag of a `locales/<lang>/store.json` path, or `null` when the path
 * is not a store-locale file (other files under `locales/`, e.g. preference
 * translations, are ignored here).
 */
export function storeLocaleOf(path: string): string | null {
  return STORE_LOCALE_FILE.exec(path)?.[1] ?? null;
}

/** One problem found in a bundled locale file, reported against its path. */
export interface LocaleIssue {
  readonly path: string;
  readonly message: string;
}

function localeFileIssues(
  path: string,
  locale: string,
  text: string,
  screenshotCount: number | undefined,
): LocaleIssue[] {
  if (!LOCALE_TAG.test(locale)) {
    return [{ path, message: `"${locale}" is not a valid locale tag (e.g. "en", "pt-BR")` }];
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [{ path, message: "is not valid JSON" }];
  }
  const result = StoreLocaleSchema.safeParse(json);
  if (!result.success) {
    return result.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return { path, message: `${where}${issue.message}` };
    });
  }
  const captions = result.data.screenshotCaptions;
  if (
    screenshotCount !== undefined &&
    captions !== undefined &&
    captions.length > screenshotCount
  ) {
    return [
      {
        path,
        message: `screenshotCaptions: ${captions.length} captions but the manifest declares ${screenshotCount} screenshot(s)`,
      },
    ];
  }
  return [];
}

/**
 * Validate every bundled `locales/<lang>/store.json` file against
 * `StoreLocaleSchema`. Non-locale files are ignored, so the whole packed file
 * list can be passed in. Pass `screenshotCount` (from the manifest) to also
 * reject a locale that declares more screenshot captions than there are
 * screenshots. Returns every issue found (empty when all files are valid).
 */
export function validateStoreLocales(
  files: ReadonlyArray<{ path: string; text: string }>,
  options: { screenshotCount?: number } = {},
): LocaleIssue[] {
  const issues: LocaleIssue[] = [];
  for (const file of files) {
    const locale = storeLocaleOf(file.path);
    if (locale === null) continue;
    issues.push(...localeFileIssues(file.path, locale, file.text, options.screenshotCount));
  }
  return issues;
}

/**
 * One screenshot/preview entry in the manifest. `caption`/`alt` are the
 * default-locale text; localized captions live in `locales/<lang>/store.json`
 * under `screenshotCaptions` (aligned by index to this ordered list).
 */
const ScreenshotSchema = z.object({
  src: assetPath.describe("Path to the screenshot image (relative to the package root)"),
  caption: z.optional(
    z.string().min(1).max(120).describe("Default caption shown beneath the image"),
  ),
  alt: z.optional(z.string().min(1).max(200).describe("Accessibility description of the image")),
});

export type StoreScreenshot = z.infer<typeof ScreenshotSchema>;

/**
 * The publish-time contract the registry enforces on top of a valid plugin
 * manifest. A listable plugin MUST carry an icon, a human title (`displayName`),
 * and a description; screenshots are optional. This is intentionally stricter
 * than `PluginPackageSchema`, where those fields are optional because the hub
 * does not need them to run a plugin, only the storefront does to list it.
 */
export const RegistryPublishSchema = PluginPackageSchema.extend({
  icon: assetPath.describe("Path to the plugin icon (PNG/SVG); required to publish"),
  displayName: z.string().min(1).max(80).describe("Human-readable title; required to publish"),
  description: z
    .string()
    .min(1)
    .max(280)
    .describe("Short tagline description; required to publish"),
  screenshots: z.optional(
    z
      .array(ScreenshotSchema)
      .max(MAX_SCREENSHOTS)
      .describe("Ordered screenshots shown on the listing (each with an optional caption/alt)"),
  ),
});

export type RegistryPublishManifest = z.infer<typeof RegistryPublishSchema>;
