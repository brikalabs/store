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
 * Append-only audit log port. `record` is best-effort by contract: it is called AFTER
 * the action it records has already committed, so a failed audit write must be
 * swallowed (logged, never thrown) rather than turning a successful action into a 500.
 */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
