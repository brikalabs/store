import { onRollback } from "../core/transaction";

/**
 * The object-storage shape the wrapper needs (a subset of R2 / the store's
 * `BlobStore`): `put` writes, `delete` is its inverse. Any other members (`get`,
 * `list`, `head`, ...) are preserved by the wrapper untouched.
 */
export interface FileStore {
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Return a transparent overlay of `store`: every member is delegated to the real
 * instance (so its full API stays usable and typed), except `put`, which also
 * registers its `delete` as a rollback step when called inside a transaction. The
 * concrete type `S` is preserved, so `transactionalStorage(bucket).list()` (or any
 * other method) still works.
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
      // Bind methods to the real instance so their internal/private state works
      // when called through the proxy.
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}
