# @brika/store-web

The Brika store: the public storefront **and** the registry's `/v1` API, one
[TanStack Start](https://tanstack.com/start) app on Cloudflare Workers. The
storefront browses and reviews plugins; the `/v1` routes implement the
[`@brika/registry-contract`](../../packages/contract) (search, plugins, versions,
readme/icon, profiles, reviews, comments, the verified list).

It also hosts the human side of the publish flow: `brika login` shows a code, and
the `/device` page is where a signed-in GitHub user approves it.

## Stack

- **TanStack Start** + React 19, server functions and API routes colocated under
  [src/routes/](src/routes/) (`v1.*.ts` are the contract endpoints; `.tsx` are
  pages).
- **Cloudflare Workers** via `@cloudflare/vite-plugin`; D1 for data through
  [`@brika/store-db`](../../packages/db).
- **Clay** (`@brika/clay`) for UI, Tailwind v4 for styling.
- Auth: GitHub OAuth (sign-in) plus the registry device-approval handoff.

## Develop

```sh
bun run dev                 # vite dev (storefront + API on one origin)
bun run typecheck
bun run e2e                 # playwright; bun run e2e:seed to seed fixtures first
bun run build               # vite build
bun run deploy              # build + wrangler deploy
```

## Database

D1 schema and migrations are owned by [`@brika/store-db`](../../packages/db);
this app applies them:

```sh
bun run db:generate         # generate a migration after a schema change
bun run db:migrate:local    # apply to the local D1 (wrangler --local)
bun run db:migrate          # apply to the deployed D1 (--remote)
```

## Relationship to @brika/registry

[`@brika/registry`](../registry) is the standalone npm-protocol worker (resolve +
publish). This app is the storefront and the social/`/v1` API; in local dev they
share one D1/R2 state directory so the two run together.
