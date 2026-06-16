# @brika/router

A thin, fully-typed superset over [Hono](https://hono.dev). It keeps Hono as the
runtime (CORS, middleware, `app.routes`) and adds the DX Hono leaves to you:
route params and bodies typed end to end, handlers grouped into controllers,
a throw-based HTTP error channel, and typed URL building. No route table, no code
generation; the types fall out of the route config.

## Why

A plain Hono handler reads `c.req.param("name")` (a `string | undefined` you cast)
and `await c.req.json()` (an `any` you validate by hand), and a typo in a path is
found at runtime. Here the path is a template literal, so its params are typed at
the call site; the body is a Zod schema, so the handler receives the parsed type;
and a wrong param name fails to compile.

## Defining routes

`createRouter<Context, Env>()` binds the handler context (your typed service
graph) and the Hono env once, and hands back `route`, `controller`, `mount`, and
introspection helpers:

```ts
import { createRouter, json } from "@brika/router";
import { z } from "zod";

const { route, controller, mount } = createRouter<Services, Env>();

export const plugins = controller({
  name: "plugins",
  prefix: "/v1/plugins",
  routes: [
    route.get({
      path: "/:name",
      handler: ({ params }) => json({ name: params.name }), // params.name: string
    }),
    route.post({
      path: "/publish",
      body: z.object({ name: z.string(), tarball: z.string() }),
      handler: ({ body, ctx }) => json({ ok: true }), // body is parsed; ctx is typed
    }),
  ],
});
```

Each route is an object (not a fluent chain), so it is a value you can name and
introspect. Handlers receive `{ params, body, req, ctx }`, all typed: `params`
from the path template, `body` from the Zod schema, `ctx` from the `createRouter`
type argument. Mount the controllers onto a Hono app:

```ts
mount(app, [plugins], { context: (c) => buildServices(c.env) });
```

## HTTP errors

Throw, do not assemble a `Response`. The error channel maps a thrown `HttpError`
to the right status, so guard clauses read top to bottom:

```ts
import { unauthorized, notFound, forbidden } from "@brika/router";

const user = await authenticate(req);
if (!user) throw unauthorized();
const pkg = await find(name);
if (!pkg) throw notFound("No such package");
```

Helpers: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, and
`httpError(status, message)` for the rest.

## Typed URLs

Build links from the same kind of pattern, with params checked against it:

```ts
import { link } from "@brika/router";
link("/v1/plugins/:name", { name: "weather" }); // -> "/v1/plugins/weather"
```

### npm preset (`@brika/router/npm`)

npm names are awkward in URLs: one segment when unscoped (`react`), two when
scoped (`@brika/clay`). The `PKG` pattern expresses both, and the helpers join
and encode them:

```ts
import { PKG, packageName, npmLink } from "@brika/router/npm";

r.get({ path: `/-/v1/downloads/${PKG}`, handler: ({ params }) => packageName(params) });
npmLink("/-/v1/downloads/:name", { name: "@brika/clay" }); // "/-/v1/downloads/@brika%2Fclay"
```

## Responses, logging, introspection

- Response helpers: `json`, `text`, `created`, `noContent`, `reply`.
- A structured JSON request logger (`jsonLogger`): method, route, status, timing,
  controller/handler, client IP, one line per request.
- Introspection (`routes`, `logRoutes`, `formatRoutes`) reads from Hono's own
  `app.routes`, so the printed table is the real mounted state, not a parallel
  registry that can drift.

## Tests

```sh
bun test   # pattern matching (optional + regex segments), typed params/body, errors, url building
```
