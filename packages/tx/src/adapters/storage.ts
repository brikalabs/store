import { onRollback } from "../core/transaction";

/** The object-storage shape the wrapper needs (a subset of R2): `put` writes, `delete` is its inverse. */
export interface FileStore {
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * A transparent overlay of `store` that delegates every member except `put`, which also registers its
 * `delete` as a rollback step when called inside a transaction. The concrete type `S` is preserved.
 */
export function transactionalStorage<S extends FileStore>(store: S): S {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "put") {
        return async (key: string, value: string): Promise<void> => {
          await target.put(key, value);
          onRollback(() => target.delete(key));
        };
      }
      const member = Reflect.get(target, property, receiver);
      // Bind methods to the real instance so their private state works through the proxy.
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}
