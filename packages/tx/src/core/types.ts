/** A rollback step, run (in reverse) when a transaction fails. */
export type Compensation = () => Promise<void> | void;

/** A commit step, run when a transaction succeeds (e.g. flush a deferred DB batch). */
export type CommitAction = () => Promise<void> | void;

/** How a transaction finished. */
export type TxOutcome = "committed" | "rolledBack";

/**
 * A step run at the very end of a transaction, after commit or rollback (Spring's `afterCompletion`).
 * Its failure is logged, never propagated, and never affects the outcome.
 */
export type CompletionAction = (outcome: TxOutcome) => Promise<void> | void;

export interface TxConfig {
  /** Roll back only when this returns true (default: roll back on any error). */
  readonly rollbackOn?: (error: unknown) => boolean;
  /**
   * Mark the unit of work read-only. Enforced, not just a hint: registering any write step inside it
   * (`onRollback`/`onCommit`/`deferBatch`) throws, so a read path wrapped this way is proven
   * side-effect-free. Completion hooks still run, since logging/metrics are not mutations.
   */
  readonly readOnly?: boolean;
}
