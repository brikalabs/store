import type { PublishIdentity } from "./publish";

/**
 * The acting principal, snapshotted into an audit row at write time so the log is self-contained:
 * it survives a later rename, avatar change, or account deletion without a join.
 */
export interface Actor {
  /** Brika account id, or null for a CI/automated actor. */
  readonly id: string | null;
  /** Display-name snapshot at action time (or `owner/repo` for a CI actor). */
  readonly displayName: string | null;
  /** Avatar URL snapshot at action time; null for CI or when the account has none. */
  readonly avatarUrl: string | null;
}

/** One entry for the append-only audit log (publishes + management + scope actions). */
export interface AuditEntry {
  readonly action: string;
  readonly packageName: string;
  /** The version acted on, or null for scope-level actions. */
  readonly version: string | null;
  readonly actor: PublishIdentity;
  readonly detail?: Record<string, unknown> | null;
}

/** Build an {@link AuditEntry} from the caller's identity plus the varying fields, defaulting
 *  version and detail to null. */
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
 * Append-only audit log port. `record` is best-effort by contract: it is called AFTER the action
 * has committed, so a failed audit write must be swallowed (logged, never thrown), not turned into
 * a 500.
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
  /** Who performed it, as snapshotted at write time (account id + display name + avatar). */
  readonly actor: Actor | null;
  readonly detail: Record<string, unknown> | null;
  /** ISO-8601 timestamp of when the entry was recorded. */
  readonly at: string;
}

/** Read side of the audit log, for the operator console. Separate from {@link AuditLog} so
 *  write-only call sites do not gain a read method they never use; one adapter may implement both. */
export interface AuditReader {
  /** The most recent entries, newest first, capped at `limit`. */
  recent(limit: number): Promise<AuditRecord[]>;
}
