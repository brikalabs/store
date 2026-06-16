import type { DeveloperProfile, PluginDetail, PluginSummary } from "@brika/registry-contract";
import { hashString } from "../components/clay/gradients";

/**
 * Demo enrichment. npm doesn't carry ratings, per-listing weekly downloads on
 * search results, curation flags, or a localized-listing manifest, so the
 * marketplace would render half-empty against live data. We synthesize stable
 * values from the entity name (deterministic: the same plugin always looks the
 * same) so every screen shows the full design.
 *
 * This is a presentation shim, isolated on purpose: delete this module and drop
 * the `demo*` calls in `registry.ts` once the D1 social/curation tables land.
 */

const LOCALE_POOL = ["en", "fr", "de", "es", "ja", "zh", "pt", "it", "nl", "ko"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Fill a summary's missing rating, downloads, and curation flags. */
export function demoSummary<T extends PluginSummary>(plugin: T): T {
  const h = hashString(plugin.name);
  return {
    ...plugin,
    rating: plugin.rating ?? { average: round1(3.9 + (h % 11) / 10), count: 18 + (h % 540) },
    downloadsWeekly: plugin.downloadsWeekly > 0 ? plugin.downloadsWeekly : 4000 + (h % 200) * 920,
    verified: plugin.verified || h % 5 < 3,
    featured: plugin.featured || h % 7 === 0,
  };
}

// A pool of realistic *scoped* grants for npm plugins, which carry none of
// their own. The value is the requested scope (the same shape registry plugins
// declare), so the Permissions section renders real host/path/secret scopes.
const PERMISSION_POOL: { key: string; scope: unknown }[] = [
  { key: "dev.brika.net.fetch", scope: { allow: ["api.openai.com", "*.githubusercontent.com"] } },
  { key: "dev.brika.secrets.get", scope: { keys: ["apiKey"] } },
  { key: "dev.brika.secrets.set", scope: { keys: ["apiKey"] } },
  { key: "dev.brika.fs.read", scope: { paths: ["/bundle", "/data/**"] } },
  { key: "dev.brika.storage.kv", scope: { namespaces: ["cache"] } },
];

/**
 * Fill a plugin's missing permission grants with a stable, scoped set. Real
 * grants (registry plugins) pass through untouched so their declared scope is
 * preserved; npm plugins, which carry none, get a deterministic synthesized set.
 */
export function demoGrants(name: string, real: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(real).length > 0) return real;
  const h = hashString(name);
  const count = 2 + (h % 3); // 2..4 permissions
  const out: Record<string, unknown> = {};
  for (let index = 0; index < count; index += 1) {
    const permission = PERMISSION_POOL[
      (h + index) % PERMISSION_POOL.length
    ] as (typeof PERMISSION_POOL)[number];
    out[permission.key] = permission.scope;
  }
  return out;
}

/** Enrich full plugin detail (summary fields + described permission grants). */
export function demoDetail(detail: PluginDetail): PluginDetail {
  return {
    ...demoSummary(detail),
    grants: demoGrants(detail.name, detail.grants),
  };
}

/** Stable list of locale codes a plugin "ships", with `en` always first. */
export function demoLocales(name: string, real: string[]): string[] {
  if (real.length > 0) return real;
  const h = hashString(name);
  const count = 1 + (h % 6); // 1..6 languages
  return [
    "en",
    ...LOCALE_POOL.slice(1, count).filter((_, i) => (h >> i) % 2 === 0 || i < count - 1),
  ].slice(0, count);
}

/** Fill a developer profile's missing bio and verification for the profile page. */
export function demoProfile(profile: DeveloperProfile, pluginCount: number): DeveloperProfile {
  const h = hashString(profile.id);
  const plural = pluginCount === 1 ? "plugin" : "plugins";
  return {
    ...profile,
    verified: profile.verified || h % 4 < 3,
    bio:
      profile.bio ??
      `Maintainer of ${pluginCount} Brika ${plural}, published to npm and mirrored here.`,
  };
}
