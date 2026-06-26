import type { PluginDetail, PluginVersion } from "@brika/registry-contract";
import { readTarGzEntries } from "@brika/registry-core";
import { StoreLocaleSchema } from "@brika/schema/store";
import type { z } from "zod";
import { docLocales, pickDocPath } from "@/lib/registry/manifest-mapping";
import { manifestToDetail, versionsFromPackument } from "@/lib/registry/registry-mappers";
import {
  fetchRegistryTarball,
  getRegistryDownloads,
  getRegistryPackument,
} from "@/lib/registry/registry-source";

/** Assemble the full plugin-detail page: the registry reads + tarball-bundled readme/changelog/locale. */

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

/** Build the full plugin-detail page for an `@brika/*` plugin (detail + localized readme/changelog
 * + release list); null when unknown or not a Brika plugin. Isomorphic (tarball over HTTP + Web Streams). */
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
    verified: pkg.verified,
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

  // Unpacked size/count come from the tarball we just unpacked. The full file list is not shipped
  // here; the file browser fetches it lazily, so a large package keeps the detail payload lean.
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
