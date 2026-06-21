import { inject } from "@brika/di";
import type { CatalogEntry } from "@brika/registry-core";
import { controller, route } from "../http/router";
import { Catalog, Downloads } from "../services";

/**
 * `GET /-/v1/packages` - a small catalog of every published package's latest
 * (non-yanked) version, so the storefront can enumerate `@brika/*` plugins. The
 * npm protocol has no list endpoint; this is our minimal addition. The catalog read
 * is the `CatalogReader` port (`inject(Catalog)`); this handler filters,
 * paginates, and attaches install stats for just the page.
 */

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

export async function handleCatalog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const text = url.searchParams.get("text")?.trim();

  const all = await inject(Catalog).list();
  const filtered = text ? all.filter((entry) => matchesQuery(entry, text)) : all;
  const page = filtered.slice(offset, offset + limit);

  // Attach install stats for just this page's packages (not the whole catalog).
  const stats = await inject(Downloads).statsFor(page.map((entry) => entry.name));
  const packages = page.map((entry) => ({ ...entry, downloads: stats.get(entry.name) }));

  return Response.json(
    { packages, total: filtered.length },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}

export const catalogController = controller({
  name: "catalog",
  prefix: "/-/v1",
  routes: [route.get({ path: "/packages", handler: ({ req }) => handleCatalog(req) })],
});
