import { inject } from "@brika/di";
import type { CatalogEntry, SearchCapability, SearchSort } from "@brika/registry-core";
import { controller, route } from "../http/router";
import { Catalog, Downloads, Search } from "../services";

/**
 * `GET /-/v1/packages` - the bounded catalog of every published package's latest (non-yanked)
 * version, so the storefront can enumerate `@brika/*` plugins. `GET /-/v1/search` is the same
 * shape but filtered/ranked/paginated in SQL (FTS + tag/capability) for actual searches.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

const SORTS = ["relevance", "downloads", "recent", "name"] as const;
const CAPABILITIES = ["tools", "blocks", "bricks", "sparks", "pages"] as const;

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

/** Attach per-package install stats to a page of entries (the whole-catalog stats are never loaded). */
async function withDownloads(entries: readonly CatalogEntry[]) {
  const stats = await inject(Downloads).statsFor(entries.map((entry) => entry.name));
  return entries.map((entry) => ({ ...entry, downloads: stats.get(entry.name) }));
}

function jsonPage(packages: unknown[], total: number): Response {
  return Response.json({ packages, total }, { headers: { "cache-control": "public, max-age=60" } });
}

export async function handleCatalog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const text = url.searchParams.get("text")?.trim();

  const all = await inject(Catalog).list();
  const filtered = text ? all.filter((entry) => matchesQuery(entry, text)) : all;
  const page = filtered.slice(offset, offset + limit);

  return jsonPage(await withDownloads(page), filtered.length);
}

/** Comma-separated `tags`, deduped and lowercased for case-insensitive AND-matching. */
function parseTags(raw: string | null): string[] | undefined {
  if (raw === null) return undefined;
  const tags = [
    ...new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  ];
  return tags.length > 0 ? tags : undefined;
}

export async function handleSearch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const q = url.searchParams.get("text")?.trim() || undefined;
  const sortParam = url.searchParams.get("sort");
  const sort: SearchSort = SORTS.find((s) => s === sortParam) ?? "relevance";
  const capParam = url.searchParams.get("capability");
  const capability: SearchCapability | undefined = CAPABILITIES.find((c) => c === capParam);

  const { entries, total } = await inject(Search).search({
    q,
    tags: parseTags(url.searchParams.get("tags")),
    capability,
    sort,
    limit,
    offset,
  });

  return jsonPage(await withDownloads(entries), total);
}

export const catalogController = controller({
  name: "catalog",
  prefix: "/-/v1",
  routes: [
    route.get({ path: "/packages", handler: ({ req }) => handleCatalog(req) }),
    route.get({ path: "/search", handler: ({ req }) => handleSearch(req) }),
  ],
});
