# Dependency injection (`@brika/di`): the one right way

Both apps (`apps/web`, `apps/registry`) use one DI primitive, `@brika/di` - Angular's *functional*
DI, with no decorators and no reflection. There is **one way to use** a dependency and a short
decision for **how to create** one. Use this as the single reference; do not invent variants.

## Using a dependency: `inject(Token)`

Always `inject(Token)`. It works in a field initializer, a constructor, or a request handler -
anywhere that runs inside an injection context, and every request already runs in one. It returns a
lazily-built, per-request singleton.

```ts
class SocialService {
  readonly #reviews = inject(ReviewStore); // field initializer
}

runHandler(() => inject(SocialService).listReviews(name, viewerId)); // handler
```

Never thread a `ctx` / `services` argument, never `new` a service by hand in a handler, never read
`env` in a handler.

## Creating an injectable: pick the first case that fits

### 1. An app class that depends on other injectables -> just write it (auto-builds)

A concrete class is its own token. If it only depends on things it can `inject()`, it needs **no
registration** - asking for it builds it, once per request. This is the default and the common case.

```ts
// apps/web/src/server/stores/review-store.ts
export class ReviewStore {
  readonly #db = inject(Database).orm;
  listForPlugin(name: string) { /* ...drizzle... */ }
}
// use it:  inject(ReviewStore)
```

### 2. An interface (to swap implementations, or for tests) -> `token<T>()`

A TypeScript interface has no runtime identity, so give it one with `token<T>()`, declared under the
SAME name (TypeScript merges a type and a value):

```ts
export interface Clock { now(): number }
export const Clock = token<Clock>(); // inject(Clock) is typed Clock
```

Bind an implementation once in the config (below); a test binds a fake. An abstract class works too
(`inject(BlobStore)` where `BlobStore` is an `abstract class`) and is preferred when the interface
already wants a base class.

### 3. A value, a function, or an external / pure class (can't use `inject()`) -> provide it

Cloudflare bindings, a config string, a `@brika/registry-core` service (pure, constructor-injected),
a `@brika/store-db` adapter - none of these can auto-build. Give them a token and bind them in the
config:

```ts
export const BaseUrl = token<string>();
// in the config:
{ provide: BaseUrl, useValue: "https://registry.brika.dev" }
{ provide: ScopeService, useFactory: () => new ScopeService(new D1ScopeStore(inject(Db)), /* ... */) }
```

A concrete class used as its own token (`provide: ScopeService`) keeps the call site
`inject(ScopeService)`. A persistence adapter is bound under its **port** token
(`provide: Tokens`, where `Tokens = token<TokenStore>()`) so handlers depend on the interface from
`@brika/registry-core`, never the concrete `D1*` class - which keeps the registry hexagonal.

## The composition root: a `providers` array (Angular's shape)

The ONE place runtime values enter is a providers array handed to `runInContext`. There is no
`createInjector` in app code.

`apps/web` declares only the seams; the stores and services auto-build:

```ts
export const webProviders: Provider[] = [
  { provide: Database, useFactory: () => new Database(getDb(env.DB)) },
  { provide: RegistryDatabase, useFactory: () => new RegistryDatabase(registryDb()) },
  { provide: BlobStore, useFactory: () => new CfR2BlobStore(env.ASSETS) },
];
```

`apps/registry` uses `provideRegistry(config)` - the seams plus the full service graph as providers:

```ts
runInContext(
  provideRegistry({ db: getDb(env.DB), tarballs: env.TARBALLS, baseUrl, admins, domainSecret }),
  handler,
);
```

The framework glue runs every request inside that context: the web's `runHandler` and the registry
router's `mount({ around })`. A handler just `inject()`s. `provideRegistry` builds the graph once
from its `config` - shared adapters (the registry's scope-membership / ownership) are locals reused
across the services - and binds each result under its token (`useValue`). No imperative `buildX()`
factory and no `useFactory` ceremony: the providers array is the whole composition.

## Testing: override one token

`runInContext` with the real providers plus a later provider for the token you want faked (the
latest provider for a token wins):

```ts
runInContext(
  [...provideRegistry({ db, tarballs: fakeR2(), baseUrl }), { provide: ScopeService, useValue: fakeScopes }],
  () => handler(),
);
```

Everything else stays real; you replace exactly one seam.

## What NOT to do

- No `@Injectable` markers (auto-build needs none), no decorators, no `reflect-metadata`.
- No `createInjector` / `runInInjectionContext` in application code - the framework glue does it.
- No reading `cloudflare:workers` `env` outside the composition root.
- No threading a `ctx` / `services` object through handlers, and no imperative `buildX()` factory:
  the providers array IS the composition.
```
