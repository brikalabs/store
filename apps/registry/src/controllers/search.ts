import { inject } from "@brika/di";
import type { CatalogEntry, SortClause } from "@brika/registry-core";
import { z } from "zod";
import { controller, route } from "../http/router";
import { Downloads, Search } from "../services";

/**
 * `GET /-/v1/search` (and its `/-/v1/packages` enumerate alias): every published package's latest
 * (non-yanked, non-taken-down) version, filtered/ranked/paginated in SQL (FTS + tag/capability) over
 * the search index. A bare request with no query/filters returns the whole bounded catalog.
 *
 * The query is parsed leniently and never 400s: out-of-range limits clamp, and unknown filter/sort
 * values are dropped. The strict, rejecting contract lives on the `/v1` web surface instead.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

const SORTS = ["relevance", "downloads", "recent", "name"] as const;
const CAPABILITIES = ["tools", "blocks", "bricks", "sparks", "pages"] as const;

/** A query integer coerced then clamped into `[min, max]`, falling back when absent or unparseable. */
const clampedInt = (fallback: number, min: number, max: number) =>
  z.coerce
    .number()
    .int()
    .catch(fallback)
    .transform((n) => Math.min(Math.max(n, min), max));

/** Split a comma list into deduped values, each trimmed and mapped (dropping what `map` rejects). */
function csvList<T>(raw: string | undefined, map: (value: string) => T | null): T[] {
  const values = new Set<T>();
  for (const part of (raw ?? "").split(",")) {
    const value = map(part.trim());
    if (value !== null) values.add(value);
  }
  return [...values];
}

/** Parse `sort=field[:dir],…` into ordered clauses, dropping unknown fields (e.g. client-only `rating`). */
function parseSort(raw: string | undefined): SortClause[] {
  return (raw ?? "").split(",").flatMap((token): SortClause[] => {
    const [name, dir] = token.split(":").map((part) => part.trim());
    const field = SORTS.find((s) => s === name);
    if (field === undefined) return [];
    return [dir === "asc" || dir === "desc" ? { field, direction: dir } : { field }];
  });
}

/** The lenient `/-/v1/search` query: tags are lowercased (AND-matched), capabilities keep valid kinds (OR). */
const SearchParams = z.object({
  text: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  limit: clampedInt(DEFAULT_LIMIT, 1, MAX_LIMIT),
  offset: clampedInt(0, 0, Number.MAX_SAFE_INTEGER),
  tags: z
    .string()
    .optional()
    .transform((raw) => csvList(raw, (v) => (v.length > 0 ? v.toLowerCase() : null))),
  capabilities: z
    .string()
    .optional()
    .transform((raw) => csvList(raw, (v) => CAPABILITIES.find((c) => c === v) ?? null)),
  sort: z.string().optional().transform(parseSort),
});

/** Attach per-package install stats to a page of entries (the whole-catalog stats are never loaded). */
async function withDownloads(entries: readonly CatalogEntry[]) {
  const stats = await inject(Downloads).statsFor(entries.map((entry) => entry.name));
  return entries.map((entry) => ({ ...entry, downloads: stats.get(entry.name) }));
}

export async function handleSearch(request: Request): Promise<Response> {
  const { text, ...query } = SearchParams.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const { entries, total } = await inject(Search).search({ q: text, ...query });
  const packages = await withDownloads(entries);
  return Response.json({ packages, total }, { headers: { "cache-control": "public, max-age=60" } });
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
