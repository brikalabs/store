# @brika/registry-runtime

The registry domain **wired for DI** - the Angular/Nest "feature library". `@brika/registry-core` is
pure (ports, no infrastructure) and `@brika/store-db` holds the Cloudflare D1 adapters; this package
is the seam that binds them, so both `apps/web` and `apps/registry` share one wiring instead of
copying it.

Every binding is a `{ provide: Port, useClass: D1Adapter }` line - the adapters field-inject their
own deps, so there is no `new` here. An app spreads `registryBindings` and provides the two runtime
inputs.

## Use it

```ts
import { registryBindings, RegistryDb, DomainSecret } from "@brika/registry-runtime";

const providers = [
  { provide: RegistryDb, useValue: getDb(env.DB) },         // the reg_* drizzle client
  { provide: DomainSecret, useValue: env.DOMAIN_VERIFY_SECRET },
  ...registryBindings, // ScopeStore/ScopeMembers/.../OwnershipPolicy/MetadataReader/VersionManager
];
// the whole graph self-resolves: ScopeService -> ScopeStore -> D1ScopeStore -> RegistryDb
```

## Exports

- **`registryBindings`** - the port -> D1 adapter bindings (scope store/members/domains, trusted
  publishers, DNS resolver, domain challenge, metadata reader/writer, ownership policy).
- **`RegistryDb`** / **`DomainSecret`** - the two runtime-input tokens an app provides (defined in
  `@brika/store-db` next to the type/adapter that consume them, re-exported here under these names).
- **Handler-facing read tokens** - `Audit`, `Tokens`, `Catalog`, `Packages`: `providedIn:'root'`
  tokens that self-build off `RegistryDb`, so a controller just `inject(Audit)`.

See [`docs/di.md`](../../docs/di.md) for the composition-root rules this package follows.
