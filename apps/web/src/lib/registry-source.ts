import {
  type PluginDetail,
  PluginDetail as PluginDetailSchema,
  type PluginSummary,
  PluginSummary as PluginSummarySchema,
  type PluginVersion,
  PluginVersion as PluginVersionSchema,
} from "@brika/registry-contract";
import { readTarGzEntries, tarballPath } from "@brika/registry-core";
import { StoreLocaleSchema } from "@brika/schema/store";
import { z } from "zod";

/**
 * The `@brika/*` plugins are hosted on our own registry (registry.brika.dev),
 * not npm. This module reads them through the registry's npm-compatible HTTP
 * surface (packument + tarball) plus a small `/-/v1/packages` catalog endpoint,
 * and maps each manifest into the same `/v1` contract shapes the npm path
 * produces. Assets bundled in the tarball (icon, screenshots, readme, localized
 * `store.json`) are served back through the store's own `/v1/plugins/:name/asset`
 * endpoint, which extracts them from the tarball.
 *
 * It is import-safe on the client: the registry origin is a build-time constant
 * (Vite inlines `import.meta.env.VITE_REGISTRY_URL`), so the same code runs in
 * the SSR worker and during client navigation, exactly like the npm path.
 */

/** Scope hosted on our registry; everything else federates from npm. */
export const REGISTRY_SCOPE = "@brika/";

/** Public origin of the registry. Overridable for local dev via Vite env. */
export const REGISTRY_ORIGIN: string = (
  (import.meta.env?.VITE_REGISTRY_URL as string | undefined) ?? "https://registry.brika.dev"
).replace(/\/+$/, "");

/** True for names hosted on our registry (the `@brika` scope). */
export function isRegistryName(name: string): boolean {
  return name.startsWith(REGISTRY_SCOPE);
}

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

/** Content-type for a bundled asset path, defaulting to octet-stream. */
export function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Reject empty/absolute paths and parent traversal before touching storage. */
export function isSafeAssetPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/")) return false;
  return !path.split(/[/\\]/).includes("..");
}

// ---------------------------------------------------------------------------
// Wire formats (npm-compatible packument subset + the catalog endpoint).
// ---------------------------------------------------------------------------

const LocalizedDoc = z.union([z.string(), z.record(z.string(), z.string())]);
export type LocalizedDoc = z.infer<typeof LocalizedDoc>;

const Person = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  }),
]);

const Repository = z.union([z.string(), z.object({ url: z.string().optional() })]);

const Screenshot = z.union([
  z.string(),
  z.object({ src: z.string(), caption: z.string().optional(), alt: z.string().optional() }),
]);

const Manifest = z
  .object({
    name: z.string(),
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
    // Present on packument version entries (the registry computes it), absent on
    // the raw package.json the catalog stores.
    dist: z.object({ integrity: z.string().optional(), shasum: z.string().optional() }).optional(),
    provenance: z
      .object({
        repository: z.string(),
        sha: z.string().optional(),
        ref: z.string().optional(),
        workflowRef: z.string().optional(),
        runId: z.string().optional(),
        transparencyLog: z
          .object({
            provider: z.string(),
            logUrl: z.string(),
            logIndex: z.string().optional(),
            integrity: z.string(),
          })
          .optional(),
      })
      .optional(),
  })
  .loose();
export type Manifest = z.infer<typeof Manifest>;

const DownloadStats = z.object({ total: z.number(), weekly: z.number() });

const CatalogEntry = z.object({
  name: z.string(),
  version: z.string(),
  manifest: Manifest,
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  downloads: DownloadStats.optional(),
});

const CatalogResponse = z.object({ packages: z.array(CatalogEntry), total: z.number() });

const DownloadsResponse = z.object({
  name: z.string(),
  total: z.number(),
  weekly: z.number(),
  series: z.array(z.number()).optional(),
});

const Packument = z.object({
  name: z.string(),
  "dist-tags": z.object({ latest: z.string().optional() }).optional(),
  versions: z.record(z.string(), Manifest).optional(),
  time: z.record(z.string(), z.string()).optional(),
});
export type Packument = z.infer<typeof Packument>;

// ---------------------------------------------------------------------------
// Pure mapping (manifest -> contract). Unit-tested without any network.
// ---------------------------------------------------------------------------

function personName(person: z.infer<typeof Person> | undefined): string | undefined {
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

function repoUrl(repo: z.infer<typeof Repository> | undefined): string | undefined {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (raw === undefined || raw.length === 0) return undefined;
  if (raw.startsWith("github:")) return `https://github.com/${raw.slice("github:".length)}`;
  const cleaned = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  if (cleaned.startsWith("git://")) return `https://${cleaned.slice("git://".length)}`;
  if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) return cleaned;
  return undefined;
}

function capabilityCounts(manifest: Manifest) {
  return {
    tools: manifest.tools?.length ?? 0,
    blocks: manifest.blocks?.length ?? 0,
    bricks: manifest.bricks?.length ?? 0,
    sparks: manifest.sparks?.length ?? 0,
    pages: manifest.pages?.length ?? 0,
  };
}

/** URL the store serves a tarball-bundled asset from (extracted on demand). */
export function assetUrl(name: string, version: string, path: string): string {
  const clean = path.replace(/^\.?\//, "");
  const query = new URLSearchParams({ v: version, path: clean });
  return `/v1/plugins/${encodeURIComponent(name)}/asset?${query.toString()}`;
}

function mapScreenshots(name: string, version: string, screenshots: Manifest["screenshots"]) {
  return (screenshots ?? []).map((shot) =>
    typeof shot === "string"
      ? { url: assetUrl(name, version, shot) }
      : { url: assetUrl(name, version, shot.src), caption: shot.caption, alt: shot.alt },
  );
}

export interface MapOptions {
  readonly publishedAt?: string;
  readonly updatedAt?: string;
  /** All-time installs from the registry's download stats. */
  readonly installs?: number;
  /** Trailing-week installs. */
  readonly downloadsWeekly?: number;
  /** SRI of the latest tarball (`sha512-...`). */
  readonly integrity?: string;
  readonly shasum?: string;
}

/**
 * Map a registry manifest to a `PluginDetail`. Returns null when it is not a
 * Brika plugin (no `engines.brika`), mirroring the npm path so non-plugins are
 * skipped rather than rendered half-formed.
 */
export function manifestToDetail(
  manifest: Manifest,
  options: MapOptions = {},
): PluginDetail | null {
  const brikaEngine = manifest.engines?.brika;
  if (brikaEngine === undefined) return null;
  const { name, version } = manifest;
  const authorName = personName(manifest.author);
  const candidate = {
    name,
    displayName: manifest.displayName,
    description: manifest.description,
    version,
    author:
      authorName === undefined ? undefined : { id: authorName, name: authorName, verified: false },
    keywords: manifest.keywords ?? [],
    iconUrl: manifest.icon ? assetUrl(name, version, manifest.icon) : undefined,
    screenshots: mapScreenshots(name, version, manifest.screenshots),
    downloadsWeekly: options.downloadsWeekly ?? 0,
    installs: options.installs,
    brikaEngine,
    repository: repoUrl(manifest.repository),
    homepage: manifest.homepage,
    license: manifest.license,
    capabilities: capabilityCounts(manifest),
    grants: manifest.grants ?? {},
    integrity: options.integrity ?? manifest.dist?.integrity,
    shasum: options.shasum ?? manifest.dist?.shasum,
    provenance: manifest.provenance,
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    devDependencyCount: manifest.devDependencies
      ? Object.keys(manifest.devDependencies).length
      : undefined,
    publishedAt: options.publishedAt,
    updatedAt: options.updatedAt,
  };
  const parsed = PluginDetailSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function manifestToSummary(
  manifest: Manifest,
  options: MapOptions = {},
): PluginSummary | null {
  const detail = manifestToDetail(manifest, options);
  return detail === null ? null : PluginSummarySchema.parse(detail);
}

/** Pick the path for a localized document: requested -> `en` -> first declared. */
export function pickDocPath(doc: LocalizedDoc | undefined, locale?: string): string | undefined {
  if (doc === undefined || typeof doc === "string") return doc;
  return (locale === undefined ? undefined : doc[locale]) ?? doc.en ?? Object.values(doc)[0];
}

/** The locale codes a localized document declares (empty for a single path). */
export function docLocales(doc: LocalizedDoc | undefined): string[] {
  if (doc === undefined || typeof doc === "string") return [];
  return Object.keys(doc);
}

/** Build the release list (newest first) from a registry packument. */
export function versionsFromPackument(pkg: Packument): PluginVersion[] {
  const versions = pkg.versions ?? {};
  const time = pkg.time ?? {};
  const list = Object.entries(versions).map(([version, manifest]) =>
    PluginVersionSchema.parse({
      version,
      publishedAt: time[version],
      brikaEngine: manifest.engines?.brika,
      deprecated: manifest.deprecated,
    }),
  );
  list.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return list;
}

// ---------------------------------------------------------------------------
// Network (registry HTTP surface).
// ---------------------------------------------------------------------------

function encodeName(name: string): string {
  return name.replace("/", "%2F");
}

export async function getRegistryPackument(name: string): Promise<Packument | null> {
  const res = await fetch(`${REGISTRY_ORIGIN}/${encodeName(name)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const parsed = Packument.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
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
  try {
    const res = await fetch(`${REGISTRY_ORIGIN}/-/v1/downloads/${encodeName(name)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return NO_DOWNLOADS;
    const parsed = DownloadsResponse.safeParse(await res.json());
    if (!parsed.success) return NO_DOWNLOADS;
    return {
      total: parsed.data.total,
      weekly: parsed.data.weekly,
      series: parsed.data.series ?? [],
    };
  } catch {
    return NO_DOWNLOADS;
  }
}

export async function fetchRegistryTarball(
  name: string,
  version: string,
): Promise<Uint8Array | null> {
  const res = await fetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** A bundled file's text, located in a set of tar entries by its package path. */
function entryText(
  entries: Awaited<ReturnType<typeof readTarGzEntries>>,
  path: string,
): string | null {
  const clean = path.replace(/^\.?\//, "");
  const entry = entries.find((candidate) => candidate.path === clean);
  return entry === undefined ? null : new TextDecoder().decode(entry.data);
}

/** The localized `store.json` for a locale: requested -> `en` -> first declared. */
function resolveStoreLocale(
  entries: Awaited<ReturnType<typeof readTarGzEntries>>,
  locale: string | undefined,
): z.infer<typeof StoreLocaleSchema> | null {
  const order = [locale, "en"].filter((tag): tag is string => tag !== undefined);
  const candidates = entries.filter((entry) => /^locales\/[^/]+\/store\.json$/.test(entry.path));
  const byLocale = (tag: string) =>
    candidates.find((entry) => entry.path === `locales/${tag}/store.json`);
  const chosen = order.map(byLocale).find((entry) => entry !== undefined) ?? candidates[0];
  if (chosen === undefined) return null;
  const parsed = StoreLocaleSchema.safeParse(JSON.parse(new TextDecoder().decode(chosen.data)));
  return parsed.success ? parsed.data : null;
}

/** Overlay localized store copy (title/description/captions) onto a detail. */
function applyStoreLocale(
  detail: PluginDetail,
  locale: z.infer<typeof StoreLocaleSchema> | null,
): PluginDetail {
  if (locale === null) return detail;
  const screenshots = detail.screenshots.map((shot, index) => {
    const caption = locale.screenshotCaptions?.[index];
    return caption === undefined ? shot : { ...shot, caption };
  });
  return { ...detail, displayName: locale.title, description: locale.description, screenshots };
}

export interface RegistryPluginPage {
  readonly detail: PluginDetail;
  readonly readme: string | null;
  readonly changelog: string | null;
  readonly readmeLocales: string[];
  readonly versions: PluginVersion[];
  /** Trailing 30-day install counts for the sidebar sparkline (empty for none). */
  readonly downloadsSeries: number[];
}

/**
 * Build the full plugin-detail page for an `@brika/*` plugin from the registry:
 * the mapped detail (with localized title/description from the bundled
 * `store.json`), the localized readme/changelog, the declared readme locales,
 * and the release list. Returns null when the plugin is unknown or not a Brika
 * plugin. Fully isomorphic: the tarball is fetched over HTTP and unpacked with
 * Web Streams, so it runs in the SSR worker and during client navigation alike.
 */
export async function getRegistryPluginPage(
  name: string,
  locale?: string,
): Promise<RegistryPluginPage | null> {
  const pkg = await getRegistryPackument(name);
  const latest = pkg?.["dist-tags"]?.latest;
  if (pkg === null || latest === undefined) return null;
  const manifest = pkg.versions?.[latest];
  if (manifest === undefined) return null;

  const downloads = await getRegistryDownloads(name);
  const detail = manifestToDetail(manifest, {
    publishedAt: pkg.time?.created,
    updatedAt: pkg.time?.[latest],
    installs: downloads.total,
    downloadsWeekly: downloads.weekly,
  });
  if (detail === null) return null;

  const tarball = await fetchRegistryTarball(name, latest);
  const entries = tarball === null ? [] : await readTarGzEntries(tarball);

  const readmePath = pickDocPath(manifest.readme, locale);
  const changelogPath = pickDocPath(manifest.changelog, locale);
  const readme = readmePath === undefined ? null : entryText(entries, readmePath);
  const changelog = changelogPath === undefined ? null : entryText(entries, changelogPath);
  const localized = applyStoreLocale(detail, resolveStoreLocale(entries, locale));

  return {
    detail: localized,
    readme,
    changelog,
    readmeLocales: docLocales(manifest.readme),
    versions: versionsFromPackument(pkg).slice(0, 5),
    downloadsSeries: downloads.series,
  };
}

/** Enumerate published `@brika/*` plugins via the registry catalog endpoint. */
export async function listRegistryPlugins(
  query: string | undefined,
  limit: number,
  offset: number,
): Promise<{ plugins: PluginSummary[]; total: number }> {
  const url = new URL(`${REGISTRY_ORIGIN}/-/v1/packages`);
  if (query && query.trim().length > 0) url.searchParams.set("text", query.trim());
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return { plugins: [], total: 0 };
  const parsed = CatalogResponse.safeParse(await res.json());
  if (!parsed.success) return { plugins: [], total: 0 };
  const plugins = parsed.data.packages.flatMap((entry) => {
    const summary = manifestToSummary(entry.manifest, {
      publishedAt: entry.createdAt,
      updatedAt: entry.publishedAt,
      installs: entry.downloads?.total,
      downloadsWeekly: entry.downloads?.weekly,
    });
    return summary === null ? [] : [summary];
  });
  return { plugins, total: parsed.data.total };
}
