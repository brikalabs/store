# @brika/tx

A compensating-transaction engine (a saga) for side effects that span systems
with **no shared transaction**. Publishing a package writes a tarball to R2 and
metadata to D1; those are two independent systems, so there is no `BEGIN`/`COMMIT`
that covers both. This package gives you one: register an undo next to each
effect, and if the unit of work throws, the undos run in reverse.

It is **not** ACID. A database that has its own transaction (a D1 `batch()`, a
SQL `BEGIN`) should still use it; `@brika/tx` coordinates the effects *between*
such systems. The context is ambient (no transaction object to thread through
calls), via `AsyncLocalStorage`, so it is concurrency-safe but **server-only**
(Node, Bun, Cloudflare Workers with `nodejs_compat`); it does not run in a
browser. See [Runtime](#runtime).

## The idea in one screen

```ts
import { transaction, onRollback, afterCommit } from "@brika/tx";

await transaction(async () => {
  await bucket.put(key, bytes);
  onRollback(() => bucket.delete(key)); // undo, if anything below fails

  await db.insert(...);                 // throws here -> the put is rolled back
  afterCommit(() => cache.bust(key));   // runs only after the unit succeeds
});
```

`onRollback` enlists an undo. If the callback resolves, nothing rolls back and
the commit/completion hooks fire; if it throws, every enlisted undo runs in
reverse order (LIFO) and the error propagates. Outside a transaction these hooks
are no-ops, so the same code runs un-wrapped.

## API

| Export | What it does |
| --- | --- |
| `transaction(fn, options?)` | Run `fn` as a unit of work and return its result. |
| `readOnlyTransaction(fn, options?)` | Run `fn` as a read-only unit (staging any write throws). |
| `transactional(options?)` | TC39 decorator: wrap a method as a unit of work. |
| `onRollback(undo)` | Enlist a compensation, run LIFO if the unit fails. |
| `onCommit(action)` | Defer work to just before the unit succeeds (e.g. a flush). |
| `onComplete(action)` / `afterCommit(cb)` | Run after the unit settles (`afterCommit` only on success). |
| `inTransaction()` / `isReadOnly()` | Whether the caller is inside a unit of work / a read-only one. |
| `transactionalStorage(store)` / `transactionalDb(db)` | Proxy wrappers that auto-enlist a store's `put` / defer a DB `batch`, preserving every other method. |
| `required` / `requiresNew` / `mandatory` / `never` / `supports` / `notSupported` | Spring-style propagation strategies. |
| `transactions` / `TransactionManager` | The default manager instance and its class, for isolated managers. |

### Propagation

The same six modes Spring exposes, picking how a unit relates to one already
running:

- `required` (default): join the active unit, or start one.
- `requiresNew`: always start a fresh, independent unit.
- `mandatory`: must already be in a unit, else throw.
- `never`: must **not** be in a unit, else throw.
- `supports`: join if present, otherwise run with no unit.
- `notSupported`: run with no unit even if one is active.

### Options

`transaction`, `readOnlyTransaction`, and `@transactional` all take a single
`TxOptions` object - `{ propagation?, readOnly?, rollbackOn? }` - mirroring Spring's
`@Transactional(...)` attributes:

- `propagation`: how this relates to an active unit (default `required`).
- `readOnly`: enforce no writes - staging `onRollback`/`onCommit`/`deferBatch` throws.
- `rollbackOn`: roll back only when the predicate returns true (default: any error).

### Decorator

```ts
import { transactional, requiresNew } from "@brika/tx";

class PublishService {
  @transactional()                              // every call is a unit of work
  async publish(input: Input) { ... }

  @transactional({ propagation: requiresNew })  // its own independent unit
  async audit(event: Event) { ... }

  @transactional({ readOnly: true })            // proven side-effect-free
  async resolve(name: string) { ... }
}
```

## Wrappers

You usually do not call `onRollback` by hand. Wrap a store or ORM once and its
ordinary methods become transactional, keeping the original type so the rest of
the API still works:

```ts
import { transactionalStorage, transactionalDb } from "@brika/tx";

const files = transactionalStorage(bucket); // files.put now auto-enlists its undo
const db = transactionalDb(drizzleDb);       // db.deferBatch flushes on commit
files.list(); // every other method passes straight through
```

## Runtime

The ambient context is an `AsyncLocalStorage` from `node:async_hooks`, so the
package runs anywhere that exists: **Node, Bun, and Cloudflare Workers** (with
`compatibility_flags: ["nodejs_compat"]`). It is **not** a browser API, so do not
import `@brika/tx` into a client bundle. This is intentional: a saga here
coordinates server-side systems (R2 + D1), which the browser never touches.

## How the registry uses it

The publish handler wraps the domain service in one `transaction(...)`; the R2
tarball writer self-enlists `onRollback(() => delete(key))`, and the D1
`commitVersion` is one atomic `batch()`. A failed metadata commit therefore rolls
the staged tarball back, making a publish all-or-nothing across R2 + D1. It is
the only flow wired this way, because it is the only one that writes two systems
as a single unit.

## Tests

```sh
bun test   # propagation, commit/rollback/completion hooks, isolation + concurrency, wrappers
```

Concurrency is covered explicitly (many in-flight units stay isolated), since a
leak there would be silent and severe.
