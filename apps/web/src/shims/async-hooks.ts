/**
 * No-op `AsyncLocalStorage` for the browser build. `@brika/di`'s injection context is server-only,
 * but client code imports tokens / pure helpers from domain packages that transitively pull in
 * `@brika/di`, so a static `node:async_hooks` import reaches the browser - where it is externalized
 * and throws on access. The client never runs `inject()` / `runInContext`, so this shim is never
 * actually used; it only keeps the real `node:async_hooks` out of the client resolution. Aliased in
 * for the `client` environment only (see vite.config.ts); the SSR build uses the real module.
 */
export class AsyncLocalStorage<T> {
  getStore(): T | undefined {
    return undefined;
  }
  run<R>(_store: T, fn: () => R): R {
    return fn();
  }
}
