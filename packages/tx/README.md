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

## Lifecycle

A unit of work has exactly one of two outcomes. `transaction(fn)` opens a unit
(subject to [propagation](#propagation)), runs `fn`, then:

```
run fn(body)
   ├── body resolves ─────▶ run commit actions (onCommit), in registration order
   │                           └── this is the COMMIT POINT (e.g. a deferred DB batch)
   │                        run completion hooks (onComplete / afterCommit), outcome = "committed"
   │                        return the body's value
   │
   └── body throws ───────▶ run rollback compensations (onRollback), in REVERSE order (LIFO)
                            run completion hooks (onComplete), outcome = "rolledBack"
                            rethrow the original error
```

Details that matter:

- **The commit point is `onCommit`.** Reversible work (an R2 `put`) is staged in the
  body; the irreversible/atomic write (a D1 `batch`) is deferred to `onCommit` so it
  runs last, after everything else has staged successfully. `deferBatch` uses this.
- **A failing commit action rolls the unit back.** If an `onCommit` step throws, it is
  treated as a fault: the compensations run, completions fire with `"rolledBack"`, and
  the error propagates. So "the DB batch failed at the commit point" still undoes the
  staged tarball.
- **A failing compensation never hijacks the outcome.** An `onRollback` that throws is
  logged and skipped; the remaining undos still run and the *original* error is what
  propagates. Keep compensations idempotent and cheap.
- **Completion hooks always run** (committed or rolled back) and their failures are
  logged, never propagated - they are for notifications, cache busts, metrics.
  `afterCommit(cb)` is sugar for a completion that only fires on `"committed"`.
- **`rollbackOn(error)`** (an option) lets a unit *commit despite* a throw - return
  `false` for errors that should not trigger compensation (the error still propagates,
  but the undos are skipped).

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

Propagation decides how a unit relates to one that is **already running** in the same
async context. Under the hood every mode is built from three primitives:

- **open** - start a fresh unit with its own hook lists (its own fate);
- **join** - run in the *current* unit, so hooks enlist onto it and share its outcome
  (with no active unit, "join" means run plain - hooks are no-ops);
- **suspend** - hide the active unit for the duration, so the work runs as if none were
  open (its hooks are no-ops or, with `requiresNew`, belong to a fresh unit).

The same six modes Spring exposes:

| Mode | Inside an active unit | With no active unit | Reach for it when |
| --- | --- | --- | --- |
| `required` (default) | **join** it - shared fate | **open** a new one | the work is just part of whatever unit is running |
| `requiresNew` | **suspend** it, run in a fresh **independent** unit | **open** a new one | the work must commit or roll back on its own, regardless of the caller (e.g. an audit row that must survive an outer rollback) |
| `mandatory` | **join** it | **throw** | the work may only run as part of a caller's unit, never alone |
| `never` | **throw** | run plain (no unit) | the work must never be transactional |
| `supports` | **join** it | run plain (no unit) | the work adapts: transactional if a unit exists, plain otherwise |
| `notSupported` | **suspend** it, run plain | run plain (no unit) | the work must run outside any unit - its `onRollback`/`onCommit` become no-ops |

Two consequences worth internalising:

- With `required`, a nested unit's `onRollback` enlists onto the **outer** unit, so an
  outer failure undoes the inner's work too (one shared scope). With `requiresNew`, the
  inner has its **own** scope: it commits independently, and an outer rollback can no
  longer undo it.
- A propagation that does not **open** a unit (`never`, `supports`/`notSupported` with
  no active unit) runs with no scope, so the hooks silently do nothing - the same code
  is safe wrapped or not.

### Read-only

`readOnly: true` (or `readOnlyTransaction(fn)`, or `@transactional({ readOnly: true })`)
marks a unit as read-only. It is Spring's `@Transactional(readOnly = true)`, but
**enforced rather than a hint**: any attempt to stage a write inside it throws a
`TransactionError` -

- `onRollback(...)` - there is nothing to undo in a read path;
- `onCommit(...)` - and therefore `deferBatch(...)`, which schedules a commit action.

Completion hooks (`onComplete` / `afterCommit`) are still allowed - logging, metrics and
cache reads are not mutations. `isReadOnly()` reports the current unit's flag. Wrapping a
read path this way turns "this method only reads" from a comment into a guarantee: if it
ever tries to write, it fails loudly in tests. (It does **not** route to D1 read
replicas - that is a separate Sessions-API concern.)

The flag belongs to the unit that is *opened*: a `required` call that joins an existing
read-write unit does not retroactively make it read-only (config applies when a scope
opens, not when one is joined), so put `readOnly` on the outermost unit of a read path.

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
