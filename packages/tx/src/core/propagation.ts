import { TransactionError } from "./errors";
import type { Scope } from "./scope";

/**
 * How a `transaction` relates to an already-active one (the Spring propagation
 * modes). A strategy value, not a string union: each is a function you pass (and
 * you can write your own), so there is no central `switch` to keep exhaustive.
 */
export type Propagation = <T>(fn: () => Promise<T>, scope: Scope) => Promise<T>;

/** Join the active transaction, or open one. The default. */
export const required: Propagation = (fn, scope) =>
  scope.active ? scope.join(fn) : scope.open(fn);

/** Always run in a fresh, independent transaction, suspending any active one. */
export const requiresNew: Propagation = (fn, scope) => scope.suspend(() => scope.open(fn));

/** Require an active transaction; throw if there is none. */
export const mandatory: Propagation = (fn, scope) => {
  if (!scope.active) {
    throw new TransactionError("propagation 'mandatory' requires an active transaction");
  }
  return scope.join(fn);
};

/** Forbid an active transaction; throw if one exists. */
export const never: Propagation = (fn, scope) => {
  if (scope.active) {
    throw new TransactionError("propagation 'never' forbids an active transaction");
  }
  return scope.join(fn);
};

/** Join an active transaction if present, else run without one. */
export const supports: Propagation = (fn, scope) => scope.join(fn);

/** Suspend any active transaction and run without one. */
export const notSupported: Propagation = (fn, scope) => scope.suspend(fn);
