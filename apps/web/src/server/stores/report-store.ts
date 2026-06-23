import { inject } from "@brika/di";
import { and, desc, eq, inArray, isNotNull, like, or, type SQL, sql } from "drizzle-orm";
import { Database } from "@/server/db/client";
import { plugins, reports, users } from "@/server/db/schema";
import { BlobStore } from "@/server/ports/blob-store";
import { authorColumns, toAuthor } from "@/server/stores/author";

/** A status an operator can move a report into (from the default `open`). */
export type ReportResolution = "resolved" | "dismissed";

/** The queue view an operator is browsing: a single status, or every report. */
export type ReportStatusFilter = "open" | "resolved" | "dismissed" | "all";

/** Per-status open counts for the queue's filter chips. */
export interface ReportStatusCounts {
  open: number;
  resolved: number;
  dismissed: number;
}

/** A row of the operator moderation queue: the report plus its plugin and reporter. */
export interface OperatorReport {
  id: string;
  pluginName: string;
  pluginDisplayName: string | null;
  reason: string;
  details: string | null;
  reporter: { id: string; displayName: string; avatarUrl?: string };
  status: string;
  createdAt: string;
}

/**
 * Repository for `reports`. Writes carry the category key + optional details; reads join the
 * reporter (`users`) and, when cached, the plugin (`plugins`) for display. Operator-only - reports
 * are never exposed on the public `/v1` surface.
 */
export class ReportStore {
  readonly #db = inject(Database);
  readonly #blob = inject(BlobStore);

  /** File a new report (always `open`). */
  async create(input: {
    targetType: string;
    targetId: string;
    reporterUserId: string;
    reason: string;
    details?: string | null;
  }): Promise<void> {
    await this.#db.insert(reports).values({
      id: crypto.randomUUID(),
      targetType: input.targetType,
      targetId: input.targetId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details ?? null,
    });
  }

  /** Whether this reporter already has an open report against the same target (dedupe guard). */
  async hasOpenFrom(
    reporterUserId: string,
    targetType: string,
    targetId: string,
  ): Promise<boolean> {
    const found = await this.#db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterUserId, reporterUserId),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
        ),
      )
      .limit(1);
    return found[0] !== undefined;
  }

  /**
   * The conditions shared by the queue's list and its status counts: an optional status, an optional
   * reason category, and a free-text `q` matched (case-insensitively) against the plugin name, the
   * reporter, and the details. A reporter match needs the `users` join, so callers must include it.
   */
  #where(filter: { status: ReportStatusFilter; reason?: string; q?: string }): SQL | undefined {
    const conds: SQL[] = [];
    if (filter.status !== "all") conds.push(eq(reports.status, filter.status));
    if (filter.reason) conds.push(eq(reports.reason, filter.reason));
    const needle = filter.q?.trim().toLowerCase();
    if (needle) {
      const pat = `%${needle}%`;
      const match = or(
        like(reports.targetId, pat),
        like(users.name, pat),
        like(users.displayName, pat),
        like(reports.details, pat),
      );
      if (match) conds.push(match);
    }
    return conds.length > 0 ? and(...conds) : undefined;
  }

  /** A page of the moderation queue, newest first, narrowed by status/reason/search. */
  async list(opts: {
    status: ReportStatusFilter;
    reason?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: OperatorReport[]; total: number }> {
    const where = this.#where(opts);
    const rows = await this.#db
      .select({
        id: reports.id,
        targetId: reports.targetId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        pluginDisplayName: plugins.displayName,
        ...authorColumns,
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterUserId, users.id))
      .leftJoin(plugins, eq(reports.targetId, plugins.name))
      .where(where)
      .orderBy(desc(reports.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);

    const counted = await this.#db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .innerJoin(users, eq(reports.reporterUserId, users.id))
      .where(where);

    return {
      items: rows.map((row) => ({
        id: row.id,
        pluginName: row.targetId,
        pluginDisplayName: row.pluginDisplayName,
        reason: row.reason,
        details: row.details,
        reporter: toAuthor(this.#blob, row),
        status: row.status,
        createdAt: new Date(row.createdAt * 1000).toISOString(),
      })),
      total: counted[0]?.count ?? 0,
    };
  }

  /** Per-status counts for the queue chips, honoring the active reason/search filters. */
  async statusCounts(filter: { reason?: string; q?: string }): Promise<ReportStatusCounts> {
    const rows = await this.#db
      .select({ status: reports.status, count: sql<number>`count(*)` })
      .from(reports)
      .innerJoin(users, eq(reports.reporterUserId, users.id))
      .where(this.#where({ ...filter, status: "all" }))
      .groupBy(reports.status);
    const by = new Map(rows.map((row) => [row.status, row.count]));
    return {
      open: by.get("open") ?? 0,
      resolved: by.get("resolved") ?? 0,
      dismissed: by.get("dismissed") ?? 0,
    };
  }

  /** Open-report counts per plugin name, for the operator Packages badges (skips empty input). */
  async openCountsByTarget(names: string[]): Promise<Map<string, number>> {
    if (names.length === 0) return new Map();
    const rows = await this.#db
      .select({ targetId: reports.targetId, count: sql<number>`count(*)` })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, "plugin"),
          eq(reports.status, "open"),
          inArray(reports.targetId, names),
        ),
      )
      .groupBy(reports.targetId);
    return new Map(rows.map((row) => [row.targetId, row.count]));
  }

  /**
   * The most-reported open reason category per plugin name (the "flag" shown in the operator list).
   * Ties break by whichever reason the grouped scan sees first. Skips empty input.
   */
  async topReasonByTarget(names: string[]): Promise<Map<string, string>> {
    if (names.length === 0) return new Map();
    const rows = await this.#db
      .select({ targetId: reports.targetId, reason: reports.reason, count: sql<number>`count(*)` })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, "plugin"),
          eq(reports.status, "open"),
          inArray(reports.targetId, names),
        ),
      )
      .groupBy(reports.targetId, reports.reason)
      // Stable order so a tie resolves deterministically (alphabetically-first reason wins).
      .orderBy(reports.targetId, reports.reason);
    const best = new Map<string, { reason: string; count: number }>();
    for (const row of rows) {
      const current = best.get(row.targetId);
      if (current === undefined || row.count > current.count) {
        best.set(row.targetId, { reason: row.reason, count: row.count });
      }
    }
    return new Map([...best].map(([target, { reason }]) => [target, reason]));
  }

  /**
   * Open-report counts per scope, summed across the scope's plugins, for the operator Scopes
   * badges. Joins `reports` to `plugins` (by name) to read each plugin's scope (skips empty input).
   */
  async openCountsByScope(scopes: string[]): Promise<Map<string, number>> {
    if (scopes.length === 0) return new Map();
    const rows = await this.#db
      .select({ scope: plugins.scope, count: sql<number>`count(*)` })
      .from(reports)
      .innerJoin(plugins, eq(reports.targetId, plugins.name))
      .where(
        and(
          eq(reports.targetType, "plugin"),
          eq(reports.status, "open"),
          isNotNull(plugins.scope),
          inArray(plugins.scope, scopes),
        ),
      )
      .groupBy(plugins.scope);
    return new Map(rows.flatMap((row) => (row.scope === null ? [] : [[row.scope, row.count]])));
  }

  /**
   * Resolve or dismiss an open report. Returns the report's target (plugin name) so the caller can
   * audit it, or null when no open report had that id (already handled, or unknown).
   */
  async setStatus(id: string, status: ReportResolution): Promise<string | null> {
    const updated = await this.#db
      .update(reports)
      .set({ status })
      .where(and(eq(reports.id, id), eq(reports.status, "open")))
      .returning({ targetId: reports.targetId });
    return updated[0]?.targetId ?? null;
  }
}
