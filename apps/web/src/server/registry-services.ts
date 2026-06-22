/**
 * The console's view of the registry domain: re-exported from the `@brika/registry-runtime` feature
 * library so handlers `inject(Audit)` / `inject(Metadata)` / `inject(Tokens)` / `inject(Packages)`
 * and the reg-DB stores `inject(RegistryDb)`. The library self-provides them; `injector.ts` supplies
 * `RegistryDb` (the shared D1) + `DomainSecret`. `ScopeService`/`ManagementService` are injected by
 * their `@brika/registry-core` class (aliased to the library in `injector.ts`).
 */
export { Audit, Metadata, Packages, RegistryDb, Tokens } from "@brika/registry-runtime";
