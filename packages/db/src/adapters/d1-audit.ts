import { inject } from "@brika/di";
import type {
  Actor,
  AuditEntry,
  AuditLog,
  AuditReader,
  AuditRecord,
  PublishIdentity,
} from "@brika/registry-core";
import { desc } from "drizzle-orm";
import { Db } from "../client";
import { regAudit } from "../schema";
import { resolveActor } from "./queries";

/** D1 {@link AuditLog} (write) and {@link AuditReader} (read) over the append-only `reg_audit` table. */
export class D1AuditLog implements AuditLog, AuditReader {
  readonly #db = inject(Db);

  /** The most recent entries, newest first (by `at`, then `id` to break ties stably). */
  async recent(limit: number): Promise<AuditRecord[]> {
    const rows = await this.#db
      .select()
      .from(regAudit)
      .orderBy(desc(regAudit.at), desc(regAudit.id))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      target: row.packageName,
      version: row.version,
      actor: row.actor,
      detail: row.detail ?? null,
      at: new Date(row.at * 1000).toISOString(),
    }));
  }

  /**
   * Append an entry. Best-effort by contract: called *after* the recorded action has
   * committed, so a failed audit write is logged and swallowed rather than turning a
   * successful action into a 500 (which the client would then fail to retry against the
   * immutability guard).
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.#db.insert(regAudit).values({
        id: crypto.randomUUID(),
        action: entry.action,
        packageName: entry.packageName,
        version: entry.version,
        actor: await this.#actorFor(entry.actor),
        detail: entry.detail ?? null,
      });
    } catch (error) {
      console.error(
        `audit.record failed for ${entry.action} ${entry.packageName}@${entry.version}`,
        error,
      );
    }
  }

  /** Snapshot the principal: a human resolves account display name + avatar; a CI/OIDC publish (no account) is attributed to its `owner/repo`. */
  async #actorFor(identity: PublishIdentity): Promise<Actor> {
    if (identity.userId !== null) {
      const { displayName, avatarUrl } = await resolveActor(this.#db, identity.userId);
      return { id: identity.userId, displayName, avatarUrl };
    }
    return { id: null, displayName: identity.repository, avatarUrl: null };
  }
}
