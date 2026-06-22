import { type ManifestValidator, REGISTRY_LIMITS, readTarGzEntries } from "@brika/registry-core";
import { RegistryPublishSchema, storeLocaleOf, validateStoreLocales } from "@brika/schema/store";

type TarEntry = Awaited<ReturnType<typeof readTarGzEntries>>[number];

/**
 * If the tarball ships its own package.json, its name/version must match the published
 * manifest: a divergent embedded one would let a consumer who reads the unpacked file see
 * a different identity than the registry's record. Absent is allowed.
 */
function checkEmbeddedManifest(
  entries: readonly TarEntry[],
  manifest: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const embedded = entries.find((entry) => entry.path === "package.json");
  if (embedded === undefined) return { ok: true };

  let pkg: unknown;
  try {
    pkg = JSON.parse(new TextDecoder().decode(embedded.data));
  } catch {
    return { ok: false, message: "tarball package.json is not valid JSON" };
  }
  const record = typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
  if (record.name !== manifest.name || record.version !== manifest.version) {
    return {
      ok: false,
      message: "tarball package.json name/version does not match the published manifest",
    };
  }
  return { ok: true };
}

/**
 * Publish-time data gate: a valid Brika plugin manifest with store metadata, within the
 * size limits, with every bundled `locales/<lang>/store.json` matching `StoreLocaleSchema`.
 * `@brika/schema` is the single source of truth for the shapes.
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

    // Limits checked off unpacked bytes: a gzipped tarball can be small while its contents are not.
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

    const embedded = checkEmbeddedManifest(entries, manifest);
    if (!embedded.ok) return embedded;

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
