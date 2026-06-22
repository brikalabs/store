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

/**
 * D1 implementation of the {@link AuditLog} (write) and {@link AuditReader} (read) ports:
 * the append-only `reg_audit` table. Centralises the actor-resolution rule (a human publish
 * snapshots the account's display name + avatar; a CI publish is attributed to its repo) and
 * the row shape. The read side backs the operator console's audit view; the write side is the
 * best-effort recorder.
 */
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

  /**
   * Snapshot the acting principal into a self-contained {@link Actor}. A human publish resolves
   * the account's current display name + avatar (best-effort; nulls on any miss). A CI/OIDC
   * publish has no account, so it is attributed to its `owner/repo`.
   */
  async #actorFor(identity: PublishIdentity): Promise<Actor> {
    if (identity.userId !== null) {
      const { displayName, avatarUrl } = await resolveActor(this.#db, identity.userId);
      return { id: identity.userId, displayName, avatarUrl };
    }
    return { id: null, displayName: identity.repository, avatarUrl: null };
  }
}
