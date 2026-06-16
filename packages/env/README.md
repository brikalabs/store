# @brika/env

Typed, validated, cached accessors for a Cloudflare Worker's **string** env
(secrets and plain vars). One place per app owns the shape, defaults, and
validation of its config, so a missing or malformed variable fails fast with a
message that says exactly what is wrong and where to set it, rather than surfacing
as `undefined` deep in a handler.

Bindings (D1, R2, KV) are runtime objects typed through each app's
`worker-env.d.ts`; this package is only for the string config alongside them.

## Usage

```ts
import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { z } from "zod";

export const vars = defineEnv(
  {
    REGISTRY_URL: z.url().default("https://registry.brika.dev"),
    GITHUB_CLIENT_SECRET: z.string().min(1),
  },
  () => env, // a lazy getter, so the binding is read in request scope, not at import
);

// anywhere later:
vars().REGISTRY_URL;
```

Pass the field schemas directly (they are wrapped in `z.object` for you) and a
`read` getter. The returned function parses and caches on first call. On failure
it throws a single `EnvError` enumerating **every** missing or invalid variable at
once, with a reminder to set them in `.dev.vars` (local) or via
`wrangler secret put` (deployed).

## Why a getter, not the env object

`defineEnv` imports nothing from `cloudflare:workers`, so the caller injects the
source via `read`. That keeps it unit-testable (pass a plain object in tests) and
defers touching the binding until first use, which on Workers must happen in
request scope rather than at module load.

## Tests

```sh
bun test   # parsing, defaults, caching, and the aggregated EnvError message
```
