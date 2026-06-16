import type { PublishIdentity } from "@brika/registry-core";
import { type Db, regAudit } from "@brika/store-db";

/** One entry for the append-only audit log (publishes + management actions). */
export interface AuditEntry {
  readonly action: string;
  readonly packageName: string;
  readonly version: string;
  readonly actor: PublishIdentity;
  readonly detail?: Record<string, unknown> | null;
}

/**
 * Append-only audit log in `reg_audit`. Centralises the actor-resolution rule
 * (CI publishes attributed to the repo, local ones to the owner) and the row
 * shape, which were previously duplicated across the publish and manage handlers.
 */
export class D1AuditLog {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /**
   * Append an entry. Best-effort by contract: it is called *after* the action it
   * records has already committed (a published tarball, a flipped flag), so a
   * failed audit write must never throw back and turn a successful action into a
   * 500 (which the client would read as failure, then fail to retry against the
   * immutability guard). A write failure is logged and swallowed.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.#db.insert(regAudit).values({
        id: crypto.randomUUID(),
        action: entry.action,
        packageName: entry.packageName,
        version: entry.version,
        actor: entry.actor.repository ?? entry.actor.owner,
        detail: entry.detail ?? null,
      });
    } catch (error) {
      console.error(
        `audit.record failed for ${entry.action} ${entry.packageName}@${entry.version}`,
        error,
      );
    }
  }
}
