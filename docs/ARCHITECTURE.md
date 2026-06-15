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
