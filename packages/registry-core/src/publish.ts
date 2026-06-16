import { sha1Hex, sha512Integrity } from "./integrity";
import { REGISTRY_LIMITS } from "./limits";
import { tarballPath } from "./packument";
import type { PackageVersion, Provenance } from "./types";

/** Who is publishing, derived from a verified OIDC token or a session token. */
export interface PublishIdentity {
  /** GitHub owner (org/user) that is publishing. */
  readonly owner: string;
  /** `owner/repo` the publish ran from (OIDC), or null for a local token publish. */
  readonly repository: string | null;
  /** CI build provenance from the verified OIDC token; absent for local publishes. */
  readonly provenance?: Provenance;
}

export interface PublishInput {
  readonly name: string;
  readonly version: string;
  readonly tarball: Uint8Array;
  /** The published package.json manifest. */
  readonly manifest: Record<string, unknown>;
  readonly identity: PublishIdentity;
}

export type PublishResult =
  | {
      readonly ok: true;
      readonly integrity: string;
      readonly shasum: string;
      readonly size: number;
    }
  | { readonly ok: false; readonly code: PublishErrorCode; readonly message: string };

export type PublishErrorCode = "forbidden" | "invalid" | "exists" | "too_large";

/**
 * Manifest/data gate. Validates the published manifest AND any localized store
 * files bundled in the tarball (`locales/<lang>/store.json`). Injected so
 * `@brika/schema` remains the single source of truth and the domain core stays
 * free of schema imports.
 */
export interface ManifestValidator {
  validate(
    manifest: Record<string, unknown>,
    tarball: Uint8Array,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Ownership gate: may this identity publish this package? */
export interface OwnershipPolicy {
  canPublish(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
}

/** The package + version + tag a publish writes as one atomic unit. */
export interface CommitVersionInput {
  readonly scope: string | null;
  readonly version: PackageVersion;
  readonly tag: string;
}

/** Write side of the metadata store (publish only). */
export interface MetadataWriter {
  versionExists(name: string, version: string): Promise<boolean>;
  /**
   * Atomically create the package (if new), insert the version, and move the tag.
   * All-or-nothing: a partial failure must leave the metadata untouched, so a
   * version row never exists without its `latest` tag (or vice versa).
   */
  commitVersion(input: CommitVersionInput): Promise<void>;
}

/** Write side of tarball storage. */
export interface TarballWriter {
  put(key: string, data: Uint8Array): Promise<void>;
  /** Remove an object, e.g. to compensate a publish whose metadata write failed. */
  delete(key: string): Promise<void>;
}

export interface PublishOptions {
  /** Returns the publish timestamp; injected for deterministic tests. */
  readonly clock?: () => string;
  /** Max accepted tarball size in bytes (defaults to `REGISTRY_LIMITS.maxTarballBytes`). */
  readonly maxTarballBytes?: number;
}

function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

/**
 * Orchestrates a publish through the two gates and the immutability + integrity
 * invariants. Ownership is verified BEFORE validation, and immutability BEFORE
 * any write, so a rejected publish never touches storage.
 */
export class PublishService {
  readonly #meta: MetadataWriter;
  readonly #tarballs: TarballWriter;
  readonly #validator: ManifestValidator;
  readonly #ownership: OwnershipPolicy;
  readonly #clock: () => string;
  readonly #maxTarballBytes: number;

  constructor(
    meta: MetadataWriter,
    tarballs: TarballWriter,
    validator: ManifestValidator,
    ownership: OwnershipPolicy,
    options: PublishOptions = {},
  ) {
    this.#meta = meta;
    this.#tarballs = tarballs;
    this.#validator = validator;
    this.#ownership = ownership;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#maxTarballBytes = options.maxTarballBytes ?? REGISTRY_LIMITS.maxTarballBytes;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    // 1. Ownership (identity gate) before anything else.
    const owns = await this.#ownership.canPublish(input.identity, input.name);
    if (!owns.ok) return { ok: false, code: "forbidden", message: owns.message };

    // 2. Size limit: reject an oversized payload before inspecting or storing it.
    if (input.tarball.byteLength > this.#maxTarballBytes) {
      return {
        ok: false,
        code: "too_large",
        message: `Tarball is ${input.tarball.byteLength} bytes, over the ${this.#maxTarballBytes}-byte limit`,
      };
    }

    // 3. Manifest/data gate (required metadata, bundled locale files, etc.).
    const valid = await this.#validator.validate(input.manifest, input.tarball);
    if (!valid.ok) return { ok: false, code: "invalid", message: valid.message };

    // 4. Immutability: never overwrite an existing version.
    if (await this.#meta.versionExists(input.name, input.version)) {
      return {
        ok: false,
        code: "exists",
        message: `${input.name}@${input.version} already exists`,
      };
    }

    // 5. Integrity computed from the actual bytes we are about to store.
    const integrity = await sha512Integrity(input.tarball);
    const shasum = await sha1Hex(input.tarball);
    const size = input.tarball.byteLength;

    // 6. Write the tarball first (a `delete`-able object the caller can compensate
    //    if the next step fails), then commit the metadata atomically. Running this
    //    inside a transaction at the edge means a failed `commitVersion` rolls the
    //    tarball back, so a publish is all-or-nothing across both stores.
    await this.#tarballs.put(tarballPath(input.name, input.version), input.tarball);
    await this.#meta.commitVersion({
      scope: scopeOf(input.name),
      tag: "latest",
      version: {
        name: input.name,
        version: input.version,
        manifest: input.manifest,
        integrity,
        shasum,
        size,
        publishedAt: this.#clock(),
        deprecated: null,
        yanked: false,
        provenance: input.identity.provenance ?? null,
      },
    });

    return { ok: true, integrity, shasum, size };
  }
}
