import type { OwnershipPolicy, PublishIdentity } from "./publish";

/**
 * Post-publish package management: deprecate and yank. Both are mutations of an
 * already-published version's metadata (never its bytes, which stay immutable),
 * gated by the same scope ownership as publishing.
 *
 * - **deprecate**: attach (or clear) a message. The version still installs; bun
 *   surfaces the warning. Reversible.
 * - **yank**: hide a version from new installs (the packument omits it) without
 *   deleting the bytes, so existing lockfiles that pin its integrity still
 *   resolve. Reversible.
 */

/** Write access to a published version's mutable management flags. */
export interface VersionManager {
  versionExists(name: string, version: string): Promise<boolean>;
  /** Set the deprecation message, or null to un-deprecate. */
  setDeprecated(name: string, version: string, message: string | null): Promise<void>;
  setYanked(name: string, version: string, yanked: boolean): Promise<void>;
}

export type ManageErrorCode = "forbidden" | "not_found";

export type ManageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ManageErrorCode; readonly message: string };

/** Maximum length of a deprecation message, matching npm's practical limit. */
const MAX_DEPRECATION_MESSAGE = 1024;

export class ManagementService {
  readonly #meta: VersionManager;
  readonly #ownership: OwnershipPolicy;

  constructor(meta: VersionManager, ownership: OwnershipPolicy) {
    this.#meta = meta;
    this.#ownership = ownership;
  }

  /** Shared gate: the identity must own the scope and the version must exist. */
  async #authorize(
    identity: PublishIdentity,
    name: string,
    version: string,
  ): Promise<ManageResult> {
    const owns = await this.#ownership.canPublish(identity, name);
    if (!owns.ok) return { ok: false, code: "forbidden", message: owns.message };
    if (!(await this.#meta.versionExists(name, version))) {
      return { ok: false, code: "not_found", message: `${name}@${version} does not exist` };
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
    const trimmed = message === null ? null : message.slice(0, MAX_DEPRECATION_MESSAGE);
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
}
