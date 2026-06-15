# Roadmap and remaining work

Status of the platform and the precise next steps. Legend: ✅ done and verified,
🟡 in progress, ⬜ todo, 🔑 needs operator accounts (Cloudflare / GitHub).

## At a glance

| Area | Status |
| --- | --- |
| Store: SSR pages (home, browse, plugin detail, developer profile) | ✅ |
| Store: `/v1` discovery contract (search, plugin, versions, readme, icon, verified) | ✅ |
| Store: social (GitHub OAuth, reviews, comments, votes) | ✅ |
| Store: media (icon, localized readme/changelog, screenshots via jsDelivr) | ✅ |
| Store: developer console (profile, your packages, publish setup) | ✅ |
| Store: marketplace redesign (ember accent, Cmd+K, multi-column) | 🟡 |
| Registry M1: npm-compatible resolve (`bun add` works) | ✅ proven |
| Registry M2: publish domain core (OIDC verify + gates) | ✅ |
| Registry M2: `/-/publish` + device-flow endpoints (proven round-trip) | ✅ |
| Registry: Hono routing, tests, deploy doc | ✅ |
| Registry M3: hub scoped-registry install | ⬜ |
| Registry M4: store reads registry data for `@brika` | ⬜ |
| brika CLI: `auth login` / `publish` / `install` (brika repo) | ⬜ |
| `@brika/schema`: per-locale metadata format (brika repo) | ⬜ |
| Deploy + GitHub OAuth app + OIDC trusted publishing | 🔑 |

## Store (store.brika.dev)

Largely built. Remaining:

- 🟡 **Finish the redesign**: a marketplace direction (Spotlight vs Console) is
  pending a pick, then carry the chosen layout across browse / detail / profile /
  dashboard and remove the dev toggle.
- ⬜ **Console slices not yet built**: review responses + comment moderation,
  per-package settings (repo link, featured), scope claiming.
- ⬜ **npm sync cron + verified-list signing**: a scheduled refresh and the
  Ed25519 `/v1/verified` signing key (today the cache fills lazily; the verified
  list is empty).

## Registry (registry.brika.dev)

- ✅ **M1 resolve**: `@brika/registry-core` (resolve), `@brika/store-db` (`reg_*`),
  `apps/registry` (packument + tarball). Proven: `bun add @brika/plugin-weather`
  installs from the registry with the served tarball's SHA-512 matching the
  pinned integrity. Seed importer in `apps/registry/scripts/seed.ts`.
- ✅ **M2 publish domain core** (`registry-core`): `verifyGithubOidc` and
  `PublishService` (ownership gate -> data gate -> immutability -> integrity ->
  write), fully unit-tested.
- ⬜ **M2 endpoints** (next code step):
  - `POST /-/publish`: verify OIDC (or a session token) -> `PublishIdentity` ->
    a D1-backed `OwnershipPolicy` (scope + linked repo) + a `@brika/schema`
    `ManifestValidator` -> `PublishService` -> R2/D1 writers.
  - `/-/device/code` + `/-/device/token`: OAuth device flow issuing short-lived,
    scope-limited publish tokens (stored in the CLI's keychain).
  - `reg_scopes` / `reg_scope_members` / `reg_tokens` / `reg_audit` tables.
- ⬜ **M3 hub install**: ship the `@brika:registry` scoped-registry config; verify
  an end-to-end install of an `@brika` plugin into a hub from the registry.
- ⬜ **M4 store integration**: `@brika` plugin pages read registry data (no npm
  sync for those); show provenance; deprecate/yank in the console.
- ⬜ **M5 community scopes** (later): let community claim scopes and publish to
  the registry; until then community stays on npm.
- ⬜ **M6 hardening**: malware-scan hook, abuse/takedown, audit surfacing,
  R2 + D1 backups, rate limits.

## Brika repo (separate)

- ⬜ **CLI** (`@brika/sdk` lean bin): `brika auth login` (device flow +
  SecretStore keychain), `brika auth logout`, `brika publish` (build the tarball,
  auto-detect CI/OIDC vs keychain token, upload), `brika install` (write the
  scoped-registry config).
- ⬜ **`@brika/schema`**: add the per-locale store metadata (assets in
  `package.json`: `icon` required, `screenshots` optional; localized text in
  `locales/<lang>/store.json`: `title`, `description`). Required at publish: icon
  + title + description. The registry's `ManifestValidator` wraps these checks.
- ⬜ **Hub** (`apps/hub`): `RemoteRegistrySource` is already added (federation);
  add the `@brika:registry` install config.

## Operator tasks (🔑 cannot be automated)

1. Cloudflare: `wrangler d1 create brika-store`, `kv namespace create`,
   `r2 bucket create brika-store-assets` and `brika-registry-tarballs`; paste ids
   into the two `wrangler.jsonc`; attach custom domains `store.brika.dev` and
   `registry.brika.dev`.
2. GitHub OAuth app (store sign-in + device flow) -> `wrangler secret put`
   `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
3. GitHub OIDC: register the `brika-publish` workflow as a trusted publisher for
   the registry audience.
4. `bun run --filter @brika/store-web deploy` and
   `bun run --filter @brika/registry deploy`.

See [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the store; registry deploy mirrors it.

## Recommended next steps (in order)

1. **Registry `POST /-/publish`** + the `reg_scopes`/tokens tables + a D1
   `OwnershipPolicy`. This makes the registry able to accept a publish (the
   domain logic is already done and tested).
2. **`@brika/schema` metadata format** + the `ManifestValidator` adapter, so the
   data gate is real.
3. **brika CLI** `auth login` / `publish` / `install`, then a full
   publish -> resolve -> `bun add` round-trip against a deployed registry.
4. **Pick the store design direction** and finish the marketplace redesign.
5. **M4 store integration** and **M6 hardening**.
