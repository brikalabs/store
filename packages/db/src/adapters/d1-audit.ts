import { inject } from "@brika/di";
import type {
  Actor,
  AuditEntry,
  AuditLog,
  AuditReader,
  AuditRecord,
  PublishIdentity,
} from "@brika/registry-core";
import { count, desc, eq, like, or } from "drizzle-orm";
import { Db } from "../client";
import { regAudit } from "../schema";
import { resolveActor } from "./queries";

type AuditRow = typeof regAudit.$inferSelect;

function toRecord(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    action: row.action,
    target: row.packageName,
    version: row.version,
    actor: row.actor,
    detail: row.detail ?? null,
    at: row.at,
  };
}

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
    return rows.map(toRecord);
  }

  /**
   * A page of the audit log, newest first, plus the total row count for the pager. Optionally
   * narrowed to a single `action` type.
   */
  async recentPage(
    limit: number,
    offset: number,
    action?: string,
  ): Promise<{ items: AuditRecord[]; total: number }> {
    const where = action ? eq(regAudit.action, action) : undefined;
    const [rows, totalRows] = await Promise.all([
      this.#db
        .select()
        .from(regAudit)
        .where(where)
        .orderBy(desc(regAudit.at), desc(regAudit.id))
        .limit(limit)
        .offset(offset),
      this.#db.select({ value: count() }).from(regAudit).where(where),
    ]);
    return { items: rows.map(toRecord), total: totalRows[0]?.value ?? 0 };
  }

  /** The distinct action types present in the log, alphabetical, for the operator type filter. */
  async distinctActions(): Promise<string[]> {
    const rows = await this.#db
      .selectDistinct({ action: regAudit.action })
      .from(regAudit)
      .orderBy(regAudit.action);
    return rows.map((row) => row.action);
  }

  /**
   * The most recent entries for the given scopes, newest first. A row targets a scope when its
   * `packageName` is the scope itself (a scope-level action) or a package under it (`@scope/...`).
   */
  async recentForScopes(scopes: readonly string[], limit: number): Promise<AuditRecord[]> {
    if (scopes.length === 0) return [];
    const match = scopes.flatMap((scope) => [
      eq(regAudit.packageName, scope),
      like(regAudit.packageName, `${scope}/%`),
    ]);
    const rows = await this.#db
      .select()
      .from(regAudit)
      .where(or(...match))
      .orderBy(desc(regAudit.at), desc(regAudit.id))
      .limit(limit);
    return rows.map(toRecord);
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
