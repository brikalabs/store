# @brika/registry

The Brika plugin registry, a Cloudflare Worker. It speaks the **npm protocol** so
a hub installs `@brika/*` plugins with a plain `bun add` (no client needed), and
adds an authenticated publish surface that uses **GitHub identity** instead of npm
accounts.

```
bun add @brika/<plugin>        # resolve + tarball, the npm protocol (public, read-only)
brika publish                  # publish via GitHub identity (see apps/cli)
```

## Architecture

Hexagonal. All domain logic (integrity, packuments, resolution, the publish
gates) lives in [`@brika/registry-core`](../../packages/registry-core) with **no
Cloudflare imports**; this worker is the HTTP + Cloudflare adapter layer.

- **Routing**: [`@brika/router`](../../packages/router), a typed Hono superset.
  Handlers live in feature controllers under [src/controllers/](src/controllers/),
  each declaring its routes next to its handlers.
- **Adapters** ([src/adapters/](src/adapters/)) implement the core's ports: D1 for
  metadata/ownership/tokens/audit, R2 for tarballs, GitHub JWKS for OIDC.
- **Composition root**: Cloudflare bindings are read in exactly one place (the
  per-request `context` factory in [src/index.ts](src/index.ts)), so every handler
  receives a typed `Services` graph, never the ambient env.
- **Env**: string config via [`@brika/env`](../../packages/env); validated once.

## Endpoints

| Surface | Routes |
| --- | --- |
| npm protocol (public) | packument + tarball for `@brika/*`, open CORS for GET |
| Catalog | `GET /-/v1/packages` (the storefront's list endpoint npm lacks) |
| Stats | download counts |
| Publish | `POST /-/publish` (GitHub-identity write, scope ownership, immutable versions) |
| Manage | deprecate / yank (ownership-gated) |
| Device flow | the `brika login` device-authorization endpoints |

## Atomic publish

A publish writes two systems with no shared transaction (a tarball to R2, metadata
to D1), so it runs inside one [`@brika/tx`](../../packages/tx) unit of work: the
R2 writer enlists a compensating delete, the D1 `commitVersion` is a single atomic
`batch()`, and a failed metadata commit rolls the staged tarball back. A publish is
all-or-nothing across R2 + D1. (`nodejs_compat` is enabled in
[wrangler.jsonc](wrangler.jsonc) so the engine's `AsyncLocalStorage` works on
workerd.)

## Develop

```sh
bun run dev          # wrangler dev, sharing the web app's local D1/R2 state
bun test             # handlers + adapters end to end on in-memory SQLite + a fake R2 bucket
bun run typecheck
bun run deploy       # wrangler deploy
```
