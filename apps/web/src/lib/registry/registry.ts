import {
  DeveloperProfile,
  type PluginDetail,
  type PluginSummary,
  PluginVersion,
} from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import {
  docLocales,
  fetchCdnText,
  getPackument,
  getWeeklyDownloads,
  pickDocPath,
  searchNpm,
  toPluginDetail,
  toPluginSummary,
} from "@/lib/registry/npm";
import {
  compareVersionsDesc,
  getRegistryOrg,
  getRegistryPackument,
  getRegistryPluginPage,
  isRegistryName,
  listRegistryPlugins,
  type RegistryOrg,
  versionsFromPackument as registryVersionsFromPackument,
} from "@/lib/registry/registry-source";

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
    detail === null ? [] : [toPluginSummary(detail)],
  );

  // npm-federated plugins carry only what npm exposes (no ratings/curation): those
  // fields stay at their contract defaults (rating undefined, featured false) rather
  // than being synthesized. Registry plugins carry real install counts + integrity.
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
    detail,
    readme,
    changelog,
    readmeLocales: docLocales(manifest?.readme),
    // Newest five releases for the changelog timeline (from the same packument).
    versions: versionsFromPackument(pkg).slice(0, 5),
    // npm has no per-day series; the sparkline is registry-only.
    downloadsSeries: [],
  };
}

/**
 * Build the release list (newest first) from a packument's versions + times.
 * Ordered by semver with a publish-time tiebreak, identical to the registry-side
 * `versionsFromPackument`, so a release timeline reads the same whether the plugin
 * is resolved from npm or from our registry.
 */
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
  list.sort(
    (a, b) =>
      compareVersionsDesc(a.version, b.version) ||
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  return list;
}

/**
 * The public developer profile: the maintainer's plugins plus their profile. When
 * a `stored` profile is supplied (the D1 `developers` row, read in server
 * contexts) it is authoritative, so dashboard edits (bio, display name, website,
 * verification) show publicly. Without it (the isomorphic route loader, which can
 * run in the browser where there is no D1 binding) it falls back to the
 * npm-derived base (id as display name, unverified, no bio until the developer sets one).
 */
export async function getDeveloperPage(
  id: string,
  stored?: DeveloperProfile,
): Promise<{ profile: DeveloperProfile; plugins: PluginSummary[] }> {
  const { plugins } = await searchPlugins(`maintainer:${id}`, 50, 0);
  const base =
    stored ??
    DeveloperProfile.parse({ id, displayName: id, pluginCount: plugins.length, verified: false });
  const profile = { ...base, pluginCount: plugins.length };
  return { profile, plugins };
}

/**
 * The public organisation page (ORG-003): the org's verified display name + the plugins it
 * publishes, aggregated across every scope it owns. Returns null for an unknown org (the
 * route 404s). The catalog already excludes yanked/taken-down versions, so a plugin with no
 * live version drops out of the listing (ORG-003-AC2).
 */
export async function getOrgPage(
  slug: string,
): Promise<{ org: RegistryOrg; plugins: PluginSummary[] } | null> {
  // The org lookup and the catalog scan are independent, so overlap their round-trips; the
  // scope filter below only needs the org's scopes once both have resolved.
  const [org, catalog] = await Promise.all([
    getRegistryOrg(slug),
    listRegistryPlugins(undefined, 200, 0),
  ]);
  if (org === null) return null;
  const owned = new Set(org.scopes);
  const mine = catalog.plugins.filter((plugin) => {
    const scope = scopeOf(plugin.name);
    return scope !== null && owned.has(scope);
  });
  return { org, plugins: mine };
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
