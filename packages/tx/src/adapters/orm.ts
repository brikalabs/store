import { TransactionError } from "../core/errors";
import { inTransaction, isReadOnly, onCommit } from "../core/transaction";

// Drizzle's mutating query builders. In a read-only unit, even a raw `db.insert(...)`
// (one that bypasses `deferBatch`) is a write, so the overlay rejects these the moment
// they are called - making read-only airtight for any code using the tx-aware client,
// not just the deferBatch path.
const MUTATORS: ReadonlySet<string> = new Set(["insert", "update", "delete"]);

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
  // The proxy adds `deferBatch`; assert the augmented type (it cannot be expressed
  // through the Proxy<Db> typing alone).
  return proxy as Db & Batchable<Statement> & TransactionalDb<Statement>;
}
