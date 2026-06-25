import { inject } from "@brika/di";
import type { CatalogEntry, SortClause } from "@brika/registry-core";
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

/**
 * Parse a comma-separated query param into a deduped list: each value is trimmed and run through
 * `map`, and anything it drops (returns null for) is skipped. Undefined when the param is absent or
 * yields nothing.
 */
function csvList<T>(raw: string | null, map: (value: string) => T | null): T[] | undefined {
  if (raw === null) return undefined;
  const values = new Set<T>();
  for (const part of raw.split(",")) {
    const value = map(part.trim());
    if (value !== null) values.add(value);
  }
  return values.size > 0 ? [...values] : undefined;
}

/** Parse `sort=field[:dir],…` into ordered clauses, dropping unknown fields (e.g. client-only `rating`). */
function parseSort(raw: string | null): SortClause[] {
  return (raw ?? "").split(",").flatMap((token): SortClause[] => {
    const [name, dir] = token.split(":").map((part) => part.trim());
    const field = SORTS.find((s) => s === name);
    if (field === undefined) return [];
    return [dir === "asc" || dir === "desc" ? { field, direction: dir } : { field }];
  });
}

export async function handleSearch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const { entries, total } = await inject(Search).search({
    q: url.searchParams.get("text")?.trim() || undefined,
    // Tags are lowercased (AND-matched, case-insensitive); capabilities keep only valid kinds (OR-matched).
    tags: csvList(url.searchParams.get("tags"), (v) => (v.length > 0 ? v.toLowerCase() : null)),
    capabilities: csvList(
      url.searchParams.get("capabilities"),
      (v) => CAPABILITIES.find((c) => c === v) ?? null,
    ),
    sort: parseSort(url.searchParams.get("sort")),
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
