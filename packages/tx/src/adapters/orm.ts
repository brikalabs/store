import { inTransaction, onCommit } from "../core/transaction";

/**
 * The batch shape the wrapper needs: drizzle's `db.batch([...])`, which runs a set
 * of statements atomically on D1. Any other members (`select`, `insert`, `query`,
 * ...) are preserved by the wrapper untouched.
 */
export interface Batchable<Statement> {
  batch(statements: readonly Statement[]): Promise<unknown>;
}

export interface TransactionalDb<Statement> {
  /**
   * Persist `statements` as one unit that participates in the ambient transaction:
   * inside a {@link transaction} it runs at the commit point (after the body has
   * staged its reversible work, e.g. an R2 put with its `onRollback`); outside one it
   * runs immediately. Just call it and forget about timing - that is the whole point.
   *
   * Uses the client's atomic `batch` when it has one (D1), and otherwise runs the
   * statements in order (e.g. the bun:sqlite test client), so the same call works in
   * every environment with no batch-vs-sequential branching at the call site.
   */
  deferBatch(statements: readonly Statement[]): Promise<void>;
}

/**
 * Return a transparent overlay of `db`: every member is delegated to the real
 * client (so `select`/`insert`/`batch`/... stay usable and typed), plus a
 * `deferBatch` that runs an atomic write at the transaction's commit point. A writer
 * built on this overlay becomes transaction-aware for free - it just calls
 * `deferBatch` and the unit of work handles when (and how) the write lands.
 */
export function transactionalDb<Db, Statement>(
  db: Db & Batchable<Statement>,
): Db & Batchable<Statement> & TransactionalDb<Statement> {
  // Run the statements as one unit: the client's atomic batch when present, else in
  // order. Centralised here so call sites never branch on the client's capabilities.
  const runBatch = async (statements: readonly Statement[]): Promise<void> => {
    const client = db as { batch?: (statements: readonly Statement[]) => Promise<unknown> };
    if (typeof client.batch === "function") {
      await client.batch(statements);
      return;
    }
    for (const statement of statements as readonly PromiseLike<unknown>[]) await statement;
  };
  const deferBatch = (statements: readonly Statement[]): Promise<void> => {
    if (!inTransaction()) return runBatch(statements);
    onCommit(() => runBatch(statements));
    return Promise.resolve();
  };
  const proxy = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "deferBatch") return deferBatch;
      const member = Reflect.get(target, property, receiver);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
  // The proxy adds `deferBatch`; assert the augmented type (it cannot be expressed
  // through the Proxy<Db> typing alone).
  return proxy as Db & Batchable<Statement> & TransactionalDb<Statement>;
}
