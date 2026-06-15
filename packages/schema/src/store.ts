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

/**
 * One locale file: `locales/<lang>/store.json`. The directory name is the BCP-47
 * tag (e.g. `en`, `fr`, `pt-BR`); the default locale's title/description fall
 * back to the manifest `displayName`/`description` when a translation is absent.
 */
export const StoreLocaleSchema = z.object({
  title: z.string().min(1).max(80).describe("Localized plugin title"),
  tagline: z.optional(z.string().min(1).max(120).describe("Short one-line summary")),
  description: z.string().min(1).max(4000).describe("Localized long description (markdown)"),
  keywords: z.optional(z.array(z.string().min(1)).max(20).describe("Localized search keywords")),
});

export type StoreLocale = z.infer<typeof StoreLocaleSchema>;

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
    z.array(assetPath).max(10).describe("Screenshot/preview image paths shown on the listing"),
  ),
});

export type RegistryPublishManifest = z.infer<typeof RegistryPublishSchema>;
