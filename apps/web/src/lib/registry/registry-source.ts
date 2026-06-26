import type { SearchResponse } from "@brika/registry-contract";
import { tarballPath } from "@brika/registry-core";
import { npmLink } from "@brika/router/npm";
import { REGISTRY_ORIGIN, registryFetch, registryGet } from "@/lib/registry/registry-http";
import { mapCatalogPackages } from "@/lib/registry/registry-mappers";
import {
  CatalogResponse,
  DownloadsResponse,
  Packument,
  ScopeInfo,
} from "@/lib/registry/registry-wire";

/**
 * The registry read surface: each function GETs one resource over the npm-compatible HTTP API
 * (packument, tarball, downloads, scope, catalog, search) and maps it into the store's read model,
 * degrading to an empty fallback when the registry is unreachable or returns an unexpected shape.
 */

export function getRegistryPackument(name: string): Promise<Packument | null> {
  return registryGet(npmLink("/:name", { name }), Packument);
}

export interface RegistryDownloads {
  readonly total: number;
  readonly weekly: number;
  /** Trailing 30-day per-day install counts (oldest first) for the sparkline. */
  readonly series: number[];
}

const NO_DOWNLOADS: RegistryDownloads = { total: 0, weekly: 0, series: [] };

/** Install stats for a package (all-time + trailing week + series); zero on failure. */
export async function getRegistryDownloads(name: string): Promise<RegistryDownloads> {
  const data = await registryGet(npmLink("/-/v1/downloads/:name", { name }), DownloadsResponse);
  return data === null
    ? NO_DOWNLOADS
    : { total: data.total, weekly: data.weekly, series: data.series ?? [] };
}

export async function fetchRegistryTarball(
  name: string,
  version: string,
): Promise<Uint8Array | null> {
  const res = await registryFetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
  if (!res?.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** A scope's public info: scope, display name, profile, verified domains. */
export interface RegistryScope {
  readonly scope: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: { label: string; url: string }[];
  readonly hasIcon: boolean;
  readonly verified: boolean;
  readonly verifiedDomains: string[];
}

/** Fetch a public scope's info (`GET /-/scope/:scope`), or null when it does not exist or is taken down.
 * The scope is URL-encoded as a single segment (`@brika` -> `%40brika`). */
export async function getRegistryScope(scope: string): Promise<RegistryScope | null> {
  const data = await registryGet(`/-/scope/${encodeURIComponent(scope)}`, ScopeInfo);
  if (data === null) return null;
  return {
    scope: data.scope,
    displayName: data.displayName,
    description: data.description,
    links: data.links,
    hasIcon: data.iconKey !== null,
    verified: data.verified,
    verifiedDomains: data.verifiedDomains,
  };
}

/** Shape a catalog response (or a failed read) into the `{ plugins, total }` the store consumes. */
function toCatalogResult(data: CatalogResponse | null): SearchResponse {
  return data === null
    ? { plugins: [], total: 0 }
    : { plugins: mapCatalogPackages(data.packages), total: data.total };
}

/** A search over hosted plugins: free-text plus tag (AND) and capability (OR) filters, sort and pagination. */
export interface PluginSearchParams {
  readonly q?: string;
  readonly tags?: readonly string[];
  readonly capabilities?: readonly string[];
  /** Restrict to this "approved by Brika" verified state; absent includes both. */
  readonly verified?: boolean;
  readonly sort?: string;
  readonly limit: number;
  readonly offset: number;
}

/** Serialize a repeatable filter as a comma list, or drop it when empty. */
const csv = (values?: readonly string[]): string | undefined =>
  values && values.length > 0 ? values.join(",") : undefined;

/** Search hosted `@brika/*` plugins via the registry's SQL-backed search endpoint (FTS + filters + sort). */
export async function searchRegistryPlugins(params: PluginSearchParams): Promise<SearchResponse> {
  return toCatalogResult(
    await registryGet("/-/v1/search", CatalogResponse, {
      text: params.q?.trim(),
      tags: csv(params.tags),
      capabilities: csv(params.capabilities),
      verified: params.verified === undefined ? undefined : String(params.verified),
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    }),
  );
}
