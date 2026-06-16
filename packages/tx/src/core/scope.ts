/**
 * The primitives a {@link import("./propagation").Propagation} composes. The
 * manager builds a `Scope` per `run` call; a propagation strategy decides which
 * of these to call based on whether a transaction is already `active`.
 */
export interface Scope {
  /** Whether a transaction is already active in the current async context. */
  readonly active: boolean;
  /** Run `fn` in a fresh compensating scope (commit on success, roll back on throw). */
  open<T>(fn: () => Promise<T>): Promise<T>;
  /** Run `fn` with no transaction, suspending any active one. */
  suspend<T>(fn: () => Promise<T>): Promise<T>;
  /** Run `fn` as-is in the current context (joining an active tx, or none). */
  join<T>(fn: () => Promise<T>): Promise<T>;
}
