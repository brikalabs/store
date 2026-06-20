---
id: CONSOLE-014
title: "Local-dev registry schema setup (db:setup:local)"
status: done
area: console
group: console
test_mode: manual (operational script)
traceability:
  code:
    - apps/web/scripts/apply-registry-schema.ts
    - apps/web/package.json
  tests: []
---

## Description

In production the store and registry share one D1 holding both the store's social
tables and the registry `reg_*` tables. Locally, the store gets its own miniflare
D1 with only the store's migrations, so the `reg_*` tables the console reads/writes
(scopes, members, tokens, versions) are missing and authenticated console routes
fail. `bun run db:setup:local` applies `packages/db/drizzle` to the local D1
idempotently.

## Acceptance criteria

### CONSOLE-014-AC1 , db:setup:local applies the reg_* schema locally
```gherkin
Given a local dev D1 created by the dev server without the reg_* tables
When the developer runs bun run db:setup:local
Then the packages/db/drizzle migrations are applied to the local store D1
And the reg_* tables (scopes, members, tokens, versions) exist afterward
```

### CONSOLE-014-AC2 , The setup is idempotent
```gherkin
Given the local D1 already contains the reg_* schema
When the developer re-runs bun run db:setup:local
Then it no-ops (reports the schema is already present) and exits successfully
```

### CONSOLE-014-AC3 , Missing local D1 is reported clearly
```gherkin
Given no local D1 file exists yet
When the developer runs bun run db:setup:local
Then the script exits non-zero with a message to start the dev server once first
```
