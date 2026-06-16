export { type Batchable, type TransactionalDb, transactionalDb } from "./adapters/orm";
export { type FileStore, transactionalStorage } from "./adapters/storage";
export { TransactionError } from "./core/errors";
export { TransactionManager } from "./core/manager";
export {
  mandatory,
  never,
  notSupported,
  type Propagation,
  required,
  requiresNew,
  supports,
} from "./core/propagation";
export type { Scope } from "./core/scope";
export {
  afterCommit,
  inTransaction,
  onCommit,
  onComplete,
  onRollback,
  transaction,
  transactional,
  transactions,
} from "./core/transaction";
export type {
  CommitAction,
  Compensation,
  CompletionAction,
  TxConfig,
  TxOutcome,
} from "./core/types";
