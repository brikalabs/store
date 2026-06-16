/** A rollback step, run (in reverse) when a transaction fails. */
export type Compensation = () => Promise<void> | void;

/** A commit step, run when a transaction succeeds (e.g. flush a deferred DB batch). */
export type CommitAction = () => Promise<void> | void;

/** How a transaction finished. */
export type TxOutcome = "committed" | "rolledBack";

/**
 * A step run at the very end of a transaction, after it has committed or rolled
 * back (Spring's `afterCompletion`). Its failure is logged, never propagated, and
 * never affects the outcome. Good for notifications, cache busting, enqueuing work.
 */
export type CompletionAction = (outcome: TxOutcome) => Promise<void> | void;

export interface TxConfig {
  /** Roll back only when this returns true (default: roll back on any error). */
  readonly rollbackOn?: (error: unknown) => boolean;
}
