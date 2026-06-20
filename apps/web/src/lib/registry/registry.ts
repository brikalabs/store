import type { PluginSummary, PluginVersion } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import {
  getRegistryOrg,
  getRegistryPackument,
  getRegistryPluginPage,
  isRegistryName,
  listRegistryPlugins,
  type RegistryOrg,
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
// Upper bound for a scope/org aggregation scan. The hosted catalog is bounded
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
  /** The verified publisher's display name (the owning org), when known. */
  readonly displayName: string | null;
  readonly verified: boolean;
  readonly plugins: PluginSummary[];
}

/**
 * The public scope page (`/@scope`): every plugin published under a scope, with the
 * scope's verified publisher (its owning org) for the header. Returns null when the
 * scope hosts no listed plugin, so the route 404s. Derived from the same catalog the
 * browse grid reads, so it carries real install counts + integrity.
 */
export async function getScopePage(scope: string): Promise<ScopePage | null> {
  const { plugins: all } = await listRegistryPlugins(undefined, CATALOG_SCAN, 0);
  const plugins = all.filter((plugin) => scopeOf(plugin.name) === scope);
  if (plugins.length === 0) return null;
  const publisher = plugins[0]?.author;
  return {
    scope,
    displayName: publisher?.name ?? null,
    verified: publisher?.verified ?? false,
    plugins,
  };
}

/**
 * The public organisation page (ORG-003): the org's verified display name + the plugins it
 * publishes, aggregated across every scope it owns. Returns null for an unknown org (the
 * route 404s). The catalog already excludes yanked/taken-down versions, so a plugin with no
 * live version drops out of the listing (ORG-003-AC2).
 */
export async function getOrgPage(
  slug: string,
): Promise<{ org: RegistryOrg; plugins: PluginSummary[] } | null> {
  // The org lookup and the catalog scan are independent, so overlap their round-trips; the
  // scope filter below only needs the org's scopes once both have resolved.
  const [org, catalog] = await Promise.all([
    getRegistryOrg(slug),
    listRegistryPlugins(undefined, CATALOG_SCAN, 0),
  ]);
  if (org === null) return null;
  const owned = new Set(org.scopes);
  const mine = catalog.plugins.filter((plugin) => {
    const scope = scopeOf(plugin.name);
    return scope !== null && owned.has(scope);
  });
  return { org, plugins: mine };
}
