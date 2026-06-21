# 3. Web app clean architecture: shared HTTP toolkit, store repositories, thin routes, functional DI

- Status: Accepted
- Date: 2026-06-21
- Deciders: maxscharwath

## Context and problem statement

`apps/registry` is hexagonal and clean: a programmatic `@brika/router`, thin controllers
(parse, call a service, serialize), a domain core (`@brika/registry-core`) with no framework
imports, and repository-style D1 adapters that are the only code touching the ORM. `apps/web`
had not reached that bar: a hand-rolled HTTP layer that duplicated the router's error/response
vocabulary, a ~470-line `lib/social/social.ts` grab-bag of raw drizzle, page routes up to 1241
lines with the component tree inlined, and three ad-hoc per-request factories
(`serverContext` / `registryServices` / `socialService`) called from inside handlers. ADR-0002
already asked for thin routes; nothing enforced it and the page routes had drifted far past it.

## Decision

Bring `apps/web` to the registry's quality, keep both apps on one shared vocabulary, and make
the result stay clean with enforced rules.

### Layers (apps/web)

```
@brika/router   shared HTTP toolkit (HttpError + helpers, json/reply/created, okOrThrow, parseBody)
@brika/di       functional DI (inject(), InjectionToken, hierarchical injectors)
apps/web/src/
  routes/       THIN: parse -> service/store -> serialize. <= 80 lines, exports only `Route`.
  server/
    stores/     repository layer (the only web code importing the ORM/schema): *Store classes.
    services/   business logic over stores (SocialService), free of cloudflare:workers.
    tokens.ts   the DI tokens for non-class bindings (ENV, DB, ASSETS, REG_DB, REGISTRY).
    injector.ts webInjector(): the per-request composition root.
    http.ts     runHandler (HttpError -> Response + injection context), authed/operatorAuthed.
  lib/<domain>/ read models + pure utils. components/<feature>/ all page UI.
```

### Conventions established

- **One HTTP toolkit.** Web route handlers read like registry controllers: `runHandler(() =>
  ...)` catches a thrown `HttpError`; bodies use `okOrThrow` / `parseBody` / `notFound` / ... and
  `reply` / `publicJson`. The web's old `console-api.ts` + `lib/http.ts` are gone; the shared
  primitives live in `@brika/router` (the registry's `okOrThrow` was promoted there).
- **Repositories (`*Store`).** Each store is a class with query methods and is the only place
  its table's SQL lives, like the registry's `D1*` adapters. A `SocialService` composes them and
  owns the cross-store orchestration (cache-aside, rating recompute). Routes/components never see
  SQL.
- **Thin routes.** A route file only wires a URL to the layers below.
- **Functional DI (`@brika/di`).** Angular-style `inject()`, no decorators, no reflection,
  backed by `AsyncLocalStorage` (so the injection context survives `await`s; the same mechanism
  `@brika/tx` already uses on workerd). A class is its own token and auto-resolves with zero
  registration; non-class bindings are `InjectionToken`s, many self-providing via a
  `providedIn: 'root'`-style default factory, so the composition root declares only what the
  framework hands in (the request `ENV`). Tests build an injector and override one token with a
  mock; the rest of the graph stays real.
- **The pure core stays pure.** `@brika/registry-core` may import only `zod` / `node:` / relative
  paths (the `boundaries-pure` biome plugin + archunit). Its services are NOT migrated to
  `inject()`; the apps provide them via `useFactory` (`{ provide: REGISTRY, useFactory: () =>
  registryServices(inject(REG_DB)) }`), so the apps get full `inject()` DX while the hexagon
  center keeps no framework dependency.

### Enforcement

- `scripts/check-thin-routes.ts` (in `bun run lint`): each `routes/**` file is <= 80 lines and
  exports only `Route`. Biome / archunit cannot express "<= N lines + single named export".
- `architecture/web.test.ts` (archunit): routes + components may not import `drizzle-orm` or
  `@/server/db/schema`; only `server/stores` (plus the BetterAuth adapter + db client) touch the
  social tables; store files are kebab-case with classes suffixed `Store`.

## Consequences

- Large but mechanical, landed phase by phase (HTTP toolkit, stores, thin routes, enforcement,
  DI), each independently green (typecheck, the full test suite, biome, and a dev boot).
- `apps/web` is fully on `@brika/di`: its own classes auto-wire; the only explicit providers are
  the pure-core services (via `useFactory`) and the request `ENV` seam.
- The registry's `buildServices` + `ctx` is already a clean, testable DI (a mock `Services`
  object). Migrating it onto `@brika/di` would also need a `@brika/router` <-> `@brika/di`
  integration (running handlers in an injection context) and, for the real "magic" win, making
  the shared `@brika/store-db` adapters field-inject (which ripples back into the web). That is a
  deliberate follow-up, not folded into this change, so the well-made reference app is not
  churned for marginal gain over its existing pattern.
