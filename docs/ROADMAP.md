# Roadmap and remaining work

Status of the platform and the precise next steps. Legend: ✅ done and verified,
🟡 in progress, ⬜ todo, 🔑 needs operator accounts (Cloudflare / GitHub).

## At a glance

| Area | Status |
| --- | --- |
| Store: SSR pages (home, browse, plugin detail, developer profile) | ✅ |
| Store: `/v1` discovery contract (search, plugin, versions, readme, icon, verified) | ✅ |
| Store: social (GitHub OAuth, reviews, comments, helpful/upvote grading) | ✅ |
| Store: media (icon, localized readme/changelog, screenshots via jsDelivr) | ✅ |
| Store: developer console (profile, your packages, publish setup) | ✅ |
| Store: marketplace redesign (ember accent, Cmd+K, multi-column) | 🟡 |
| Store: Playwright e2e (browse, detail, localization, assets) | ✅ |
| Registry M1: npm-compatible resolve (`bun add` works) | ✅ proven |
| Registry M2: publish domain core (OIDC verify + gates) | ✅ |
| Registry M2: `/-/publish` + device-flow endpoints (proven round-trip) | ✅ |
| Registry: Hono routing, tests, deploy doc | ✅ |
| Registry: deprecate + yank management (endpoints + `brika` CLI) | ✅ |
| Registry: `/-/v1/packages` catalog + CORS for cross-origin reads | ✅ |
| Registry M3: hub scoped-registry install | ⬜ |
| Registry M4: store reads registry data for `@brika` (catalog, packument, tarball assets, localized copy) | ✅ proven |
| brika CLI: `auth login` / `publish` / `install` (brika repo) | ⬜ |
| `@brika/schema`: per-locale metadata format + publish-gate validation | ✅ |
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
- ✅ **M2 endpoints**: `POST /-/publish` (OIDC or registry token -> `PublishIdentity`
  -> D1 `OwnershipPolicy` + `@brika/schema` `ManifestValidator` -> `PublishService`
  -> R2/D1 writers), `/-/device/code` + `/-/device/token` (RFC 8628), audited via
  `reg_audit`. `REGISTRY_URL` pins the packument's tarball origin (no `Host`
  trust). Proven round-trip with the example plugins.
- ✅ **Management**: `ManagementService` (deprecate + yank, ownership-gated,
  reversible) behind `POST /-/package/:name/:version/{deprecate,yank}` and the
  `brika deprecate` / `brika yank` CLI commands. Yank hides a version from new
  installs (packument + catalog) while keeping the bytes; deprecate surfaces a
  warning. Audited.
- ⬜ **M3 hub install**: ship the `@brika:registry` scoped-registry config; verify
  an end-to-end install of an `@brika` plugin into a hub from the registry.
- ✅ **M4 store integration**: the storefront reads `@brika/*` from the registry,
  not npm. A `/-/v1/packages` catalog (npm has no list endpoint) + the
  npm-compatible packument feed the listing/detail; tarball-bundled assets (icon,
  screenshots, readme, localized `store.json`) are extracted and served by the
  store (`/v1/plugins/:name/asset`, R2-cached) so registry plugins render with
  localized copy. Proven end to end with Playwright.
- ⬜ **M5 community scopes** (later): let community claim scopes and publish to
  the registry; until then community stays on npm.
- 🟡 **M6 hardening**: done so far - tarball-origin pinning, asset path-traversal
  guard, scoped read-only CORS, ownership-gated management, audit log, and
  **rate limits** on the abuse-prone mutating endpoints (`POST /-/publish` by
  principal, `POST /-/device/code` by IP) via a generic `@brika/router`
  rate-limiting system (`RateLimiter` port + pure `FixedWindowRateLimiter` +
  `rateLimit` middleware) with a Cloudflare-binding adapter in the registry, and
  **operator takedown/restore** (`REGISTRY_ADMINS` + `requireAdmin`; hides a version
  from installs like a yank but admin-gated with a public reason surfaced in the
  packument). Remaining: malware-scan hook, R2 + D1 backups.
  Plan: [`m6-hardening-plan.md`](./m6-hardening-plan.md).

## Brika repo (separate)

- ⬜ **CLI** (`@brika/sdk` lean bin): `brika auth login` (device flow +
  SecretStore keychain), `brika auth logout`, `brika publish` (build the tarball,
  auto-detect CI/OIDC vs keychain token, upload), `brika install` (write the
  scoped-registry config).
- ✅ **`@brika/schema`**: per-locale store metadata (assets in `package.json`:
  `icon` required, `screenshots` optional as `{ src, caption?, alt? }[]`;
  localized text in `locales/<lang>/store.json`: `title`, `description`,
  `screenshotCaptions?`). Required at publish: icon + title + description. Both
  `brika publish`/`pack` and the registry's `/-/publish` gate validate every
  bundled locale file against `StoreLocaleSchema` (the gate untars via
  `readTarGzEntries`). Serving localized copy to the storefront is M4.
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
