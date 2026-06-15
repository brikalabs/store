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
  const { hits, total } = await searchNpm(query, limit, offset);
  // npm search omits engines/capabilities, so fetch each packument. Downloads
  // are skipped here (resolved on the detail page) to halve the request count.
  const details = await Promise.all(
    hits.map(async (hit) => {
      const pkg = await getPackument(hit.name);
      return pkg === null ? null : toPluginDetail(pkg, 0);
    }),
  );
  const plugins = details.flatMap((detail) =>
    detail === null ? [] : [demoSummary(toPluginSummary(detail))],
  );
  return { plugins, total };
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
} | null> {
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
  const pkg = await getPackument(name);
  if (pkg === null) return null;
  return versionsFromPackument(pkg);
}
