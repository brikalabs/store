import { inject, token } from "@brika/di";
import { HttpStatus } from "./http-status";
import { isCanonicalName, scopeOf } from "./names";
import { MetadataReader } from "./ports";
import { OwnershipPolicy, type PublishIdentity } from "./publish";

/**
 * Post-publish package management: deprecate, yank, and operator takedown. All mutate an
 * already-published version's metadata, never its bytes (which stay immutable). Yank hides a version
 * from new installs without deleting the bytes, so existing lockfiles that pin its integrity still
 * resolve. Takedown is the operator-initiated variant, carrying a public reason.
 */

/** Write access to a published version's mutable management flags. */
export interface VersionManager {
  versionExists(name: string, version: string): Promise<boolean>;
  packageExists(name: string): Promise<boolean>;
  /** Create the package row alone (no version) - a name reservation. */
  createPackage(name: string, scope: string | null): Promise<void>;
  /** Set the deprecation message, or null to un-deprecate. */
  setDeprecated(name: string, version: string, message: string | null): Promise<void>;
  setYanked(name: string, version: string, yanked: boolean): Promise<void>;
  /** Set the operator takedown reason, or null to restore. */
  setTakedown(name: string, version: string, reason: string | null): Promise<void>;
  /** Set the package-wide "approved by Brika" verified badge. */
  setVerified(name: string, verified: boolean): Promise<void>;
  /** Permanently remove a package and all its versions + dist-tags. Irreversible. */
  deletePackage(name: string): Promise<void>;
}
/** DI token for the {@link VersionManager} port (an app binds the concrete D1 adapter). */
export const VersionManager = token<VersionManager>("VersionManager");

export type ManageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** A package-wide takedown result: the count of versions taken down, or a failure. */
export type PackageTakedownResult =
  | { readonly ok: true; readonly versions: number }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** Maximum length of a deprecation message / takedown reason. */
const MAX_MESSAGE = 1024;

/** Post-publish management operations (deprecate, yank, takedown, restore), owner-gated except takedown. */
export class ManagementService {
  readonly #meta = inject(VersionManager);
  readonly #reader = inject(MetadataReader);
  readonly #ownership = inject(OwnershipPolicy);

  /** 404 result when the version does not exist, else null. */
  async #requireVersion(name: string, version: string): Promise<ManageResult | null> {
    if (await this.#meta.versionExists(name, version)) return null;
    return {
      ok: false,
      status: HttpStatus.NOT_FOUND,
      message: `${name}@${version} does not exist`,
    };
  }

  /** Shared gate: the identity must own the scope and the version must exist. */
  async #authorize(
    identity: PublishIdentity,
    name: string,
    version: string,
  ): Promise<ManageResult> {
    const owns = await this.#ownership.canPublish(identity, name);
    if (!owns.ok) return { ok: false, status: HttpStatus.FORBIDDEN, message: owns.message };
    return (await this.#requireVersion(name, version)) ?? { ok: true };
  }

  async deprecate(
    identity: PublishIdentity,
    name: string,
    version: string,
    message: string | null,
  ): Promise<ManageResult> {
    const gate = await this.#authorize(identity, name, version);
    if (!gate.ok) return gate;
    const trimmed = message === null ? null : message.slice(0, MAX_MESSAGE);
    await this.#meta.setDeprecated(name, version, trimmed);
    return { ok: true };
  }

  async setYanked(
    identity: PublishIdentity,
    name: string,
    version: string,
    yanked: boolean,
  ): Promise<ManageResult> {
    const gate = await this.#authorize(identity, name, version);
    if (!gate.ok) return gate;
    await this.#meta.setYanked(name, version, yanked);
    return { ok: true };
  }

  /**
   * Operator takedown: remove a version from new installs with a public reason. NOT ownership-gated
   * (an admin acts against the owner) - the caller must have authorized an admin already.
   */
  async takedown(name: string, version: string, reason: string): Promise<ManageResult> {
    const missing = await this.#requireVersion(name, version);
    if (missing !== null) return missing;
    await this.#meta.setTakedown(name, version, reason.slice(0, MAX_MESSAGE));
    return { ok: true };
  }

  /**
   * Operator takedown of a whole package: take down every still-live version in one sweep, skipping
   * versions already down. Not ownership-gated (an admin acts against the owner). Returns the count
   * of versions taken down, or a 404 when the package does not exist.
   */
  async takedownPackage(name: string, reason: string): Promise<PackageTakedownResult> {
    const pkg = await this.#reader.getPackage(name);
    if (pkg === null) {
      return { ok: false, status: HttpStatus.NOT_FOUND, message: `package ${name} does not exist` };
    }
    const trimmed = reason.slice(0, MAX_MESSAGE);
    let versions = 0;
    for (const version of pkg.versions) {
      if (version.takedownReason !== null) continue; // already down
      await this.#meta.setTakedown(name, version.version, trimmed);
      versions += 1;
    }
    return { ok: true, versions };
  }

  /** Reverse a takedown, restoring the version to new installs. */
  async restore(name: string, version: string): Promise<ManageResult> {
    const missing = await this.#requireVersion(name, version);
    if (missing !== null) return missing;
    await this.#meta.setTakedown(name, version, null);
    return { ok: true };
  }

  /**
   * Operator toggle of a package's "approved by Brika" badge. NOT ownership-gated (an admin grants
   * trust); the caller must have authorized an admin already. 404 when the package does not exist.
   */
  async setVerified(name: string, verified: boolean): Promise<ManageResult> {
    if (!(await this.#meta.packageExists(name))) {
      return { ok: false, status: HttpStatus.NOT_FOUND, message: `package ${name} does not exist` };
    }
    await this.#meta.setVerified(name, verified);
    return { ok: true };
  }

  /**
   * Permanently delete an owned package: every published version and its dist-tags, so its
   * install ids stop resolving for everyone. Owner-gated and irreversible (unlike yank, which
   * keeps the bytes). The caller removes the tarball bytes separately, since this owns only the
   * metadata. No-ops cleanly for a name with no rows.
   */
  async deletePackage(identity: PublishIdentity, name: string): Promise<ManageResult> {
    const owns = await this.#ownership.canPublish(identity, name);
    if (!owns.ok) return { ok: false, status: HttpStatus.FORBIDDEN, message: owns.message };
    await this.#meta.deletePackage(name);
    return { ok: true };
  }

  /**
   * Reserve a name: create the package row with no version, so it is owned (publish-gated to the
   * scope) and visible to its owner but stays out of the public store until the first publish
   * (the catalog requires a `latest` dist-tag, which a version-less package never has). The same
   * ownership gate as publishing applies, so reserving claims nothing a publish couldn't.
   */
  async reservePackage(identity: PublishIdentity, name: string): Promise<ManageResult> {
    if (!isCanonicalName(name)) {
      return { ok: false, status: HttpStatus.BAD_REQUEST, message: `${name} is not a valid name` };
    }
    const owns = await this.#ownership.canPublish(identity, name);
    if (!owns.ok) return { ok: false, status: HttpStatus.FORBIDDEN, message: owns.message };
    if (await this.#meta.packageExists(name)) {
      return { ok: false, status: HttpStatus.CONFLICT, message: `${name} is already taken` };
    }
    await this.#meta.createPackage(name, scopeOf(name));
    return { ok: true };
  }
}
