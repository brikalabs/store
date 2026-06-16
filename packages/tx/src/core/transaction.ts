import { TransactionManager } from "./manager";
import { type Propagation, required } from "./propagation";
import type { CommitAction, Compensation, CompletionAction, TxConfig } from "./types";

/**
 * The default transaction manager backing the convenience helpers below (like
 * Spring's single injected manager bean). Adapters and handlers use these helpers;
 * a test can construct its own {@link TransactionManager} for isolation.
 */
export const transactions = new TransactionManager();

/** True when called inside a {@link transaction} scope. */
export function inTransaction(): boolean {
  return transactions.active;
}

/** Register a rollback step with the active transaction (no-op outside one). */
export function onRollback(undo: Compensation): void {
  transactions.enlist(undo);
}

/** Register a commit step with the active transaction (no-op outside one). */
export function onCommit(action: CommitAction): void {
  transactions.onCommit(action);
}

/**
 * Register a step to run at the end of the transaction, after it commits or rolls
 * back, receiving the outcome (no-op outside one). For work that should follow the
 * decision either way: logging, metrics, cleanup.
 */
export function onComplete(action: CompletionAction): void {
  transactions.onComplete(action);
}

/** Register a step to run only after the transaction successfully commits. */
export function afterCommit(callback: () => Promise<void> | void): void {
  transactions.onComplete((outcome) => {
    if (outcome === "committed") return callback();
  });
}

/** Run `fn` as a transaction with the given {@link Propagation} (default {@link required}). */
export function transaction<T>(
  fn: () => Promise<T>,
  propagation: Propagation = required,
  config: TxConfig = {},
): Promise<T> {
  return transactions.run(fn, propagation, config);
}

/** Method decorator: run the method inside a {@link transaction} (Spring's `@Transactional`). */
export function transactional(propagation: Propagation = required, config: TxConfig = {}) {
  return <This, Args extends unknown[], Return>(
    method: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
  ): ((this: This, ...args: Args) => Promise<Return>) => {
    return function (this: This, ...args: Args): Promise<Return> {
      return transactions.run(() => method.apply(this, args), propagation, config);
    };
  };
}
