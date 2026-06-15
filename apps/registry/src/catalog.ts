import { env } from "cloudflare:workers";
import { getDb, regDistTags, regPackages, regVersions } from "@brika/store-db";
import { and, eq } from "drizzle-orm";

/**
 * `GET /-/v1/packages` - a small catalog of every published package's latest
 * (non-yanked) version, so the storefront can enumerate `@brika/*` plugins. The
 * npm protocol has no list endpoint; this is our minimal addition. The hosted
 * `@brika` scope is bounded (see REGISTRY_LIMITS.maxPackagesPerScope), so reading
 * every latest row and filtering/paginating in memory is cheap and exact.
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
async function readCatalog(): Promise<CatalogEntry[]> {
  const db = getDb(env.DB);
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

export async function handleCatalog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const text = url.searchParams.get("text")?.trim();

  const all = await readCatalog();
  const filtered = text ? all.filter((entry) => matchesQuery(entry, text)) : all;
  const packages = filtered.slice(offset, offset + limit);

  return Response.json(
    { packages, total: filtered.length },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
