import type { PublishIdentity } from "./publish";

/** One entry for the append-only audit log (publishes + management + scope actions). */
export interface AuditEntry {
  readonly action: string;
  readonly packageName: string;
  /** The version acted on, or null for scope-level actions. */
  readonly version: string | null;
  readonly actor: PublishIdentity;
  readonly detail?: Record<string, unknown> | null;
}

/**
 * Build an {@link AuditEntry} from the caller's identity plus the varying fields, defaulting the
 * version and detail to null. Every audit call site shares the same actor + null-defaulting, so
 * this is the one place that shape is assembled (the registry's `auditScope` and the console's
 * `recordAudit` both delegate here).
 */
export function auditEntry(
  actor: PublishIdentity,
  entry: {
    readonly action: string;
    readonly packageName: string;
    readonly version?: string | null;
    readonly detail?: Record<string, unknown> | null;
  },
): AuditEntry {
  return {
    action: entry.action,
    packageName: entry.packageName,
    version: entry.version ?? null,
    actor,
    detail: entry.detail ?? null,
  };
}

/**
 * Append-only audit log port. `record` is best-effort by contract: it is called AFTER
 * the action it records has already committed, so a failed audit write must be
 * swallowed (logged, never thrown) rather than turning a successful action into a 500.
 */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

/** A persisted audit entry as read back for the operator console (newest first). */
export interface AuditRecord {
  readonly id: string;
  readonly action: string;
  /** The package or org slug the action targeted, or null. */
  readonly target: string | null;
  readonly version: string | null;
  /** Who performed it (the persisted actor string: repo for CI, owner for local). */
  readonly actor: string | null;
  readonly detail: Record<string, unknown> | null;
  /** ISO-8601 timestamp of when the entry was recorded. */
  readonly at: string;
}

/**
 * Read side of the audit log, for the operator console. Separate from {@link AuditLog} so
 * write-only call sites (publish, manage) do not gain a read method they never use; one
 * adapter may implement both.
 */
export interface AuditReader {
  /** The most recent entries, newest first, capped at `limit`. */
  recent(limit: number): Promise<AuditRecord[]>;
}
