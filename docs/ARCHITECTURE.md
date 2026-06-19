# Architecture

Two Cloudflare Workers over shared packages. The design goal is a small,
pure, testable domain with the platform specifics pushed to the edges.

## Layering (hexagonal)

```
            HTTP (thin)                Cloudflare adapters            domain core
  ┌───────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────┐
  apps/registry  fetch handler ─▶  D1MetadataReader / R2*     ─▶  registry-core
  apps/web       routes + /v1  ─▶  D1 (drizzle) / KV / R2     ─▶  (ports only)
  └───────────────────────────┘   └──────────────────────────┘   └──────────────────┘
```

- **`@brika/registry-core`** has no Cloudflare imports. It defines storage
  **ports** (`MetadataReader`, `TarballReader`, `MetadataWriter`, `TarballWriter`)
  and the gate ports (`ManifestValidator`, `OwnershipPolicy`), plus the pure
  services (`ResolveService`, `PublishService`), integrity, packument building,
  and OIDC verification. Everything here is unit-tested with in-memory fakes.
- **Adapters** (in the apps) implement the ports against D1/R2.
- The **HTTP layer** parses requests, builds the identity, calls a service, and
  serializes. No business logic.

This is what makes the core runtime-agnostic (it runs identically under Bun for
tests and workerd in production) and the security-critical logic verifiable in
isolation.

## Swapping the platform (the portability rule)

We run on Cloudflare today, but the codebase is written so that is a
**replaceable detail, not a foundation**. The rule, in one line:

> **No Cloudflare type, import, or assumption may leak past an adapter.**

Concretely:

- **`@brika/registry-core` (domain) and `@brika/router` (HTTP) stay platform-free.**
  They import nothing from `cloudflare:*`, `@cloudflare/*`, `wrangler`, D1, R2, or
  KV. They speak only in **ports**: the domain core's `MetadataReader` /
  `TarballWriter` / …, and the router's generic `RateLimiter` (rate limiting is an
  HTTP-edge concern, so its port + middleware live in the router, not the domain).
  If a feature needs a new capability, add a port at the right layer, then
  implement it at the edge.
- **Adapters are the only Cloudflare-aware code**, and they live in the apps
  (`apps/*/src/adapters`). A D1 adapter implements a metadata port; an R2 adapter
  implements a tarball port; a Workers-binding adapter implements the router's
  `RateLimiter`. Each adapter is small and does one thing: translate between a port
  and one vendor API.
- **Every port ships a platform-free default** used by unit tests and local dev
  (an in-memory metadata fake, the router's pure `FixedWindowRateLimiter`, …).
  So the **domain core** is provably runnable with *zero* Cloudflare adapters
  present — which is exactly the property that lets us move.
- **Data-plane bindings are read in one place**: D1 and R2 flow through the
  `buildServices` composition root, fed by the single `context` factory in each
  app's `index.ts`. No controller, no domain service, ever touches them via the
  ambient `env`. Edge-config bindings that are not part of the domain graph (the
  typed env vars, and the rate-limit binding) are read through the typed
  `cloudflare:workers` `env` module instead, next to the edge code that uses them
  (e.g. the rate-limit binding in `adapters/cf-rate-limiter.ts`) — a deliberate
  exception so a cross-cutting concern stays self-contained rather than threading
  through every service. Both kinds of binding are Cloudflare-typed and both are
  what a platform move rewrites.

**What moving off Cloudflare would (and would not) take.** It would take:
reimplementing the handful of adapters against the new platform (e.g. Postgres
for D1, S3 for R2, a Redis token-bucket for `RateLimiter`), and rewriting each
app's thin entrypoint — `index.ts`, `wrangler.jsonc`, the `buildServices`
signature, the `Env` types, and the wiring tests that construct the service
graph. It would **not** touch the domain core, the services, the gates, the
integrity/packument logic, the controllers, or the core's unit tests — those
depend on ports, not on Cloudflare. The blast radius is, by construction, the
`adapters/` directories and the per-app composition root, not the business logic.

## Architecture rules (enforced)

The layering above is not a convention you have to remember — the key parts are
enforced (ArchUnit-style) by a small rule engine in `scripts/archunit.ts`, with the
rules declared fluently in `scripts/architecture-rules.ts` (by package/folder glob, so
they scale as packages and apps are added). They run **two ways** off the same
definitions: as `bun test` cases (`scripts/architecture.test.ts`, one test per rule) and
as a standalone lint CLI (`bun run check:architecture`, in `bun run lint`). Either fails
the build, naming the offending file + import. The rules:

- **A. The domain core (`@brika/registry-core`) is platform-free.** It may not import
  any Cloudflare module (`cloudflare:*`, `@cloudflare/*`, `wrangler`), the database/ORM
  (`drizzle-orm`, `@brika/store-db`), or an HTTP framework (`hono`, `@brika/router`). It
  speaks only ports, so it stays runnable with zero adapters.
- **B. The router (`@brika/router`) is platform-free.** No Cloudflare, no database/ORM.
  (Hono is allowed — the router is a thin typed layer over it.)
- **C. The database is reached only through adapters and the composition root.** Inside
  `apps/registry/src`, only `adapters/**` and the composition root (`services.ts`,
  `index.ts`) may import `drizzle-orm`/`@brika/store-db`. Controllers, auth, and the rest
  go through a port on `ctx` — they cannot touch `db`. (Tests are exempt; they seed the
  in-memory database directly.)

Every adapter under `apps/registry/src/adapters` implements a `registry-core` port
(`D1MetadataReader` → `MetadataReader`, `D1ScopeStore` → `ScopeStore`, `D1TokenStore` →
`TokenStore`, …), so the adapter layer is uniformly swappable and the dependency arrows
all point inward.

## registry.brika.dev

npm-compatible. The hub points `@brika:registry` at it; `bun add` is unchanged.

**Resolve** (`GET /@scope/name`, `GET /@scope/name/-/*.tgz`):
1. normalize the path (`%2F` and `/` forms), derive the base URL from the request
   host so tarball URLs are self-referential on localhost and prod;
2. `ResolveService.packument` reads versions/dist-tags from D1 and builds the npm
   packument (hides yanked, surfaces deprecated, points `dist.tarball` at us with
   the SHA-512 `dist.integrity`);
3. tarballs stream from R2 with a 1-year `immutable` cache.

**Publish** (`POST /-/publish`): verify a credential -> build a `PublishIdentity`
-> `PublishService` runs the ownership gate, the `@brika/schema` data gate, the
immutability check, computes integrity, and writes the tarball then the version. A
rejected publish never writes.

**Scopes are created explicitly** (`PUT /-/scope/:scope`, or `brika scope create`),
JSR-style: a name is `@` + 2-20 lowercase letters/digits/hyphens (no leading hyphen),
globally unique, and owned by whoever creates it. Publishing never claims a scope
implicitly: the ownership gate rejects an unknown scope ("create it first") and
requires an exact `(provider, ownerId)` match otherwise, so there is no
first-publish claim to race and no way to land a package under a scope you do not
own. Creation is idempotent and race-safe (insert-then-reread).

**Scopes have members and roles** (JSR-style). `reg_scope_members` holds each scope's
members as provider-qualified identities with a role: `member` (may publish) or `admin`
(also manages members + the display name). The creator is seeded as the first admin, a
scope always keeps at least one admin, and **publish authorization is membership** (not
the single `reg_scopes` owner, which remains the public verified-publisher attribution).
Member management lives under `PUT`/`DELETE /-/scope/:scope/member/:provider/:id` and
`GET /-/scope/:scope/members`, all admin-gated except the member-only listing.

**Identity is provider-qualified.** A `PublishIdentity` is `{ provider, owner, … }`
and scope ownership stores `(ownerProvider, ownerId)`, so the registry is not
GitHub-locked: OIDC verification is split into a provider-neutral `verifyOidc`
(signature + issuer + audience + time) plus a per-provider claim mapping, and a
publish token records its provider. Only GitHub is wired today (its OIDC issuer +
the device-flow OAuth); adding GitLab/Google is a new claim mapper + OAuth app, no
domain or schema change. The displayed **publisher** is the scope's verified owner
(`ownerProvider`/`ownerId`) plus an owner-set `displayName` (e.g. "Brika Labs"),
surfaced in the packument/catalog so the storefront trusts it over a manifest's
free-text `author`.

## store.brika.dev

TanStack Start SSR + `@brika/clay`. Serves the marketplace (browse, plugin
detail, developer profiles, dashboard) and the public **`/v1` contract** the hub
consumes (`@brika/registry-contract`). Social data (users, reviews, comments)
lives in D1; auth is GitHub OAuth (signed-cookie sessions). Discovery is
**federated**: `@brika` plugins come from the registry's data, community plugins
from npm (cache-aside), unified behind the `RegistrySource` abstraction.

## Data

- **D1** (`brika-store`): the store's social tables AND the registry's `reg_*`
  tables (one database, two domains).
- **R2**: immutable tarballs (registry) and mirrored icons/readmes (store).
- **KV**: hot npm-metadata cache for the store.

## Transactions (`@brika/tx`)

A publish touches two stores - R2 (the tarball) and D1 (the metadata). `@brika/tx`
coordinates them as one **unit of work**. It is a Spring-style synchronization
manager over `AsyncLocalStorage`, **not** a distributed (XA/2PC) transaction monitor:
there is no such thing across a blob store and a database. Be precise about what that
buys us.

- **`transaction(fn)`** opens a unit. On success it runs the registered commit
  actions, then the completion hooks; on a throw it runs the rollback compensations
  in reverse order, then the completion hooks, then rethrows. The active unit lives in
  async context, so nested calls and helpers find it without threading a handle.
- **Resources self-enlist** - the call site stays clean:
  - the **R2 tarball writer**'s `put` registers `onRollback(() => delete(key))`, so a
    staged object is removed if the unit fails;
  - the **D1 metadata writer** is overlaid with `transactionalDb`, and `commitVersion`
    hands its statements to `deferBatch`, which runs them as **one atomic D1 batch at
    the commit point** (after the reversible work is staged), or immediately when no
    unit is open.
- **Publish is the canonical unit**: stage the tarball (compensable) -> defer the
  metadata batch -> at commit the batch lands atomically; if it fails, the tarball is
  compensated. Order-independent, because the D1 write is deferred to the end.
- **Read-only units** (`readOnlyTransaction(fn)`, or `{ readOnly: true }` /
  `@transactional(required, { readOnly: true })`) mirror Spring's
  `@Transactional(readOnly = true)`, but **enforced, not a hint**: staging any write
  inside one (`onRollback`/`onCommit`/`deferBatch`) throws, while completion hooks
  still run. Wrapping a read path this way proves it is side-effect-free. (It does not
  route to D1 read replicas - that would be a separate Sessions-API concern.)

**Is it ACID?** Within D1, yes: a `batch()` is one atomic, isolated, durable D1
transaction (and unique constraints keep it consistent). **Across R2 + D1, no** - it
is a **saga**: all-or-nothing in the happy path and on body failures via compensation,
but not isolated (a reader can see an intermediate state) and not atomic if a
compensation itself fails (a failed R2 delete leaves an orphan tarball, logged). When
true atomicity is needed, keep it inside a single D1 `batch`.

**Guidelines.**

1. Wrap a flow that mutates **more than one resource** (or stages an external write
   before a DB write) in `transaction(() => …)`. A single-statement write is already
   atomic in D1 - it needs no unit.
2. Don't pass a transaction object around. Side-effecting adapters **self-enlist**
   via the ambient unit: a reversible external write registers `onRollback(undo)`; a
   multi-statement DB write goes through `transactionalDb`'s `deferBatch` so it lands
   atomically at the commit point.
3. Put post-commit side effects (notifications, cache busts, metrics) in
   `afterCommit(…)` so they fire only if the unit actually committed.
4. Wrap a flow that must only read in `readOnlyTransaction(…)` to assert it stages no
   writes; the unit throws if it tries.
5. Make compensations idempotent and cheap; a compensation that throws is logged, not
   retried, so it must not be load-bearing for correctness.

## Security properties

- **Integrity pinned**: SHA-512 in every packument, verified + locked by bun, so
  installed bytes cannot be changed after the fact, even by the operator.
- **Immutable versions**: a published `name@version` is never overwritten.
- **Ownership by GitHub repo control**: OIDC `repository`/`owner` must own the
  scope and match the package's linked repo to publish.
- **Data gate**: the `@brika/schema` verify-checks run server-side at publish.
- **No code injection via the store**: it only serves metadata; the registry
  serves code but with the integrity guarantee above.

## Hub integration

The hub adds `@brika:registry=https://registry.brika.dev` (install) and a
`RemoteRegistrySource` that federates discovery across the store's `/v1` and npm.
Consent-before-code, grants, and the lockfile model are unchanged.
