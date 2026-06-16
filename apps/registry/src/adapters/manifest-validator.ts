import { type ManifestValidator, REGISTRY_LIMITS, readTarGzEntries } from "@brika/registry-core";
import { RegistryPublishSchema, storeLocaleOf, validateStoreLocales } from "@brika/schema/store";

/**
 * Publish-time data gate. A package is publishable only when its manifest is a
 * valid Brika plugin manifest carrying the store metadata the registry needs to
 * list it (icon, title, description), no bundled file or unpacked total exceeds
 * the registry's size limits, AND every bundled `locales/<lang>/store.json` file
 * matches `StoreLocaleSchema`. `@brika/schema` is the single source of truth for
 * the manifest/locale shapes; this adapter surfaces the first issue as a
 * human-readable message for the publish response.
 */
export class SchemaManifestValidator implements ManifestValidator {
  readonly #maxFileBytes: number;
  readonly #maxUnpackedBytes: number;

  constructor(limits: { maxFileBytes?: number; maxUnpackedBytes?: number } = {}) {
    this.#maxFileBytes = limits.maxFileBytes ?? REGISTRY_LIMITS.maxFileBytes;
    this.#maxUnpackedBytes = limits.maxUnpackedBytes ?? REGISTRY_LIMITS.maxUnpackedBytes;
  }

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

    // Size limits, off the already-unpacked bytes: reject an oversized file or a
    // package whose unpacked total is too large (a gzipped tarball can be small).
    let unpacked = 0;
    for (const entry of entries) {
      if (entry.data.length > this.#maxFileBytes) {
        return {
          ok: false,
          message: `${entry.path} is ${entry.data.length} bytes, over the ${this.#maxFileBytes}-byte file limit`,
        };
      }
      unpacked += entry.data.length;
    }
    if (unpacked > this.#maxUnpackedBytes) {
      return {
        ok: false,
        message: `unpacked size ${unpacked} bytes is over the ${this.#maxUnpackedBytes}-byte limit`,
      };
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
