import { AsyncLocalStorage } from "node:async_hooks";
import { type Propagation, required } from "./propagation";
import type { Scope } from "./scope";
import type { CommitAction, Compensation, CompletionAction, TxConfig, TxOutcome } from "./types";

/** The hooks bound to one active transaction (Spring's `TransactionSynchronization`s). */
interface Synchronizations {
  readonly rollbacks: Compensation[];
  readonly commits: CommitAction[];
  readonly completions: CompletionAction[];
}

/**
 * Owns the transaction context and the begin/commit/rollback logic. Plays both
 * Spring roles: `PlatformTransactionManager` (begin/commit/rollback, here {@link run})
 * and `TransactionSynchronizationManager` (the per-async-context store + the
 * rollback/commit hooks). The context store is private to the instance, so use the
 * default manager via the helpers in `./transaction`, or construct an isolated one
 * (e.g. per test) instead of sharing a global.
 */
export class TransactionManager {
  readonly #context = new AsyncLocalStorage<Synchronizations | undefined>();

  /** Whether the current async context is inside a transaction. */
  get active(): boolean {
    return this.#context.getStore() !== undefined;
  }

  /** Register a rollback step with the active transaction (no-op outside one). */
  enlist(undo: Compensation): void {
    this.#context.getStore()?.rollbacks.push(undo);
  }

  /** Register a commit step with the active transaction (no-op outside one). */
  onCommit(action: CommitAction): void {
    this.#context.getStore()?.commits.push(action);
  }

  /** Register an end-of-transaction step, run after commit or rollback (no-op outside one). */
  onComplete(action: CompletionAction): void {
    this.#context.getStore()?.completions.push(action);
  }

  /** Run `fn` under `propagation` (default {@link required}). */
  async run<T>(
    fn: () => Promise<T>,
    propagation: Propagation = required,
    config: TxConfig = {},
  ): Promise<T> {
    const scope: Scope = {
      active: this.active,
      open: (work) => this.#open(work, config),
      suspend: (work) => this.#context.run(undefined, work),
      join: (work) => work(),
    };
    // `async` so a strategy that throws synchronously (mandatory/never) rejects
    // rather than throwing at the call site.
    return propagation(fn, scope);
  }

  /** A fresh scope: run `fn`, flush commits on success or rollbacks on a fault, then complete. */
  #open<T>(fn: () => Promise<T>, config: TxConfig): Promise<T> {
    const sync: Synchronizations = { rollbacks: [], commits: [], completions: [] };
    return this.#context.run(sync, async () => {
      try {
        const result = await fn();
        for (const commit of sync.commits) await commit(); // the commit point (e.g. a D1 batch)
        await this.#complete(sync.completions, "committed");
        return result;
      } catch (error) {
        if (config.rollbackOn?.(error) ?? true) {
          for (const undo of sync.rollbacks.toReversed()) {
            try {
              await undo();
            } catch (rollbackError) {
              console.error("rollback step failed", rollbackError);
            }
          }
        }
        await this.#complete(sync.completions, "rolledBack");
        throw error;
      }
    });
  }

  /** Run the end-of-transaction hooks; their failures are logged, never propagated. */
  async #complete(completions: readonly CompletionAction[], outcome: TxOutcome): Promise<void> {
    for (const action of completions) {
      try {
        await action(outcome);
      } catch (completionError) {
        console.error("completion hook failed", completionError);
      }
    }
  }
}
