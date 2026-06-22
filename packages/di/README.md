# @brika/di

Angular-style **functional** dependency injection, with no decorators and no reflection. A small
typed primitive, not a container: `inject()`, hierarchical injectors, and lazy-memoized singletons,
in ~270 lines. No `reflect-metadata`, no string-keyed registry, negligible cold start.

Both apps (`apps/web`, `apps/registry`) and the domain/adapter packages use it. The **one right way**
to use it - the decision tree, the composition-root shape, and testing - lives in
[`docs/di.md`](../../docs/di.md). Treat that as the source of truth; this README is the API surface.

## Use a dependency

```ts
import { inject, injectOr } from "@brika/di";

class SocialService {
  readonly #reviews = inject(ReviewStore); // a field initializer, in any injection context
  readonly #clock = injectOr(Clock, systemClock); // optional, with an in-class default
}
```

Every injectable is a **constructor-less class** that field-injects its deps. A concrete class is its
own token and auto-builds (no registration); the container resolves the whole graph lazily.

## Declare a token

```ts
import { token } from "@brika/di";

// An interface port (the common case): a same-named type + value, always given a name for errors.
export interface Clock { now(): number }
export const Clock = token<Clock>("Clock");

// A providedIn:'root' token that self-builds from a factory (and may inject() inside it).
export const Audit = token("Audit", () => new D1AuditLog());
```

## Compose and run

A composition root is a plain `Provider[]`. `runInContext` runs a function inside a fresh injector
built from it; the framework glue calls this per request, so application code never touches
`createInjector`.

```ts
import { runInContext, provide } from "@brika/di";

runInContext(
  [
    { provide: RegistryDb, useValue: db },        // a ready value / runtime seam
    { provide: ScopeStore, useClass: D1ScopeStore }, // a port -> its field-injected adapter
    provide(BaseUrl, "https://registry.brika.dev"), // provide(token, value) shorthand
  ],
  () => inject(ScopeService).claim(identity, "@acme"),
);
```

| Provider | When |
| --- | --- |
| bare class | the class is its own token (auto-build) |
| `useClass` | bind a port token to its field-injected adapter |
| `useValue` | a ready value or runtime seam |
| `useFactory` | build lazily; may `inject()` inside (also aliases a token: `() => inject(Other)`) |

## Test with a `TestBed`

```ts
import { testBed, provide } from "@brika/di";

const bed = testBed(provide(ScopeStore, fakeScopes), provide(ScopeMembers, fakeMembers));
const service = bed.inject(ScopeService);
const capped = bed.with(provide(MaxScopesPerAccount, 2)).inject(ScopeService); // layered override
```

`testBed` is isolated per call (no global to reset) and `.with(...)` returns a new bed without
mutating the base. See [`docs/di.md`](../../docs/di.md) for `makeAdapter` (the D1-adapter analog).

## API

`inject` · `injectOr` · `token` · `provide` · `runInContext` · `runInInjectionContext` ·
`isInInjectionContext` · `createInjector` · `Injector` · `InjectionToken` · `testBed` / `TestBed`,
plus the `Provider` / `ProviderToken` / `Type` types.

## Tests

```sh
bun test   # inject + auto-provide, providers, hierarchy, context, errors, TestBed
```
