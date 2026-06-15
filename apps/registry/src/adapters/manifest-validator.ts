import { type ManifestValidator, readTarGzEntries } from "@brika/registry-core";
import { RegistryPublishSchema, storeLocaleOf, validateStoreLocales } from "@brika/schema/store";

/**
 * Publish-time data gate. A package is publishable only when its manifest is a
 * valid Brika plugin manifest carrying the store metadata the registry needs to
 * list it (icon, title, description) AND every bundled `locales/<lang>/store.json`
 * file matches `StoreLocaleSchema`. `@brika/schema` is the single source of truth
 * for both shapes; this adapter just surfaces the first issue as a human-readable
 * message for the publish response.
 */
export class SchemaManifestValidator implements ManifestValidator {
  async validate(
    manifest: Record<string, unknown>,
    tarball: Uint8Array,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const parsed = RegistryPublishSchema.safeParse(manifest);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return { ok: false, message: `${where}${issue?.message ?? "invalid manifest"}` };
    }

    let entries: Awaited<ReturnType<typeof readTarGzEntries>>;
    try {
      entries = await readTarGzEntries(tarball);
    } catch {
      return { ok: false, message: "tarball is not a readable gzip archive" };
    }

    const decoder = new TextDecoder();
    const localeFiles = entries
      .filter((entry) => storeLocaleOf(entry.path) !== null)
      .map((entry) => ({ path: entry.path, text: decoder.decode(entry.data) }));
    const [first] = validateStoreLocales(localeFiles, {
      screenshotCount: parsed.data.screenshots?.length,
    });
    if (first !== undefined) {
      return { ok: false, message: `${first.path}: ${first.message}` };
    }
    return { ok: true };
  }
}
