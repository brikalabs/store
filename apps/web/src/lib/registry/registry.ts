import type { PluginSummary, PluginVersion } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import {
  getRegistryPackument,
  getRegistryPluginPage,
  getRegistryScope,
  isRegistryName,
  listRegistryPlugins,
  type RegistryPluginPage,
  versionsFromPackument,
} from "@/lib/registry/registry-source";

/**
 * The store's read model. Every listed plugin is hosted on the Brika registry and
 * read through its npm-compatible HTTP surface (packument + tarball + catalog).
 * npm stays a *consumption* target (`bun add`/`npm install` still resolve), but it
 * is never a listing or discovery source - the store lists only what is published
 * here, verified.
 */

const BROWSE_LIMIT = 12;
// Upper bound for a scope aggregation scan. The hosted catalog is bounded
// (REGISTRY_LIMITS.maxPackagesPerScope), so one capped read covers every scope.
const CATALOG_SCAN = 200;

export async function searchPlugins(
  query: string | undefined,
  limit = BROWSE_LIMIT,
  offset = 0,
): Promise<{ plugins: PluginSummary[]; total: number }> {
  return listRegistryPlugins(query, limit, offset);
}

/**
 * The full plugin-detail page for a hosted `@brika/*` plugin. Returns null for any
 * name not hosted here (the store does not render npm packages), so the route 404s.
 */
export function getPluginPage(name: string, locale?: string): Promise<RegistryPluginPage | null> {
  return isRegistryName(name) ? getRegistryPluginPage(name, locale) : Promise.resolve(null);
}

export async function getPluginVersions(name: string): Promise<PluginVersion[] | null> {
  if (!isRegistryName(name)) return null;
  const pkg = await getRegistryPackument(name);
  return pkg === null ? null : versionsFromPackument(pkg);
}

export interface ScopePage {
  readonly scope: string;
  /** The verified publisher's display name, when set (falls back to the scope). */
  readonly displayName: string | null;
  readonly verified: boolean;
  readonly description: string | null;
  readonly links: { label: string; url: string }[];
  readonly hasIcon: boolean;
  readonly verifiedDomains: string[];
  readonly plugins: PluginSummary[];
}

/**
 * The public scope page (`/@scope`): the scope's profile (display name, description, links,
 * icon, verified domains) from the registry's scope entity, plus every plugin published
 * under it. A scope IS the account, so the header reads off the scope record (ORG-003/009/010).
 * Returns null when the scope is unknown/taken-down AND hosts no listed plugin, so the route
 * 404s. The scope-entity fetch and the catalog scan are independent, so they overlap.
 */
export async function getScopePage(scope: string): Promise<ScopePage | null> {
  const [entity, { plugins: all }] = await Promise.all([
    getRegistryScope(scope),
    listRegistryPlugins(undefined, CATALOG_SCAN, 0),
  ]);
  const plugins = all.filter((plugin) => scopeOf(plugin.name) === scope);
  // 404 only when the scope neither exists as an entity nor hosts a listed plugin.
  if (entity === null && plugins.length === 0) return null;
  // The catalog publisher (when present) is the verified attribution; otherwise the
  // scope entity's own display name. Either way the scope page is a verified surface.
  const publisher = plugins[0]?.author;
  return {
    scope,
    displayName: entity?.displayName ?? publisher?.name ?? null,
    verified: entity !== null || (publisher?.verified ?? false),
    description: entity?.description ?? null,
    links: entity?.links ?? [],
    hasIcon: entity?.hasIcon ?? false,
    verifiedDomains: entity?.verifiedDomains ?? [],
    plugins,
  };
}

export type { RegistryScope } from "@/lib/registry/registry-source";
