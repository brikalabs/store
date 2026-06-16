import {
  DeveloperProfile,
  type PluginDetail,
  type PluginSummary,
  PluginVersion,
} from "@brika/registry-contract";
import { demoDetail, demoProfile, demoSummary } from "./demo";
import {
  docLocales,
  fetchCdnText,
  getPackument,
  getWeeklyDownloads,
  pickDocPath,
  searchNpm,
  toPluginDetail,
  toPluginSummary,
} from "./npm";
import {
  getRegistryPackument,
  getRegistryPluginPage,
  isRegistryName,
  listRegistryPlugins,
  versionsFromPackument as registryVersionsFromPackument,
} from "./registry-source";

/**
 * The store's read model. For now it is backed directly by npm so the pages
 * render real data without any provisioned Cloudflare resources. The D1 cache
 * and the `/v1` HTTP surface layer on top of these same functions later.
 */

const BROWSE_LIMIT = 12;

export async function searchPlugins(
  query: string | undefined,
  limit = BROWSE_LIMIT,
  offset = 0,
): Promise<{ plugins: PluginSummary[]; total: number }> {
  // `@brika/*` plugins live on our registry, not npm. Merge them to the front of
  // the first page (deduped), skipping `field:value` qualifier searches like
  // `maintainer:foo`, which the catalog's free-text filter does not understand.
  const wantsRegistry = offset === 0 && !(query?.includes(":") ?? false);
  const registry = wantsRegistry
    ? await listRegistryPlugins(query, limit, 0)
    : { plugins: [], total: 0 };

  const { hits, total } = await searchNpm(query, limit, offset);
  // npm search omits engines/capabilities, so fetch each packument. Downloads
  // are skipped here (resolved on the detail page) to halve the request count.
  const details = await Promise.all(
    hits.map(async (hit) => {
      const pkg = await getPackument(hit.name);
      return pkg === null ? null : toPluginDetail(pkg, 0);
    }),
  );
  const npmPlugins = details.flatMap((detail) =>
    detail === null ? [] : [demoSummary(toPluginSummary(detail))],
  );

  // Registry plugins carry real data (install counts, integrity), so they skip
  // the demo enrichment; npm plugins keep it as a placeholder until an npm sync +
  // D1 social tables land (see docs/store-data-sources.md).
  const seen = new Set(registry.plugins.map((plugin) => plugin.name));
  const plugins = [
    ...registry.plugins,
    ...npmPlugins.filter((plugin) => !seen.has(plugin.name)),
  ].slice(0, limit);
  return { plugins, total: total + registry.total };
}

export async function getPluginPage(
  name: string,
  locale?: string,
): Promise<{
  detail: PluginDetail;
  readme: string | null;
  changelog: string | null;
  readmeLocales: string[];
  versions: PluginVersion[];
  downloadsSeries: number[];
} | null> {
  // `@brika/*` resolves from our registry (real data: install counts, integrity,
  // localized copy, no demo enrichment); fall through to npm only if it is not
  // hosted there.
  if (isRegistryName(name)) {
    const page = await getRegistryPluginPage(name, locale);
    if (page !== null) return page;
  }

  const pkg = await getPackument(name);
  if (pkg === null) return null;
  const latest = pkg["dist-tags"]?.latest;
  if (latest === undefined) return null;

  // One mechanism: every document is a path the manifest declares (like `icon`),
  // optionally a locale -> path map. No filename guessing, no discovery.
  const manifest = pkg.versions?.[latest];
  const readmePath = pickDocPath(manifest?.readme, locale);
  const changelogPath = pickDocPath(manifest?.changelog, locale);

  const [downloads, readme, changelog] = await Promise.all([
    getWeeklyDownloads(name),
    readmePath === undefined ? Promise.resolve(null) : fetchCdnText(name, latest, readmePath),
    changelogPath === undefined ? Promise.resolve(null) : fetchCdnText(name, latest, changelogPath),
  ]);

  const detail = toPluginDetail(pkg, downloads);
  if (detail === null) return null;

  return {
    detail: demoDetail(detail),
    readme,
    changelog,
    readmeLocales: docLocales(manifest?.readme),
    // Newest five releases for the changelog timeline (from the same packument).
    versions: versionsFromPackument(pkg).slice(0, 5),
    // npm has no per-day series; the sparkline is registry-only.
    downloadsSeries: [],
  };
}

/** Build the release list (newest first) from a packument's versions + times. */
function versionsFromPackument(pkg: Awaited<ReturnType<typeof getPackument>>): PluginVersion[] {
  if (pkg === null) return [];
  const versions = pkg.versions ?? {};
  const time = pkg.time ?? {};
  const list = Object.entries(versions).map(([version, manifest]) =>
    PluginVersion.parse({
      version,
      publishedAt: time[version],
      brikaEngine: manifest.engines?.brika,
      deprecated: manifest.deprecated,
    }),
  );
  list.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return list;
}

export async function getDeveloperPage(
  id: string,
): Promise<{ profile: DeveloperProfile; plugins: PluginSummary[] }> {
  const { plugins } = await searchPlugins(`maintainer:${id}`, 50, 0);
  const profile = demoProfile(
    DeveloperProfile.parse({
      id,
      displayName: id,
      pluginCount: plugins.length,
      verified: false,
    }),
    plugins.length,
  );
  return { profile, plugins };
}

export async function getPluginVersions(name: string): Promise<PluginVersion[] | null> {
  if (isRegistryName(name)) {
    const pkg = await getRegistryPackument(name);
    if (pkg !== null) return registryVersionsFromPackument(pkg);
  }
  const pkg = await getPackument(name);
  if (pkg === null) return null;
  return versionsFromPackument(pkg);
}
