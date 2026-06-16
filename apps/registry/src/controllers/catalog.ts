import type { DownloadStats } from "@brika/registry-core";
import { type Db, regDistTags, regPackages, regVersions } from "@brika/store-db";
import { and, eq } from "drizzle-orm";
import { controller, route } from "../http/router";
import type { Services } from "../services";

/**
 * `GET /-/v1/packages` - a small catalog of every published package's latest
 * (non-yanked) version, so the storefront can enumerate `@brika/*` plugins. The
 * npm protocol has no list endpoint; this is our minimal addition. The hosted
 * `@brika` scope is bounded (see REGISTRY_LIMITS.maxPackagesPerScope), so reading
 * every latest row and filtering/paginating in memory is cheap and exact. Each
 * entry carries its install stats so a listing renders counts without N reads.
 */

export interface CatalogEntry {
  readonly name: string;
  readonly version: string;
  /** The published package.json for the latest version. */
  readonly manifest: Record<string, unknown>;
  /** ISO-8601 publish time of the latest version. */
  readonly publishedAt: string;
  /** ISO-8601 time the package was first created. */
  readonly createdAt: string;
  readonly size: number;
  readonly integrity: string;
  readonly downloads?: DownloadStats;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** Free-text match over the fields a person would search by. */
function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const manifest = entry.manifest;
  const keywords = Array.isArray(manifest.keywords) ? manifest.keywords : [];
  const haystack = [entry.name, manifest.displayName, manifest.description, ...keywords]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** Every package's latest non-yanked version, newest first. */
async function readCatalog(db: Db): Promise<CatalogEntry[]> {
  const rows = await db
    .select({
      name: regDistTags.name,
      version: regDistTags.version,
      manifest: regVersions.manifest,
      publishedAt: regVersions.publishedAt,
      createdAt: regPackages.createdAt,
      size: regVersions.size,
      integrity: regVersions.integrity,
      yanked: regVersions.yanked,
    })
    .from(regDistTags)
    .innerJoin(
      regVersions,
      and(eq(regVersions.name, regDistTags.name), eq(regVersions.version, regDistTags.version)),
    )
    .innerJoin(regPackages, eq(regPackages.name, regDistTags.name))
    .where(eq(regDistTags.tag, "latest"));

  return rows
    .filter((row) => !row.yanked)
    .map((row) => ({
      name: row.name,
      version: row.version,
      manifest: row.manifest,
      publishedAt: new Date(row.publishedAt * 1000).toISOString(),
      createdAt: new Date(row.createdAt * 1000).toISOString(),
      size: row.size,
      integrity: row.integrity,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function handleCatalog(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const text = url.searchParams.get("text")?.trim();

  const all = await readCatalog(services.db);
  const filtered = text ? all.filter((entry) => matchesQuery(entry, text)) : all;
  const page = filtered.slice(offset, offset + limit);

  // Attach install stats for just this page's packages (not the whole catalog).
  const stats = await services.downloads.statsFor(page.map((entry) => entry.name));
  const packages = page.map((entry) => ({ ...entry, downloads: stats.get(entry.name) }));

  return Response.json(
    { packages, total: filtered.length },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}

export const catalogController = controller({
  name: "catalog",
  prefix: "/-/v1",
  routes: [route.get({ path: "/packages", handler: ({ req, ctx }) => handleCatalog(req, ctx) })],
});
