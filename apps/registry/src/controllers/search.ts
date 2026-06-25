import { inject } from "@brika/di";
import type { CatalogEntry, SearchCapability, SearchSort } from "@brika/registry-core";
import { controller, route } from "../http/router";
import { Downloads, Search } from "../services";

/**
 * `GET /-/v1/search` (and its `/-/v1/packages` enumerate alias): every published package's latest
 * (non-yanked, non-taken-down) version, filtered/ranked/paginated in SQL (FTS + tag/capability) over
 * the search index. A bare request with no query/filters returns the whole bounded catalog.
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

/** Attach per-package install stats to a page of entries (the whole-catalog stats are never loaded). */
async function withDownloads(entries: readonly CatalogEntry[]) {
  const stats = await inject(Downloads).statsFor(entries.map((entry) => entry.name));
  return entries.map((entry) => ({ ...entry, downloads: stats.get(entry.name) }));
}

function jsonPage(packages: unknown[], total: number): Response {
  return Response.json({ packages, total }, { headers: { "cache-control": "public, max-age=60" } });
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

/** Comma-separated `capabilities`, keeping only valid capability kinds (OR-matched downstream). */
function parseCapabilities(raw: string | null): SearchCapability[] | undefined {
  if (raw === null) return undefined;
  const valid = [...new Set(raw.split(",").map((c) => c.trim()))].filter(
    (c): c is SearchCapability => CAPABILITIES.some((cap) => cap === c),
  );
  return valid.length > 0 ? valid : undefined;
}

export async function handleSearch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const q = url.searchParams.get("text")?.trim() || undefined;
  const sortParam = url.searchParams.get("sort");
  const sort: SearchSort = SORTS.find((s) => s === sortParam) ?? "relevance";

  const { entries, total } = await inject(Search).search({
    q,
    tags: parseTags(url.searchParams.get("tags")),
    capabilities: parseCapabilities(url.searchParams.get("capabilities")),
    sort,
    limit,
    offset,
  });

  return jsonPage(await withDownloads(entries), total);
}

export const searchController = controller({
  name: "search",
  prefix: "/-/v1",
  routes: [
    // `/packages` is the no-filter enumerate; both are served by the same SQL-backed search.
    route.get({ path: "/packages", handler: ({ req }) => handleSearch(req) }),
    route.get({ path: "/search", handler: ({ req }) => handleSearch(req) }),
  ],
});
