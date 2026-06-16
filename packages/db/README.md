# @brika/store-db

The shared Cloudflare D1 schema and Drizzle client for the Brika registry. Both
the registry worker and the store web app build their client through here, so the
`reg_*` tables are defined and typed in exactly one place.

## Usage

```ts
import { getDb, regVersions } from "@brika/store-db";
import { eq } from "drizzle-orm";

const db = getDb(env.DB); // a Drizzle client typed to the reg_* tables
const rows = await db.select().from(regVersions).where(eq(regVersions.name, "@brika/clay"));
```

- `getDb(d1)`: a typed client over this package's schema (the common case).
- `createClient(d1, schema)`: the same, but with a caller-supplied schema, for an
  app that extends the table set.
- `schema` (namespace) and the individual tables: `regPackages`, `regVersions`,
  `regDistTags`, `regScopes`, `regTokens`, `regDeviceAuth`, `regDownloads`,
  `regAudit`.
- `Db`: the client type, the port other packages accept.

## Why one client factory

The D1 Drizzle driver is imported in a single file ([client.ts](src/client.ts)).
Moving off D1 later (for example to Postgres via `drizzle-orm/node-postgres`) is a
one-file change rather than a repo-wide sweep.

## Migrations

SQL migrations live in `drizzle/` and are generated from the schema:

```sh
bun run db:generate   # drizzle-kit generate after editing the schema
```

The web app applies them with `wrangler d1 migrations apply` (see its README).
