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

## registry.brika.dev

npm-compatible. The hub points `@brika:registry` at it; `bun add` is unchanged.

**Resolve** (`GET /@scope/name`, `GET /@scope/name/-/*.tgz`):
1. normalize the path (`%2F` and `/` forms), derive the base URL from the request
   host so tarball URLs are self-referential on localhost and prod;
2. `ResolveService.packument` reads versions/dist-tags from D1 and builds the npm
   packument (hides yanked, surfaces deprecated, points `dist.tarball` at us with
   the SHA-512 `dist.integrity`);
3. tarballs stream from R2 with a 1-year `immutable` cache.

**Publish** (`POST /-/publish`, in progress): verify GitHub OIDC (or a session
token) -> build a `PublishIdentity` -> `PublishService` runs the ownership gate,
the `@brika/schema` data gate, the immutability check, computes integrity, and
writes the tarball then the version. A rejected publish never writes.

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
