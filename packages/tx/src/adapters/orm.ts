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
   * Run `statements` as one atomic batch at the transaction's commit point (after
   * the body has staged its reversible work). Outside a transaction it runs now.
   */
  deferBatch(statements: readonly Statement[]): Promise<void>;
}

/**
 * Return a transparent overlay of `db`: every member is delegated to the real
 * client (so `select`/`insert`/`batch`/... stay usable and typed), plus a
 * `deferBatch` that schedules an atomic batch for the commit point. The DB needs no
 * compensation because `batch` is atomic; it just needs correct timing.
 */
export function transactionalDb<Db, Statement>(
  db: Db & Batchable<Statement>,
): Db & Batchable<Statement> & TransactionalDb<Statement> {
  const deferBatch = (statements: readonly Statement[]): Promise<void> => {
    if (!inTransaction()) return db.batch(statements).then(() => undefined);
    onCommit(async () => {
      await db.batch(statements);
    });
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
