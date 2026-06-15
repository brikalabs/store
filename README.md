# Brika platform (store + registry)

A Bun-workspace monorepo for the two services behind the Brika plugin ecosystem:

- **store.brika.dev** , the marketplace: discovery, search, developer profiles,
  ratings, reviews, discussion, and a publisher console. SSR for SEO.
- **registry.brika.dev** , an npm-compatible package registry that hosts the
  official `@brika` plugins. Community plugins stay on npm; the store federates
  discovery across both. (Hybrid model, see [`docs/registry-design.md`](./docs/registry-design.md).)

## Why a registry of our own

A Brika hub installs plugins with `bun add`. Rather than publish a niche
home-automation ecosystem into npm's global namespace, official `@brika` plugins
are hosted on our **npm-compatible** registry: a hub adds one config line
(`@brika:registry=https://registry.brika.dev`) and `bun add @brika/plugin-x`
resolves from us, everything else from npm. No custom installer.

Hosting code does not weaken supply-chain safety: every tarball's SHA-512
**integrity** is returned in the packument and pinned by bun in the lockfile, and
a published `name@version` is **immutable**. So even the registry operator cannot
silently change installed bytes. Publishing is anchored on **GitHub repo control
via OIDC** (you can only publish from the repo you control, under a scope you own).

## Monorepo layout

| Package | Name | Role |
| --- | --- | --- |
| `packages/contract` | `@brika/registry-contract` | zod schemas for the `/v1` discovery contract the hub speaks |
| `packages/registry-core` | `@brika/registry-core` | pure domain core: integrity, packuments, resolve, publish, OIDC (no Cloudflare imports, fully unit-tested) |
| `packages/db` | `@brika/store-db` | shared Cloudflare D1 schema + client |
| `apps/web` | `@brika/store-web` | the marketplace (TanStack Start SSR on Workers, `@brika/clay` UI) |
| `apps/registry` | `@brika/registry` | the npm-compatible registry Worker (resolve; publish in progress) |

Architecture: hexagonal. The domain core depends only on storage **ports**;
Cloudflare D1/R2 **adapters** live in the apps; the HTTP layer is thin. See
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Status

M1 (registry resolve) is proven end to end: `bun add @brika/plugin-x` installs
from the registry with integrity verified. M2 (publish) has its domain core
(OIDC verification + the publish gates) built and tested; the HTTP endpoints and
CLI are next. Full status and the remaining work: [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Development

```sh
bun install
bun run typecheck            # all workspaces
bun run lint                 # biome
bun run sonar                # Sonar-style rules locally (Cognitive Complexity, ...)
bun run sonar:fix            # auto-fix the fixable Sonar issues
bun test packages            # unit tests (registry-core, ...)

bun run --filter @brika/store-web dev     # the marketplace (vite dev)
bun run --filter @brika/registry dev      # the registry (wrangler dev)
```

Seed the local registry and prove an install:

```sh
cd packages/db && bun run db:generate
cd ../../apps/registry
bunx wrangler d1 execute brika-store --local --file ../../packages/db/drizzle/0000_*.sql
bun run scripts/seed.ts @brika/plugin-weather
# apply .seed/seed.sql to D1 + .seed/tarballs to R2 (see docs/ROADMAP.md), then `wrangler dev`
```

## Deployment

Each app deploys to its own Cloudflare Worker. Provisioning (D1/KV/R2, custom
domains), secrets, and the GitHub OAuth app are documented in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) , the layered architecture and data flow
- [`docs/registry-design.md`](./docs/registry-design.md) , the full registry design + decisions
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) , milestones, status, and remaining work
- [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) , code conventions enforced by biome + tsconfig
- [`docs/quotas-and-limits.md`](./docs/quotas-and-limits.md) , registry quotas, size limits, and rate limits
- [`docs/legal/`](./docs/legal/README.md) , terms, acceptable use, privacy, and content licensing (draft)
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) , provisioning, secrets, and deploy
