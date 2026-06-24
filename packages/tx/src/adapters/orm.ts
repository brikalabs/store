import { TransactionError } from "../core/errors";
import { inTransaction, isReadOnly, onCommit } from "../core/transaction";

// Drizzle's mutating query builders. The overlay rejects these in a read-only unit the moment they
// are called, making read-only airtight for any tx-aware client code, not just the deferBatch path.
const MUTATORS: ReadonlySet<string> = new Set(["insert", "update", "delete"]);

/** The batch shape the wrapper needs: drizzle's `db.batch([...])`, run atomically on D1. */
export interface Batchable<Statement> {
  batch(statements: readonly Statement[]): Promise<unknown>;
}

export interface TransactionalDb<Statement> {
  /**
   * Persist `statements` as one unit in the ambient transaction: inside a {@link transaction} it runs
   * at the commit point (after the body staged its reversible work); outside one it runs immediately.
   * Uses the client's atomic `batch` when present (D1), else runs in order (the bun:sqlite test client).
   */
  deferBatch(statements: readonly Statement[]): Promise<void>;
}

/**
 * A transparent overlay of `db` that delegates every member, plus a `deferBatch` that runs an atomic
 * write at the transaction's commit point. A writer built on it becomes transaction-aware for free.
 */
export function transactionalDb<Db, Statement>(
  db: Db & Batchable<Statement>,
): Db & Batchable<Statement> & TransactionalDb<Statement> {
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
      if (typeof member !== "function") return member;
      if (typeof property === "string" && MUTATORS.has(property)) {
        return (...args: unknown[]) => {
          if (isReadOnly()) {
            throw new TransactionError(`cannot call '${property}' in a read-only transaction`);
          }
          return Reflect.apply(member, target, args);
        };
      }
      return member.bind(target);
    },
  });
  // The proxy adds `deferBatch`; the cast asserts the augmented type Proxy<Db> cannot express.
  return proxy as Db & Batchable<Statement> & TransactionalDb<Statement>;
}
