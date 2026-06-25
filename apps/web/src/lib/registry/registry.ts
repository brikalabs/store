import type { PluginSummary, PluginVersion } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { isRegistryName } from "@/lib/registry/registry-http";
import { versionsFromPackument } from "@/lib/registry/registry-mappers";
import {
  getRegistryPluginPage,
  type RegistryPluginPage,
} from "@/lib/registry/registry-plugin-page";
import {
  getRegistryPackument,
  getRegistryScope,
  listRegistryPlugins,
  searchRegistryPlugins,
} from "@/lib/registry/registry-source";

/**
 * The store's read model: every listed plugin is hosted on the Brika registry and read through its
 * npm-compatible HTTP surface. npm stays a consumption target but is never a listing/discovery
 * source - the store lists only what is published here, verified.
 */

const BROWSE_LIMIT = 12;
// The hosted catalog is bounded (REGISTRY_LIMITS.maxPackagesPerScope), so one capped read covers every scope.
const CATALOG_SCAN = 200;

/** Narrowing filters layered on top of the free-text query (all optional). */
export interface PluginSearchOptions {
  readonly tags?: readonly string[];
  readonly capability?: string;
  readonly sort?: string;
}

/**
 * Search the catalog through the registry's SQL search: free-text (FTS) plus optional tag/capability
 * filters and sort, all pushed down with pagination. A bare call (no query, no filters) returns the
 * whole bounded catalog, ranked by the default sort.
 */
export async function searchPlugins(
  query: string | undefined,
  limit = BROWSE_LIMIT,
  offset = 0,
  options: PluginSearchOptions = {},
): Promise<{ plugins: PluginSummary[]; total: number }> {
  return searchRegistryPlugins({ q: query, ...options, limit, offset });
}

/** The full plugin-detail page for a hosted `@brika/*` plugin; null for any name not hosted here (route 404s). */
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

/** The public scope page (`/@scope`): the scope's profile from the registry's scope entity plus every
 * plugin published under it. A scope IS the account (ORG-003/009/010). Null when the scope is
 * unknown/taken-down AND hosts no listed plugin. The entity fetch and catalog scan overlap. */
export async function getScopePage(scope: string): Promise<ScopePage | null> {
  const [entity, { plugins: all }] = await Promise.all([
    getRegistryScope(scope),
    listRegistryPlugins(undefined, CATALOG_SCAN, 0),
  ]);
  const plugins = all.filter((plugin) => scopeOf(plugin.name) === scope);
  // 404 only when the scope neither exists as an entity nor hosts a listed plugin.
  if (entity === null && plugins.length === 0) return null;
  // The catalog publisher (when present) is the verified attribution; otherwise the scope entity's name.
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
