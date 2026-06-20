import type { AuditEntry, AuditLog, AuditReader, AuditRecord } from "@brika/registry-core";
import { desc } from "drizzle-orm";
import type { Db } from "../client";
import { regAudit } from "../schema";

/**
 * D1 implementation of the {@link AuditLog} (write) and {@link AuditReader} (read) ports:
 * the append-only `reg_audit` table. Centralises the actor-resolution rule (CI publishes
 * attributed to the repo, local ones to the owner) and the row shape. The read side backs
 * the operator console's audit view; the write side is the best-effort recorder.
 */
export class D1AuditLog implements AuditLog, AuditReader {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

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
