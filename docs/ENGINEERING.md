# Engineering and code-quality backlog

The code-health axis, complementary to the product milestones in
[`ROADMAP.md`](./ROADMAP.md). Legend: ✅ done and verified, 🟡 in progress,
⬜ todo, ⏸️ deferred (with reason).

## Done (this hardening pass)

- ✅ Composition root / DI: per-request `buildServices` (registry) + `serverContext`
  (store); handlers take a typed, inferred `Services`; no DI container (see
  [`CONVENTIONS.md`](./CONVENTIONS.md)).
- ✅ Portability seams: `BlobStore` over R2, typed Drizzle in place of raw D1, env
  funnelled to the composition roots; single `createClient` (the Postgres swap point).
- ✅ Boundary enforcement: `boundaries-pure.grit` allowlist (pure packages import
  only relative / `node:` / `bun:` / `zod`), inline via Biome.
- ✅ Dedup + bug fixes: shared `manifest-mapping`, fixed the divergent version sort,
  reconciled the developer profile, lifted device auth + audit behind ports.
- ✅ Decomposed the 1.7k-line plugin route into `components/file-browser`.
- ✅ Security tests: session sign/verify (timing-safe), `safeReturnPath`
  open-redirect guard, `parseCookies` (hardened against malformed encoding).
- ✅ `@unenforced` tracking (`bun run unenforced`).

## Tier 1: production-readiness

- ✅ **E1. Registry handler/integration tests.** `handlers.test.ts` runs the
  publish / deprecate / yank / catalog / downloads handlers end to end against an
  in-memory SQLite + fake R2, with a seeded registry token for auth.
  `buildServices(db, tarballs, baseUrl)` now takes its deps (env funnels to
  `index.ts`), which is what made this testable.
- 🟡 **E2. Enforce `REGISTRY_LIMITS`.** Done: `maxFileBytes` + `maxUnpackedBytes`
  enforced in the manifest gate (off the unpacked tarball), tested. Remaining: the
  count-based quotas (versions / packages / scopes / weekly) still `@unenforced` —
  each needs a usage-counting or rolling-window port on the metadata store.

## Tier 2: structure and DX for growth

- ✅ **E3. Client/server boundary plugin.** `boundaries-client.grit` denies
  server-only imports (env, db, auth, social, server-context, asset/device
  writers) in `components/**` + `use-*` hooks, wired in `biome.json`. Verified it
  fires; the codebase passes (no current leaks).
- ⏸️ **E4. `lib/` layout.** Deferred: E3 now *enforces* the server/client boundary
  (the real risk), so the folder reorg is cosmetic discoverability against ~20
  files' worth of import churn. Do it only if the flat `lib/` becomes a pain.

## Tier 3: polish / opt-in

- ⬜ **E5. `KeyValueCache` + `CACHE`.** Wire the provisioned KV binding into an
  npm-metadata cache-aside behind a port (clears an `@unenforced`).
- ⬜ **E6. `RegistryClient` seam.** One client over the `registry-source` fetch
  functions (timeout / retry / service-binding in one place).
- ✅ **E7. `V1_ROUTES`.** Removed (dead export, zero production consumers).
- ✅ **E8. `github.ts` OAuth-client tests.** `authorizeUrl` + `exchangeCode` +
  `fetchUser` covered (success / non-ok / malformed body), `fetch` stubbed.
- ⏸️ **E9. `exactOptionalPropertyTypes`.** Deferred: it adds type friction (every
  `foo?: T` stops accepting `T | undefined`), which fights the "simplest DX" goal
  and is a large churn against the optional-heavy contract. Revisit only if wanted.
- ⏸️ **E10. TS project references.** Deferred: premature at ~6 packages; revisit as
  the package count climbs (slow/incremental builds, attribution).
