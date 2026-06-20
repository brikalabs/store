# Brika Registry: design

Status: proposal (no build yet). Decision context: host official `@brika` plugins
on our own registry, keep community plugins on npm, federate discovery. Keep the
hub's `bun add` install path. Plan, then approve, then build.

## 1. Shape

A registry is two halves: an **immutable resolve/download** side and an
**authenticated publish** side. We split them deliberately:

- **Resolve/install = npm-compatible.** We serve the npm registry HTTP subset
  (`GET /@scope/name` packument, `GET /@scope/name/-/*.tgz` tarball). The hub
  configures a scoped registry (`@brika:registry=https://registry.brika.dev`),
  so `bun add @brika/plugin-x` resolves from us and everything else from npm.
  bun verifies the SHA-512 integrity and pins it in the lockfile. No hub
  installer changes.
- **Publish = our own OIDC flow.** A `brika-publish` GitHub Action gets a GitHub
  OIDC token (`id-token: write`) and posts the built tarball + manifest to our
  publish endpoint. The Worker verifies the OIDC JWT and the scope ownership,
  runs the SDK verify-checks server-side, then stores the tarball in R2 and the
  version in D1. We do NOT emulate npm's publish handshake (which is built for
  npmjs.com); owning the publish API gives us provenance and full control.

The model: our own registry + an npm-compat layer for install.

## 2. Why this preserves the safety property

Even though we now host the bytes, **bun pins each tarball's SHA-512 integrity in
the lockfile**, so the operator cannot silently swap installed code after the
fact. Combined with immutability (a published `name@version` is never
overwritten), the supply-chain guarantee is as strong as npm's. The threat model
becomes "trust the registry operator + the verified publisher," same as npm.

## 3. Components (all Cloudflare)

```
registry.brika.dev  =  Worker (Hono or TanStack server routes)
  GET  /@scope/name                packument (built from D1)
  GET  /@scope/name/-/*.tgz        tarball (stream from R2, edge-cached, immutable)
  PUT  /-/publish                  our publish API (GitHub OIDC verified)
  GET  /-/provenance/...           attestation view
        |
        R2   tarballs (immutable, free egress, long edge-cache)
        D1   packages / versions / scopes / ownership / audit
        KV   hot packument cache (optional)
```

The discovery/social store (`store.brika.dev`, already built) reads the SAME D1
for `@brika` plugins (no npm sync for those), and keeps npm-syncing community
plugins. The `RegistrySource` abstraction already federates both.

## 4. Data model (D1)

```
reg_packages    name PK, scope, description, latest_version, created_at, downloads
reg_versions    (name, version) PK, manifest(json), integrity (sha512),
                shasum (sha1), tarball_key (R2), size, provenance(json:
                repo/workflow/sha/actor), published_at, published_by,
                deprecated(nullable msg), yanked(bool)
reg_dist_tags   (name, tag) PK -> version
reg_scopes      scope PK, owner_user_id, github_owner, created_at
reg_scope_members (scope, user_id) PK, role
reg_tokens      token_hash PK, user_id, scopes(json), created_at, last_used   (optional, local publish)
reg_audit       id, action, package, version, actor, at, detail(json)
```

## 5. Publish flow (GitHub OIDC, tokenless)

1. `brika-publish` Action runs on a GitHub release: `bun install`, `brika check`,
   `brika build` (produces the tarball), then requests the GitHub OIDC token.
2. It POSTs to `/-/publish` with the tarball + manifest + the OIDC token.
3. The Worker:
   - Verifies the OIDC JWT (GitHub JWKS, `iss=token.actions.githubusercontent.com`,
     required `aud`, reads `repository`, `repository_owner`, `ref`).
   - Checks the package's scope is owned by / linked to that GitHub owner/repo.
   - Runs the SDK **verify-checks** server-side (same gate as the brika CLI):
     valid manifest, `engines.brika`, name matches scope, semver, size limits.
   - Enforces **immutability**: reject if `name@version` already exists.
   - Computes SHA-512 + SHA-1, stores the tarball in R2, writes the version +
     provenance + dist-tag to D1, appends an audit row.
4. Optional: a token-auth `PUT /@scope/name` npm-style endpoint for local
   `npm publish` (deferred; OIDC is primary).

## 6. Resolve / install flow

- `GET /@brika/plugin-x` builds the packument from `reg_versions`, with each
  version's `dist.tarball = https://registry.brika.dev/@brika/plugin-x/-/plugin-x-1.2.3.tgz`
  and `dist.integrity` (sha512). Cached in KV + edge.
- `GET /.../-/plugin-x-1.2.3.tgz` streams the immutable object from R2 with a
  long `cache-control` (edge-cached, free egress). bun verifies integrity.
- Hub config: `@brika:registry=https://registry.brika.dev` (bunfig/.npmrc).
  Community (npm) installs are unchanged. The existing `RemoteRegistrySource`
  already federates discovery across our registry + npm.

## 7. Security spec

- **Publish auth**: GitHub OIDC (verified JWT) primary; optional scoped hashed
  tokens for local publish.
- **Scope ownership**: a scope (`@brika`) is owned by a user/org and linked to a
  GitHub owner; members have publish roles; claimed via GitHub identity (reuses
  the verified-author model).
- **Immutability**: published bytes are never overwritten. `deprecate` warns but
  stays installable; `yank` hides from new installs but is still served for
  existing lockfiles; hard delete only for legal/security within a window.
- **Integrity**: SHA-512 `dist.integrity` (+ legacy SHA-1 shasum), verified by
  bun, pinned in the lockfile.
- **Provenance**: store the GitHub OIDC claims (repo/workflow/commit/actor);
  surface on the package page; optional sigstore/SLSA attestation later.
- **Validation at publish**: run the SDK verify-checks server-side, reject
  invalid plugins before they are ever stored.
- **Abuse**: report flow, admin yank, a malware-scan hook on publish
  (quarantine), audit log.
- **Edge**: Cloudflare rate limiting + WAF on `/-/publish`.

## 8. Migration (do not break existing installs)

The existing `@brika` plugins are on npm at `0.3.x`. Plan:

1. **Dual-host during transition**: keep publishing to npm AND mirror to our
   registry (import the current npm tarballs into R2 + D1, preserving integrity).
2. Point the hub's `@brika` scope at our registry; verify installs.
3. Once stable, new `@brika` versions publish to our registry only (still
   discoverable). **Do not unpublish from npm** (that breaks old lockfiles).

## 9. Milestones

- **M1 Registry core (resolve)**: D1 + R2; packument + tarball endpoints;
  seed-import the current `@brika` plugins. Goal: `bun add @brika/plugin-x`
  installs from `registry.brika.dev`.
- **M2 Publish (OIDC)**: `brika-publish` Action + `/-/publish` (OIDC verify +
  verify-checks + immutability + R2/D1 write); scope ownership for `@brika`.
- **M3 Hub integration**: scoped-registry config; end-to-end install from our
  registry; discovery federation (already built) confirmed.
- **M4 Store integration**: `@brika` package pages read registry data; show
  provenance; deprecate/yank in the dev console.
- **M5 Community scopes (later)**: let community claim scopes and publish to our
  registry; until then community stays on npm (the hybrid).
- **M6 Hardening**: malware scan, abuse/takedown, audit surfacing, backups,
  rate limits.

## 10. Cost

Infra is negligible: R2 storage cents/month with free egress, D1 + Workers on the
free tier for a long time (~$0-5/month). The real cost is the M1-M3 engineering
and the ongoing operations: availability (registry down = no `@brika` installs),
security response, and abuse/takedown. Mitigations: edge-cache immutable
tarballs, keep npm-compatible (never locked in), dual-host during migration.

## 11. Open questions

- Availability target for the publish path vs the (edge-cached) resolve path.
- Whether to also expose the npm-style token `PUT` publish for local publishing.
- Backup/retention policy for R2 + D1 (this is now source-of-truth data).
- When/whether community gets to publish to our registry (M5) vs staying on npm.

## 12. Addenda (decisions 2026-06-14)

### Plugin store metadata (localized, Apple/Google-style)

Canonical format lives in `@brika/schema` `PluginPackageSchema`, validated by
`brika check` and the publish gate.

- **Assets declared in package.json** (one source, the "one way"): `icon` (path,
  required), `screenshots` (ordered `{ src, caption?, alt? }[]`, optional).
- **Localized text in per-locale files** (reuse the existing `locales/<lang>/`
  dir): `locales/<lang>/store.json` = `{ title, description, screenshotCaptions? }`.
  Resolution: requested locale -> `en` -> first. Same rule as `LocalizedDoc`.
- `LocalizedString = string | { [locale]: string }` for any inline localized
  field; localized docs (`readme`/`changelog`) stay `string | { [locale]: path }`.
- **Required at publish**: `icon`, `title`, `description`. Screenshots OPTIONAL
  (headless plugins exist). Enforced by verify-checks at publish (reject).

### Ownership: "real maintainer" verification (GitHub repo control)

A publish of `@scope/name` is accepted only when ALL hold:
1. valid GitHub OIDC token (CI) or a keychain publish token mapped to a user (local);
2. the package's **scope** is owned by that GitHub owner (scope claimed by proving
   control of the GitHub user/org);
3. the publish originates from the package's **linked GitHub repo** (OIDC
   `repository` == linked repo). Local publish requires the user to be a scope member.
4. immutability still blocks overwriting an existing `name@version`.

Ownership anchors on **GitHub repo control**, not the fragile "same npm username"
heuristic. (Optional later: cross-check the npm `repository` for names that also
exist on npm, to stop cross-registry squatting.)

### Publish gate = data + identity

`/-/publish` runs BOTH: (a) manifest/data validation (verify-checks: required
localized metadata, valid manifest, size limits, immutability) and (b) ownership
verification (OIDC/token -> scope + linked repo). Either failing rejects.

### Publish auth (two secure paths, like npm)

- **Local `brika publish`**: OAuth **device authorization flow** (RFC 8628) via
  store.brika.dev's GitHub login -> a **short-lived, scope-limited publish token**
  stored in the **OS keychain** (Brika SecretStore). Command: `brika auth login`.
  No pasted secrets, no long-lived file tokens.
- **CI/CD**: **GitHub OIDC, tokenless**. `brika publish` auto-detects the CI/OIDC
  env and uses the OIDC token instead of the keychain token. Same code path, the
  registry verifies OIDC -> repo -> scope.
- **`brika install`**: writes the scoped-registry config so `bun add` resolves
  `@brika/*` from us, npm for the rest.

### CLI commands (brika repo, @brika/sdk lean bin)

`brika auth login` (device flow + keychain), `brika auth logout`,
`brika publish` (build tarball -> upload, auto OIDC-vs-token), `brika install`
(scoped-registry config). The registry/store gains device-flow endpoints
(`/-/device/code`, `/-/device/token`) and a publish-token issuance + verification
path alongside the OIDC verification.
