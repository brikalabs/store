# Testing

`bun:test`, colocated as `subject.test.ts` next to the code it covers. Non-trivial logic ships with a
check; a presentational component does not (ADR-0004). Tests are part of the architecture: they are the
proof that the security and rollback invariants hold, so they are held to the same simplicity bar as
the code, simple, readable, one behaviour each.

## Naming (the convention)

- **`describe`** names the unit under test: a class or an exported function (`describe("D1ScopeStore")`,
  `describe("trustedPublisherMatches")`). Not a feature phrase.
- **`test`** is a present-tense, verb-led sentence stating the side effect or its absence
  (`test("claim creates the scope once and reports who created it")`,
  `test("rejects when ownership denies, without writing")`). No `should` / `when` openers. A
  structured-spec prefix is fine where a spec drives the case (`test("ORG-007-AC1 ...")`).

This is a convention, not a gate (a script banning words would false-alarm on the spec prefixes), and
it is already met across the suite. Match it.

## The three DI seams

Every test builds the real graph and overrides only what it must (`@brika/di`). Pick the seam for the
layer:

- **Pure core / services** -> `testBed(provide(Port, fake)).inject(Service)`. Inject in-memory fakes for
  the ports; the rest of the graph stays real. `.with(provide(...))` layers one extra override.
  ```ts
  const bed = testBed(provide(ScopeStore, scopes), provide(ScopeMembers, members));
  const service = bed.inject(ScopeService);
  ```
- **D1 adapters** -> `makeAdapter(makeDb(), D1X)` from `@brika/db`'s `test-harness.ts`. `makeDb()` is a
  real in-memory bun:sqlite with the shipped migrations applied, so the actual SQL runs without the
  Cloudflare runtime. Test the adapter against real rows, not a mock driver.
  ```ts
  let db: Db;
  beforeEach(() => { db = makeDb(); store = makeAdapter(db, D1ScopeStore); });
  ```
- **Request handlers** -> run the handler inside `runInContext([...providers], handler)`; append a later
  provider to fake one seam (the latest binding wins).

## What to test

- **Security and boundary code carries a positive AND a negative case.** Integrity, OIDC, the publish
  gates, auth/session, ownership/membership, rate limits: prove the allow path and the deny path
  (tampered hash, wrong issuer/audience, expired token, unauthorized scope, an overwrite attempt, a
  forged cookie, a limit exceeded). A gate with only a happy-path test is untested.
- **A transaction has a rollback test.** A saga that stages an external write before a DB write
  (`@brika/tx`: `transaction` + `onRollback`) ships a test that makes the DB step throw and asserts the
  compensation ran (the staged R2 object is deleted, no orphan) and the error re-propagates. See
  `user-avatar.ts` / `icon.ts` and their tests. A `readOnlyTransaction` ships a test that it throws when
  a write is staged.
- **The last-writer-wins / last-admin / filter invariants** (anything an atomic SQL subquery enforces)
  get a test for the boundary: the last admin cannot be removed, a yanked version is excluded.

## Keep it simple

- One behaviour per `test`; arrange, act, assert, no shared mutable state across cases (`beforeEach` a
  fresh db/bed).
- Prefer a real fake (an in-memory port, a real `makeDb`) over a mocking framework. Do not assert on
  implementation details (call order, private fields); assert on observable effects.
- No giant fixtures. Seed the minimum the case needs (`seedExamplePackage` exists for the canonical one).
