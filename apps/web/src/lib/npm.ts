import {
  type PluginDetail,
  PluginDetail as PluginDetailSchema,
  PluginSummary,
} from "@brika/registry-contract";
import { z } from "zod";
import {
  capabilityCounts,
  LocalizedDoc,
  mapScreenshots,
  Person,
  personName,
  Repository,
  repoUrl,
  Screenshot,
} from "./manifest-mapping";

/**
 * The npm side of the cached mirror. These helpers query the public npm
 * registry and map a packument into the `/v1` contract shapes. The sync job and
 * the cache-aside read path both build on them. npm stays authoritative for
 * what exists; the store only caches it. Field-level mapping shared with the
 * registry path lives in `./manifest-mapping`.
 */

// Localized-doc helpers are shared mapping; re-exported so consumers keep using
// the npm facade (`registry.ts`, the tests) without a second import path.
export { docLocales, type LocalizedDoc, pickDocPath } from "./manifest-mapping";

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_SEARCH = `${NPM_REGISTRY}/-/v1/search`;
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";
const BRIKA_KEYWORD = "keywords:brika";
const JSDELIVR_CDN = "https://cdn.jsdelivr.net/npm";

const NpmVersionManifest = z.object({
  version: z.string(),
  description: z.string().optional(),
  displayName: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  engines: z.object({ brika: z.string().optional() }).optional(),
  repository: Repository.optional(),
  author: Person.optional(),
  icon: z.string().optional(),
  screenshots: z.array(Screenshot).optional(),
  readme: LocalizedDoc.optional(),
  changelog: LocalizedDoc.optional(),
  grants: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  blocks: z.array(z.unknown()).optional(),
  bricks: z.array(z.unknown()).optional(),
  sparks: z.array(z.unknown()).optional(),
  pages: z.array(z.unknown()).optional(),
  deprecated: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  dist: z.object({ integrity: z.string().optional(), shasum: z.string().optional() }).optional(),
});
type VersionManifest = z.infer<typeof NpmVersionManifest>;

const Packument = z.object({
  name: z.string(),
  "dist-tags": z.object({ latest: z.string().optional() }).optional(),
  versions: z.record(z.string(), NpmVersionManifest).optional(),
  time: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  homepage: z.string().optional(),
  license: z.string().optional(),
  readme: z.string().optional(),
  author: Person.optional(),
  maintainers: z.array(Person).optional(),
  repository: Repository.optional(),
});
export type Packument = z.infer<typeof Packument>;

const NpmSearchResponse = z.object({
  objects: z.array(
    z.object({
      package: z.object({
        name: z.string(),
        version: z.string(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        date: z.string().optional(),
      }),
    }),
  ),
  total: z.number(),
});

const DownloadsPoint = z.object({ downloads: z.number() });

/** npm scoped names need the slash encoded in registry paths. */
function encodeName(name: string): string {
  return name.replace("/", "%2F");
}

export interface NpmSearchHit {
  name: string;
  version: string;
  description?: string;
  keywords: string[];
  date?: string;
}

/** Enumerate Brika plugins on npm (keyword-scoped). Returns names + raw hits. */
export async function searchNpm(
  query: string | undefined,
  size: number,
  from: number,
): Promise<{ hits: NpmSearchHit[]; total: number }> {
  const text = [BRIKA_KEYWORD, query?.trim()].filter((part) => part && part.length > 0).join(" ");
  const url = new URL(NPM_SEARCH);
  url.searchParams.set("text", text);
  url.searchParams.set("size", String(Math.min(size, 250)));
  url.searchParams.set("from", String(from));
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return { hits: [], total: 0 };
  const json: unknown = await res.json();
  const parsed = NpmSearchResponse.safeParse(json);
  if (!parsed.success) return { hits: [], total: 0 };
  return {
    total: parsed.data.total,
    hits: parsed.data.objects.map((o) => ({
      name: o.package.name,
      version: o.package.version,
      description: o.package.description,
      keywords: o.package.keywords ?? [],
      date: o.package.date,
    })),
  };
}

export async function getPackument(name: string): Promise<Packument | null> {
  const res = await fetch(`${NPM_REGISTRY}/${encodeName(name)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = Packument.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export async function getWeeklyDownloads(name: string): Promise<number> {
  const res = await fetch(`${NPM_DOWNLOADS}/${encodeName(name)}`);
  if (!res.ok) return 0;
  const json: unknown = await res.json();
  const parsed = DownloadsPoint.safeParse(json);
  return parsed.success ? parsed.data.downloads : 0;
}

/**
 * Resolve the author shown on a plugin. The stable id is the npm maintainer
 * username (used for profiles + maintainer search); the display name falls back
 * to the manifest/packument author field.
 */
function resolveAuthor(manifest: VersionManifest, pkg: Packument) {
  const authorName = personName(manifest.author ?? pkg.author);
  const authorId = personName(pkg.maintainers?.[0]) ?? authorName;
  return authorId === undefined ? undefined : { id: authorId, name: authorName, verified: false };
}

/**
 * Map a packument to a `PluginDetail`. Returns null when the latest version is
 * not a Brika plugin (no `engines.brika`), so callers can skip non-plugins.
 */
export function toPluginDetail(pkg: Packument, downloadsWeekly: number): PluginDetail | null {
  const latest = pkg["dist-tags"]?.latest;
  if (latest === undefined) return null;
  const manifest = pkg.versions?.[latest];
  if (manifest === undefined) return null;
  const brikaEngine = manifest.engines?.brika;
  if (brikaEngine === undefined) return null;

  const candidate = {
    name: pkg.name,
    displayName: manifest.displayName,
    description: manifest.description ?? pkg.description,
    version: latest,
    author: resolveAuthor(manifest, pkg),
    keywords: manifest.keywords ?? [],
    iconUrl: manifest.icon ? cdnFileUrl(pkg.name, latest, manifest.icon) : undefined,
    screenshots: mapScreenshots(manifest.screenshots, (path) => cdnFileUrl(pkg.name, latest, path)),
    downloadsWeekly,
    brikaEngine,
    repository: repoUrl(manifest.repository ?? pkg.repository),
    homepage: manifest.homepage ?? pkg.homepage,
    license: manifest.license ?? pkg.license,
    capabilities: capabilityCounts(manifest),
    grants: manifest.grants ?? {},
    integrity: manifest.dist?.integrity,
    shasum: manifest.dist?.shasum,
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    devDependencies: manifest.devDependencies,
    devDependencyCount: manifest.devDependencies
      ? Object.keys(manifest.devDependencies).length
      : undefined,
    publishedAt: pkg.time?.created,
    updatedAt: pkg.time?.[latest],
  };
  const parsed = PluginDetailSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Project a `PluginDetail` down to the lighter `PluginSummary`. */
export function toPluginSummary(detail: PluginDetail): z.infer<typeof PluginSummary> {
  return PluginSummary.parse(detail);
}

/** Build a jsDelivr CDN URL for a file inside a published package. */
export function cdnFileUrl(name: string, version: string, path: string): string {
  const clean = path.replace(/^\.?\//, "");
  return `${JSDELIVR_CDN}/${name}@${version}/${clean}`;
}

/** Fetch a single declared file from a package on jsDelivr, or null. */
export async function fetchCdnText(
  name: string,
  version: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(cdnFileUrl(name, version, path));
  return res.ok ? res.text() : null;
}
