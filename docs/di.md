# Dependency injection (`@brika/di`): the one right way

Both apps (`apps/web`, `apps/registry`) and the domain/adapter packages use one DI primitive,
`@brika/di` - Angular's *functional* DI, with no decorators and no reflection. There is **one way to
use** a dependency and a short decision for **how to create** one. Use this as the single reference;
do not invent variants.

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

For an OPTIONAL dependency with an in-class default, use `injectOr`, never the `{ optional: true }`
+ `??` long form:

```ts
readonly #verifier = injectOr(ClaimVerifier, allowAllClaimVerifier); // bound impl, else the default
```

Never thread a `ctx` / `services` argument, never `new` a service by hand in a handler, never read
`env` in a handler.

## Field injection: every injectable is a constructor-less class

Services (`ScopeService`, `PublishService`, ...), stores (`ReviewStore`, ...), and adapters
(`D1ScopeStore`, `CfR2BlobStore`, ...) declare their dependencies as **field initializers** and have
**no constructor**. The container builds the class and the fields resolve from the active injector.

```ts
export class D1ScopeStore implements ScopeStore {
  readonly #db = inject(Db); // no constructor, no `new D1ScopeStore(db)` anywhere
}
```

This is why the composition root is a flat list of bindings with no `new X(dep)` wiring: the graph
self-resolves (`ScopeService` -> `ScopeStore` -> `D1ScopeStore` -> `Db`).

## Creating an injectable: pick the first case that fits

### 1. An app class that depends on other injectables -> just write it (auto-builds)

A concrete class is its own token. If it only depends on things it can `inject()`, it needs **no
registration** - asking for it builds it, once per request. This is the default and the common case
(every store and domain service).

```ts
// apps/web/src/server/stores/review-store.ts
export class ReviewStore {
  readonly #db = inject(Database);
  listForPlugin(name: string) { /* ...drizzle... */ }
}
// use it:  inject(ReviewStore)
```

### 2. An interface port (to swap implementations, and for tests) -> `token<T>("Name")`

A TypeScript interface has no runtime identity, so give it one with `token<T>("Name")`, declared
under the SAME name (TypeScript merges a type and a value). **Always pass the name** - it is the
token's label in a missing-provider error.

```ts
export interface ScopeStore { get(scope: string): Promise<ScopeRecord | null>; /* ... */ }
export const ScopeStore = token<ScopeStore>("ScopeStore"); // inject(ScopeStore) is typed ScopeStore
```

Bind the implementation once in the composition root (case 3); a test binds a fake.

### 3. A value, a runtime seam, or a port's adapter -> bind it in the composition root

Cloudflare bindings, a config string, and the concrete `D1*` / `R2*` / `Hmac*` adapter for a port
cannot auto-build (a token has no class; an adapter must map to its port). Bind them:

- **`useClass`** maps a port token to its field-injected adapter (the canonical port -> adapter wiring):
  ```ts
  { provide: ScopeStore, useClass: D1ScopeStore }
  ```
- **`useValue`** binds a ready value - the runtime seams (the db handle, a bucket, a secret):
  ```ts
  { provide: RegistryDb, useValue: db }
  { provide: TarballBucket, useValue: tarballs }
  ```
- **`useFactory`** builds lazily and may `inject()` inside (also how you alias one token to another,
  `useFactory: () => inject(Other)`):
  ```ts
  { provide: AssetsPublicUrl, useFactory: () => config().ASSETS_PUBLIC_URL }
  ```

A `providedIn: 'root'` token self-builds with no binding - pass a factory to `token`:

```ts
export const Audit = token("Audit", () => new D1AuditLog()); // handler `inject(Audit)`, no binding needed
```

## The composition root: a `providers` array (Angular's shape)

The ONE place runtime values enter is a providers array handed to `runInContext`. There is no
`createInjector` in app code. The registry domain's port -> adapter bindings are shared by both apps
as `registryBindings` (in `@brika/registry-runtime`); an app spreads them and adds its own seams.

`apps/web` (`webProviders`, one isolate-lived injector): declares the seams; stores/services auto-build:

```ts
const webProviders: Provider[] = [
  { provide: Database, useFactory: () => getDb(env.DB) },
  { provide: AssetsBucket, useFactory: () => env.ASSETS },
  { provide: AssetsPublicUrl, useFactory: () => config().ASSETS_PUBLIC_URL },
  { provide: BlobStore, useClass: CfR2BlobStore },
  { provide: RegistryDb, useFactory: () => getRegistryDb(env.DB) },
  { provide: DomainSecret, useFactory: () => config().DOMAIN_VERIFY_SECRET },
  ...registryBindings, // ScopeService/ManagementService ports -> D1 adapters
];
```

`apps/registry` (`provideRegistry(config)`, a fresh injector per request - its bindings are
request-scoped): the seams plus the registry's own service ports:

```ts
runInContext(
  provideRegistry({ db: getDb(env.DB), tarballs: env.TARBALLS, baseUrl, admins, domainSecret }),
  handler,
);
```

The framework glue runs every request inside that context: the web's `runHandler` /
`runInInjectionContext(appInjector, ...)` and the registry router's `mount({ around })` ->
`runInContext`. A handler just `inject()`s.

## Testing: a `testBed`, or `makeAdapter` for a D1 adapter

`testBed(provide(...))` builds an isolated injector, configures a service's ports, and injects it -
the `@brika/di` analog of Angular's `TestBed`. `.with(...)` layers an extra override without
mutating a shared base bed.

```ts
const bed = testBed(provide(ScopeStore, scopes), provide(ScopeMembers, members));
const service = bed.inject(ScopeService);
const capped = bed.with(provide(MaxScopesPerAccount, 2)).inject(ScopeService); // one extra override
```

A D1 adapter (which field-injects `Db`) is built with `makeAdapter` - the test analog of the
composition root:

```ts
const store = makeAdapter(db, D1ScopeStore); // testBed(provide(Db, db)).inject(D1ScopeStore)
```

To fake one seam inside a request handler test, append a later provider (the latest wins):

```ts
runInContext([...provideRegistry({ db, tarballs: fakeR2(), baseUrl }), provide(PublishConfig, { maxTarballBytes: 1 })], handler);
```

## The pure core depends on `@brika/di` (and only that, plus zod)

`@brika/registry-core` is field-injected: its services `inject()` their ports, so it imports
`@brika/di` - the runtime-agnostic, zero-infrastructure DI seam, allowlisted by
`biome-plugins/boundaries-pure.grit` on par with `zod`. The core still imports **no** Cloudflare, DB
driver, ORM, or HTTP framework: ports stay interfaces, adapters live in `@brika/store-db` and the
apps. `@brika/di` is not a "container" - it is a small typed primitive (functional `inject()`,
hierarchical lazy-memoized injectors, no decorators / `reflect-metadata` / string registry).

## What NOT to do

- No constructors on injectables (services, stores, adapters) - field injection only.
- No `new SomeService(...)` / `new D1X(...)` / `new R2X(...)` outside a composition root or a test
  helper (`testBed` / `makeAdapter`).
- No `inject(X, { optional: true }) ?? d` - use `injectOr(X, d)`.
- No unnamed `token<T>()` - always `token<T>("Name")`.
- No `@Injectable` markers, decorators, or `reflect-metadata`.
- No `createInjector` / `runInInjectionContext` in application code - the framework glue does it.
- No reading `cloudflare:workers` `env` outside the composition root.
- No threading a `ctx` / `services` object through handlers: the providers array IS the composition.
