# Deploying the Brika platform

Two Cloudflare Workers: the **store** (`apps/web`) and the **registry**
(`apps/registry`). They share one D1 database. These steps need a Cloudflare
account and a GitHub OAuth app, so they are done by the operator, not in CI.

## Continuous deployment (Cloudflare Workers Builds)

Cloudflare auto-deploys each worker when `main` changes. Two settings make migrations run
automatically as part of that deploy (without them, code can ship ahead of its schema — the
drift that caused the earlier outage):

1. **Deploy command = `bun run deploy`** (per worker, in its Workers Builds settings) — NOT a
   bare `wrangler deploy`. The `deploy` script runs `db:migrate` (tracked `wrangler d1
   migrations apply --remote`, idempotent) and only then `wrangler deploy`. So a pending
   migration is applied before the new code goes live; if it fails, the deploy aborts and the
   old code keeps serving (a loud failure, never silent drift).
2. **`CLOUDFLARE_API_TOKEN` build secret with D1:Edit** (+ Workers Scripts:Edit) — the
   auto-generated Workers Builds token has Workers/KV/R2/Routes but **not** D1, so the migrate
   step would fail auth without a custom token set as a build variable.

For a DESTRUCTIVE schema change, use the expand/contract split (ship an additive migration +
deploy, then a later contractive migration) so the other worker on the shared D1 never reads a
dropped column mid-deploy.

# Store (store.brika.dev)

TanStack Start SSR + the `/v1` API, one Worker.

## 1. Provision Cloudflare resources

Enable R2 once per account first (Dashboard -> R2 -> Enable), otherwise
`r2 bucket create` fails with `Please enable R2 [code: 10042]`.

```sh
wrangler login
wrangler d1 create brika-store          # -> copy database_id into wrangler.jsonc
wrangler kv namespace create CACHE       # -> copy id into wrangler.jsonc
wrangler r2 bucket create brika-store-assets
```

Replace the `REPLACE_WITH_*` placeholders in `apps/web/wrangler.jsonc` with the
returned `database_id` and KV `id`. The `wrangler d1 create` / `kv namespace
create` prompts can also append the binding for you; if you accept, remove the
duplicate so each binding name (`DB`, `CACHE`) appears once.

## 2. Apply the database schema

```sh
cd apps/web
bun run db:generate         # already committed; only needed after schema changes
bun run db:migrate          # applies migrations to the REMOTE D1
```

## 3. Create the GitHub OAuth app

At <https://github.com/settings/developers> create an OAuth app:

- Homepage URL: `https://store.brika.dev`
- Authorization callback URL: `https://store.brika.dev/auth/github/callback`

Copy the Client ID and generate a Client secret.

## 4. Set secrets

```sh
cd apps/web
wrangler secret put SESSION_SECRET        # a long random string
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_REDIRECT_URI   # https://store.brika.dev/auth/github/callback
```

For local development these live in `apps/web/.dev.vars` (gitignored).

## 5. Deploy

```sh
bun run deploy              # db:migrate (REMOTE) && vite build && wrangler deploy
```

`deploy` applies any pending D1 migrations BEFORE shipping the code, so the schema can
never lag the worker (the cause of the earlier drift outage). It's idempotent - already-
applied migrations are tracked in `d1_migrations` and skipped. If the migration step fails,
the deploy aborts and the old (working) code keeps serving. Configure Cloudflare Workers
Builds to run `bun run deploy` (not a bare `wrangler deploy`) so auto-deploys migrate too.

Attach the custom domain `store.brika.dev` to this Worker (declared as a route in
`apps/web/wrangler.jsonc`). The registry is a separate Worker (below).

## 6. Point a Brika hub at the store

In the hub's environment:

```sh
export BRIKA_STORE_URL=https://store.brika.dev
```

The hub's `RemoteRegistrySource` then discovers plugins through the store's `/v1`
contract instead of querying npm directly. Installation still pulls the actual
code from npm with the lockfile integrity hash, so the store never serves code.
Unset the variable to fall back to direct-npm discovery. Any `/v1`-conforming URL
works here, which is how a third party can run their own store.

## Not yet wired (follow-ups)

- `GET /v1/verified` returns an empty list until the Ed25519 curation key is
  provisioned and a signed list is produced.
- A cron `scheduled()` worker entry to pre-warm the D1 cache from npm. Today the
  cache fills lazily (cache-aside) when plugins are viewed or reviewed.

# Registry (registry.brika.dev)

A separate Worker (`apps/registry`) that hosts the official `@brika` plugins,
npm-compatibly. It shares the store's D1 database (`brika-store`).

## 1. Provision

```sh
wrangler r2 bucket create brika-registry-tarballs
```

The D1 is shared with the store, so put the store's `database_id` into
`apps/registry/wrangler.jsonc` (no new database).

## 2. Apply the registry schema

The `reg_*` tables live in `packages/db` (the registry's `migrations_dir`). Apply them with
tracked migrations - NOT a raw `d1 execute` loop, which writes schema without recording it in
`d1_migrations` and was the cause of the earlier drift outage:

```sh
cd apps/registry
bun run db:migrate          # wrangler d1 migrations apply brika-store --remote (idempotent)
```

## 3. Deploy + attach the domain

```sh
bun run --filter @brika/registry deploy   # runs db:migrate, then wrangler deploy
```

Attach `registry.brika.dev` to this Worker. Because `deploy` migrates first, schema and code
ship together; for a DESTRUCTIVE migration use the expand/contract split (additive migration +
deploy, then a later contractive migration) so the other worker on the shared D1 never reads a
dropped column mid-deploy.

## 4. GitHub OIDC trusted publishing

The publish endpoint accepts a GitHub Actions OIDC token whose audience is
`brika-registry`; the `brika-publish` workflow requests one with `id-token:
write`. No registry secret is needed for OIDC, tokens are verified against
GitHub's public JWKS. (Local `brika publish` uses a device-flow token instead.)

## 5. Seed existing @brika plugins (migration)

Import current npm versions so installs keep working; dual-host (publish to both)
during the transition, and do not unpublish from npm.

```sh
cd apps/registry
bun run scripts/seed.ts @brika/plugin-weather @brika/plugin-timer   # ...all @brika
wrangler d1 execute brika-store --remote --file .seed/seed.sql
bun -e 'for (const p of await Bun.file(".seed/puts.json").json()) Bun.spawnSync(["wrangler","r2","object","put",`brika-registry-tarballs/${p.key}`,"--file",p.file,"--remote"])'
```

## 6. Point a Brika hub at the registry

```sh
# install @brika/* from us, everything else from npm:
echo "@brika:registry=https://registry.brika.dev" >> .npmrc
```

`bun add @brika/plugin-x` then resolves from the registry with integrity verified
and pinned. This is independent of the store's `BRIKA_STORE_URL` (discovery).

## Notes

`registry.brika.dev` now serves the npm protocol. If old hubs still fetch
`/verified-plugins.json`, serve it from the store (or add a route on the
registry); the two services are otherwise independent.
