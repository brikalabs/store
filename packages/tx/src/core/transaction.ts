import { TransactionManager } from "./manager";
import { type Propagation, required } from "./propagation";
import type { CommitAction, Compensation, CompletionAction, TxConfig } from "./types";

/** The default transaction manager backing the helpers below; a test can construct its own for isolation. */
export const transactions = new TransactionManager();

/** True when called inside a {@link transaction} scope. */
export function inTransaction(): boolean {
  return transactions.active;
}

/** True when the active transaction is read-only (false when there is none). */
export function isReadOnly(): boolean {
  return transactions.readOnly;
}

/** Register a rollback step with the active transaction (no-op outside one). */
export function onRollback(undo: Compensation): void {
  transactions.enlist(undo);
}

/** Register a commit step with the active transaction (no-op outside one). */
export function onCommit(action: CommitAction): void {
  transactions.onCommit(action);
}

/** Register a step to run at the end of the transaction, after commit or rollback (no-op outside one). */
export function onComplete(action: CompletionAction): void {
  transactions.onComplete(action);
}

/** Register a step to run only after the transaction successfully commits. */
export function afterCommit(callback: () => Promise<void> | void): void {
  transactions.onComplete((outcome) => {
    if (outcome === "committed") return callback();
  });
}

/** A unit of work's full config in one object (Spring's `@Transactional(...)`): propagation + {@link TxConfig}. */
export interface TxOptions extends TxConfig {
  /** How this relates to an already-active transaction (default {@link required}). */
  readonly propagation?: Propagation;
}

/** Run `fn` as a unit of work configured by a single {@link TxOptions} object. */
export function transaction<T>(fn: () => Promise<T>, options: TxOptions = {}): Promise<T> {
  const { propagation = required, ...config } = options;
  return transactions.run(fn, propagation, config);
}

/**
 * Run `fn` as a read-only unit of work: `transaction(fn, { readOnly: true })`. Any attempt to stage a
 * write inside it throws, so a read path wrapped this way is proven side-effect-free.
 */
export function readOnlyTransaction<T>(
  fn: () => Promise<T>,
  options: Omit<TxOptions, "readOnly"> = {},
): Promise<T> {
  return transaction(fn, { ...options, readOnly: true });
}

/** Method decorator: run the method inside a {@link transaction} (Spring's `@Transactional`). */
export function transactional(options: TxOptions = {}) {
  const { propagation = required, ...config } = options;
  return <This, Args extends unknown[], Return>(
    method: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
  ): ((this: This, ...args: Args) => Promise<Return>) => {
    return function (this: This, ...args: Args): Promise<Return> {
      return transactions.run(() => method.apply(this, args), propagation, config);
    };
  };
}
