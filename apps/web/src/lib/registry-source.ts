import {
  type PluginDetail,
  PluginDetail as PluginDetailSchema,
  type PluginSummary,
  PluginSummary as PluginSummarySchema,
  type PluginVersion,
  PluginVersion as PluginVersionSchema,
} from "@brika/registry-contract";
import { readTarGzEntries, tarballPath } from "@brika/registry-core";
import { npmLink } from "@brika/router/npm";
import { StoreLocaleSchema } from "@brika/schema/store";
import { z } from "zod";
import {
  capabilityCounts,
  docLocales,
  manifestFields,
  mapScreenshots,
  personName,
  pickDocPath,
  repoUrl,
} from "./manifest-mapping";

// Localized-doc helpers are shared mapping; re-exported so the registry facade
// (and its tests) keep a single import path.
export { docLocales, pickDocPath } from "./manifest-mapping";

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

// The asset types we actually serve from tarballs: icons, screenshots, readme
// images, and store.json. Images need an exact type so browsers render them.
// This is a small, stable set (manifest asset kinds); arbitrary published files
// derive their type from their bytes instead, so there is no per-language list.
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

const Manifest = z
  .object({
    name: z.string(),
    ...manifestFields,
    unpackedSize: z.number().optional(),
    fileCount: z.number().optional(),
    // Present on packument version entries (the registry computes it), absent on
    // the raw package.json the catalog stores.
    dist: z
      .object({
        tarball: z.string().optional(),
        integrity: z.string().optional(),
        shasum: z.string().optional(),
        size: z.number().optional(),
      })
      .optional(),
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

/** The registry's verified publisher (scope owner + display name), if present. */
const Publisher = z.object({ id: z.string(), name: z.string(), verified: z.boolean() });

const CatalogEntry = z.object({
  name: z.string(),
  version: z.string(),
  manifest: Manifest,
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  publisher: Publisher.optional(),
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
  publisher: Publisher.optional(),
});
export type Packument = z.infer<typeof Packument>;

// ---------------------------------------------------------------------------
// Pure mapping (manifest -> contract). Unit-tested without any network.
// ---------------------------------------------------------------------------

/**
 * URL the store serves a tarball-bundled file from (extracted on demand). Path-
 * based and version-pinned, npm style: `/v1/plugins/<name>/v/<version>/files/<path>`.
 * The file *list* for a version lives at `/v1/plugins/<name>/v/<version>/index`.
 */
export function assetUrl(name: string, version: string, path: string): string {
  const clean = path.replace(/^\.?\//, "");
  const encodedPath = clean.split("/").map(encodeURIComponent).join("/");
  return `${pluginVersionUrl(name, version)}/files/${encodedPath}`;
}

/** The npm-style `/v1/plugins/<name>/v/<version>` base for a published version. */
export function pluginVersionUrl(name: string, version: string): string {
  return `/v1/plugins/${encodeURIComponent(name)}/v/${encodeURIComponent(version)}`;
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
  /**
   * The registry's verified publisher (scope owner + display name). When present it
   * is the trusted "published by", overriding the free-text manifest `author`.
   */
  readonly publisher?: { readonly id: string; readonly name: string; readonly verified: boolean };
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
    // Prefer the registry's verified publisher (the scope owner's chosen name) over
    // the free-text manifest `author`; fall back to the manifest when unscoped.
    author:
      options.publisher ??
      (authorName === undefined
        ? undefined
        : { id: authorName, name: authorName, verified: false }),
    keywords: manifest.keywords ?? [],
    iconUrl: manifest.icon ? assetUrl(name, version, manifest.icon) : undefined,
    screenshots: mapScreenshots(manifest.screenshots, (path) => assetUrl(name, version, path)),
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
    devDependencies: manifest.devDependencies,
    devDependencyCount: manifest.devDependencies
      ? Object.keys(manifest.devDependencies).length
      : undefined,
    size: manifest.dist?.size,
    unpackedSize: manifest.unpackedSize,
    fileCount: manifest.fileCount,
    tarballUrl: manifest.dist?.tarball,
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

function parseSemver(version: string): { nums: number[]; pre: string } {
  const dash = version.indexOf("-");
  const core = dash === -1 ? version : version.slice(0, dash);
  const pre = dash === -1 ? "" : version.slice(dash + 1);
  return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
}

/**
 * Newest-first semver comparator: 2.0.0 > 1.9.0 > 1.0.0 > 1.0.0-rc.1. Used to
 * order the release timeline by version rather than publish time, since versions
 * published in the same second tie on the timestamp.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pb.nums[i] ?? 0) - (pa.nums[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // A release outranks any prerelease of the same core version.
  if (pa.pre === "" && pb.pre !== "") return -1;
  if (pa.pre !== "" && pb.pre === "") return 1;
  return pb.pre.localeCompare(pa.pre);
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
  list.sort(
    (a, b) =>
      compareVersionsDesc(a.version, b.version) ||
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  return list;
}

// ---------------------------------------------------------------------------
// Network (registry HTTP surface).
// ---------------------------------------------------------------------------

export async function getRegistryPackument(name: string): Promise<Packument | null> {
  const res = await fetch(`${REGISTRY_ORIGIN}${npmLink("/:name", { name })}`, {
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
    const res = await fetch(`${REGISTRY_ORIGIN}${npmLink("/-/v1/downloads/:name", { name })}`, {
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
    publisher: pkg.publisher,
  });
  if (detail === null) return null;

  const tarball = await fetchRegistryTarball(name, latest);
  const entries = tarball === null ? [] : await readTarGzEntries(tarball);

  const readmePath = pickDocPath(manifest.readme, locale);
  const changelogPath = pickDocPath(manifest.changelog, locale);
  const readme = readmePath === undefined ? null : entryText(entries, readmePath);
  const changelog = changelogPath === undefined ? null : entryText(entries, changelogPath);
  const localized = applyStoreLocale(detail, resolveStoreLocale(entries, locale));

  // The unpacked size/count come from the tarball we just unpacked (for the
  // Digest row and the sidebar). The full file *list* is not shipped here - the
  // file browser fetches it lazily from `/v1/plugins/:name/files/:version` when
  // the Supply chain tab opens, so a large package keeps the detail payload lean.
  const withMeta: PluginDetail =
    entries.length > 0
      ? {
          ...localized,
          fileCount: entries.length,
          unpackedSize: entries.reduce((sum, entry) => sum + entry.data.length, 0),
        }
      : localized;

  return {
    detail: withMeta,
    readme,
    changelog,
    readmeLocales: docLocales(manifest.readme),
    versions: versionsFromPackument(pkg).slice(0, 5),
    downloadsSeries: downloads.series,
  };
}

const OrgLinkWire = z.object({ label: z.string(), url: z.string() });
const OrgInfo = z.object({
  ok: z.literal(true),
  slug: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable().default(null),
  links: z.array(OrgLinkWire).default([]),
  iconKey: z.string().nullable().default(null),
  scopes: z.array(z.string()),
  verifiedDomains: z.array(z.string()).default([]),
});

/** An organisation's public info: slug, display name, profile, owned scopes, verified domains. */
export interface RegistryOrg {
  readonly slug: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: { label: string; url: string }[];
  readonly hasIcon: boolean;
  readonly scopes: string[];
  readonly verifiedDomains: string[];
}

/** Fetch a public org's info from the registry, or null when it does not exist. */
export async function getRegistryOrg(slug: string): Promise<RegistryOrg | null> {
  const res = await fetch(`${REGISTRY_ORIGIN}${npmLink("/-/org/:org", { org: slug })}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const parsed = OrgInfo.safeParse(await res.json());
  if (!parsed.success) return null;
  return {
    slug: parsed.data.slug,
    displayName: parsed.data.displayName,
    description: parsed.data.description,
    links: parsed.data.links,
    hasIcon: parsed.data.iconKey !== null,
    scopes: parsed.data.scopes,
    verifiedDomains: parsed.data.verifiedDomains,
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
      publisher: entry.publisher,
    });
    return summary === null ? [] : [summary];
  });
  return { plugins, total: parsed.data.total };
}
