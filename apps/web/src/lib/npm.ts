import {
  type PluginDetail,
  PluginDetail as PluginDetailSchema,
  PluginSummary,
} from "@brika/registry-contract";
import { z } from "zod";

/**
 * The npm side of the cached mirror. These helpers query the public npm
 * registry and map a packument into the `/v1` contract shapes. The sync job and
 * the cache-aside read path both build on them. npm stays authoritative for
 * what exists; the store only caches it.
 */

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_SEARCH = `${NPM_REGISTRY}/-/v1/search`;
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";
const BRIKA_KEYWORD = "keywords:brika";
const JSDELIVR_CDN = "https://cdn.jsdelivr.net/npm";

/**
 * A document declared in the manifest: a single path, or a map of locale code
 * to path for localized documents, e.g.
 * `"readme": { "en": "./README.md", "fr": "./README.fr.md" }`.
 */
const LocalizedDoc = z.union([z.string(), z.record(z.string(), z.string())]);
export type LocalizedDoc = z.infer<typeof LocalizedDoc>;

const NpmPerson = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  }),
]);

const NpmRepository = z.union([z.string(), z.object({ url: z.string().optional() })]);

const NpmVersionManifest = z.object({
  version: z.string(),
  description: z.string().optional(),
  displayName: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  engines: z.object({ brika: z.string().optional() }).optional(),
  repository: NpmRepository.optional(),
  author: NpmPerson.optional(),
  icon: z.string().optional(),
  // Screenshots are objects `{ src, caption?, alt? }` (current schema); plain
  // string paths are still accepted for manifests published before that change.
  screenshots: z
    .array(
      z.union([
        z.string(),
        z.object({
          src: z.string(),
          caption: z.string().optional(),
          alt: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  readme: LocalizedDoc.optional(),
  changelog: LocalizedDoc.optional(),
  grants: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  blocks: z.array(z.unknown()).optional(),
  bricks: z.array(z.unknown()).optional(),
  sparks: z.array(z.unknown()).optional(),
  pages: z.array(z.unknown()).optional(),
  deprecated: z.string().optional(),
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
  author: NpmPerson.optional(),
  maintainers: z.array(NpmPerson).optional(),
  repository: NpmRepository.optional(),
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

function personName(person: z.infer<typeof NpmPerson> | undefined): string | undefined {
  if (person === undefined) return undefined;
  if (typeof person === "string") {
    const stripped = person
      .replace(/\s*<[^>]*>/, "")
      .replace(/\s*\([^)]*\)/, "")
      .trim();
    return stripped.length > 0 ? stripped : undefined;
  }
  return person.name;
}

function repoUrl(repo: z.infer<typeof NpmRepository> | undefined): string | undefined {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (raw === undefined || raw.length === 0) return undefined;
  if (raw.startsWith("github:")) return `https://github.com/${raw.slice("github:".length)}`;
  const cleaned = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  if (cleaned.startsWith("git://")) return `https://${cleaned.slice("git://".length)}`;
  if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) return cleaned;
  return undefined;
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

/** Count each capability kind a manifest declares (absent arrays count as 0). */
function capabilityCounts(manifest: VersionManifest) {
  return {
    tools: manifest.tools?.length ?? 0,
    blocks: manifest.blocks?.length ?? 0,
    bricks: manifest.bricks?.length ?? 0,
    sparks: manifest.sparks?.length ?? 0,
    pages: manifest.pages?.length ?? 0,
  };
}

/** Map declared screenshots to CDN-backed `{ url, caption?, alt? }` entries. */
function mapScreenshots(
  name: string,
  version: string,
  screenshots: VersionManifest["screenshots"],
) {
  return (screenshots ?? []).map((shot) =>
    typeof shot === "string"
      ? { url: cdnFileUrl(name, version, shot) }
      : { url: cdnFileUrl(name, version, shot.src), caption: shot.caption, alt: shot.alt },
  );
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
    screenshots: mapScreenshots(pkg.name, latest, manifest.screenshots),
    downloadsWeekly,
    brikaEngine,
    repository: repoUrl(manifest.repository ?? pkg.repository),
    homepage: manifest.homepage ?? pkg.homepage,
    license: manifest.license ?? pkg.license,
    capabilities: capabilityCounts(manifest),
    grants: manifest.grants ?? {},
    integrity: manifest.dist?.integrity,
    shasum: manifest.dist?.shasum,
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

/** The locale codes a localized document declares (empty for a single path). */
export function docLocales(doc: LocalizedDoc | undefined): string[] {
  if (doc === undefined || typeof doc === "string") return [];
  return Object.keys(doc);
}

/** Pick the path for a locale: requested -> `en` -> the first declared. */
export function pickDocPath(doc: LocalizedDoc | undefined, locale?: string): string | undefined {
  if (doc === undefined || typeof doc === "string") return doc;
  return (locale === undefined ? undefined : doc[locale]) ?? doc.en ?? Object.values(doc)[0];
}
