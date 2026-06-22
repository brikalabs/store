import { inject, token } from "@brika/di";
import { HttpStatus } from "./http-status";
import { OwnershipPolicy, type PublishIdentity } from "./publish";

/**
 * Post-publish package management: deprecate, yank, and operator takedown. All
 * mutate an already-published version's metadata (never its bytes, which stay
 * immutable).
 *
 * - **deprecate**: attach (or clear) a message. The version still installs; bun
 *   surfaces the warning. Owner-gated. Reversible.
 * - **yank**: hide a version from new installs (the packument omits it) without
 *   deleting the bytes, so existing lockfiles that pin its integrity still
 *   resolve. Owner-gated. Reversible.
 * - **takedown**: like yank, but operator-initiated (against the owner, so NOT
 *   ownership-gated; the caller authorizes an admin at the HTTP edge) and carrying
 *   a public reason that is surfaced in the packument. Reversible via `restore`.
 */

/** Write access to a published version's mutable management flags. */
export interface VersionManager {
  versionExists(name: string, version: string): Promise<boolean>;
  /** Set the deprecation message, or null to un-deprecate. */
  setDeprecated(name: string, version: string, message: string | null): Promise<void>;
  setYanked(name: string, version: string, yanked: boolean): Promise<void>;
  /** Set the operator takedown reason, or null to restore. */
  setTakedown(name: string, version: string, reason: string | null): Promise<void>;
}
/** DI token for the {@link VersionManager} port (an app binds the concrete D1 adapter). */
export const VersionManager = token<VersionManager>("VersionManager");

export type ManageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** Maximum length of a deprecation message / takedown reason. */
const MAX_MESSAGE = 1024;

/**
 * Injectable (`@brika/di`): field injection, no constructor. The container auto-creates it and the
 * fields resolve their ports from the active injector. Wiring never writes `new` - it
 * `inject(ManagementService)`. A test runs it in an injection context that provides the ports.
 */
export class ManagementService {
  readonly #meta = inject(VersionManager);
  readonly #ownership = inject(OwnershipPolicy);

  /** Shared gate: the identity must own the scope and the version must exist. */
  async #authorize(
    identity: PublishIdentity,
    name: string,
    version: string,
  ): Promise<ManageResult> {
    const owns = await this.#ownership.canPublish(identity, name);
    if (!owns.ok) return { ok: false, status: HttpStatus.FORBIDDEN, message: owns.message };
    if (!(await this.#meta.versionExists(name, version))) {
      return {
        ok: false,
        status: HttpStatus.NOT_FOUND,
        message: `${name}@${version} does not exist`,
      };
    }
    return { ok: true };
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
   * Operator takedown: remove a version from new installs with a public reason.
   * NOT ownership-gated (an admin acts against the owner); the caller must have
   * authorized an admin already. Only checks the version exists.
   */
  async takedown(name: string, version: string, reason: string): Promise<ManageResult> {
    if (!(await this.#meta.versionExists(name, version))) {
      return {
        ok: false,
        status: HttpStatus.NOT_FOUND,
        message: `${name}@${version} does not exist`,
      };
    }
    await this.#meta.setTakedown(name, version, reason.slice(0, MAX_MESSAGE));
    return { ok: true };
  }

  /** Reverse a takedown, restoring the version to new installs. */
  async restore(name: string, version: string): Promise<ManageResult> {
    if (!(await this.#meta.versionExists(name, version))) {
      return {
        ok: false,
        status: HttpStatus.NOT_FOUND,
        message: `${name}@${version} does not exist`,
      };
    }
    await this.#meta.setTakedown(name, version, null);
    return { ok: true };
  }
}
