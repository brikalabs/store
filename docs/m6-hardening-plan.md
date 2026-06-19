# M6 hardening plan

Implementation plan for the four remaining M6 items in `docs/ROADMAP.md`:
**rate limits**, **abuse/takedown surfacing**, **malware-scan hook**, and
**R2 + D1 backups**. Done so far (kept for context): tarball-origin pinning,
asset path-traversal guard, scoped read-only CORS, ownership-gated management,
and the `reg_audit` log.

Everything here respects the registry's existing shape: domain logic and ports
in `@brika/registry-core`, Cloudflare adapters in `apps/registry/src/adapters`,
the one composition root in `apps/registry/src/services.ts`, thin controllers on
`@brika/router`. No controller reads the ambient env; bindings are read only in
the `context` factory in `index.ts`.

## Recommended order

1. **Rate limits** — highest-leverage abuse defense, fully self-contained, no new
   identity concepts. (small–medium)
2. **Malware-scan hook** — another small port slotted into the existing publish
   pipeline; lands the extension point even if the scanner is a no-op for now.
   (small)
3. **Abuse/takedown surfacing** — needs a new operator-admin identity, so it
   builds on the auth work and is best done once the cheaper wins are in. (medium)
4. **R2 + D1 backups** — operational, cron-driven, hardest to unit-test; last.
   (medium)

Each item is independently shippable as its own PR behind the existing CI gates
(typecheck + biome + sonar + tests).

---

## 1. Rate limits ✅ DONE

**Goal:** cap request rate on the abuse-prone POST endpoints so a single client
cannot flood publish or the device flow. Target routes:

- `POST /-/publish`
- `POST /-/device/code`
- ~~`POST /-/device/token`~~ — **deliberately not limited.** The CLI polls this
  every few seconds during a login (RFC 8628), so an IP rate limit would break
  legitimate device flows. Grant *creation* (`/code`) is the abuse-prone step and
  is limited; token polling is bounded by the flow's own `interval`.

The read surface (packuments, tarballs, catalog) stays open — it is the npm
protocol and is cache-frontable; rate limiting reads would break `bun add`.

**Shipped as a generic system in `@brika/router`** (design vetted by a Cloudflare
and an architecture specialist): a transport-agnostic `RateLimiter` port, a pure
per-isolate `FixedWindowRateLimiter` default, a `"30s"|"5m"|"1h"` duration parser,
and a `rateLimit(...)` middleware (built on the router's typed `Middleware<Ctx>`,
which runs after the per-request `ctx` is built). It takes the policy inline:

```ts
// device.ts — in-memory default + opt-in Cloudflare binding
rateLimit({ max: 10,  window: "1m", key: clientKey, store: cf("DEVICE_LIMITER") })
// publish.ts
rateLimit({ max: 100, window: "1m", key: principal, store: cf("PUBLISH_LIMITER") })
```

There is **no central rate-limit file** (the old `apps/registry/src/rate-limit.ts`
was deleted) and nothing threads through `buildServices`. The window is stated at
the route; the key strategy and backend are reusable values that live next to their
concern: `clientKey` + the `cf(name)` store factory in the Cloudflare adapter,
`principal` in `auth.ts` (next to `requireWrite`). The limiter is built **once** at
route-definition time, so the in-memory window persists across requests. Per the
Cloudflare specialist, the model is **in-memory default with the Workers binding as
opt-in** (`store: cf(...)`): the native binding is best-effort/per-colo and the
in-memory fallback is per-isolate, so both are abuse-blunting behind the edge WAF,
not exact counters; `cf()` resolves the `*_LIMITER` binding per call, else falls
back. Publish is keyed by the **authenticated principal** (repo/owner; `requireWrite`
is memoized per request so the key derivation and the handler share one auth) — CI
shares GitHub Actions egress IPs, so a per-IP cap would throttle unrelated repos.
Device-code is keyed by the **unspoofable `CF-Connecting-IP`** (never the
client-supplied `X-Forwarded-For`), with IPv6 collapsed to its /64. Tested in
`rate-limit.test.ts` (router: port + duration + middleware forms), `router.test.ts`
(the middleware mechanism), `cf-rate-limiter.test.ts` (keys + binding fallback), and
`device.test.ts` (mounted, end-to-end 429).

**Hardened in review (5-specialist pass):** `unsafe.bindings` schema fix
(deploy-breaker), principal-keyed publish (CI), CF-only IP + IPv6 /64 (spoof +
walk bypass), module-scoped fallback (no silent no-op). **Deferred follow-ups:**
the `brika` CLI should honor `429`/`Retry-After` on publish (today it hard-fails,
`apps/cli/src/lib/registry.ts`); the in-memory fallback's key map has no eviction
(prod uses the distributed binding, so low risk).

### Design (port + adapters, applied as middleware)

New port in `@brika/registry-core/src/ports.ts` (or a new `rate-limit.ts`), kept
framework-free:

```ts
export interface RateLimiter {
  /** Returns whether this key may proceed now, plus seconds to wait if not. */
  limit(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}
```

Adapters in `apps/registry/src/adapters`:

- **`CfRateLimiter`** wrapping Cloudflare's native rate-limit binding
  (`env.PUBLISH_LIMITER.limit({ key })`). One binding per logical limit so the
  windows are independent.
- **`InMemoryRateLimiter`** (fixed-window counter over an injected clock) for
  unit tests and local `wrangler dev` where the binding may be absent.

Keying:

- Publish/device-token: prefer the authenticated principal when present
  (token hash or OIDC `owner/repo`), else fall back to client IP
  (`CF-Connecting-IP`). Keying authenticated traffic by identity stops one
  noisy publisher from exhausting a shared-IP pool.
- Device-code (pre-auth): key by IP only.

Wiring:

- Add the limiter(s) to `buildServices` so handlers receive them on `ctx`.
- Apply as a small middleware in `apps/registry/src/index.ts` (or a thin wrapper
  in the affected controllers) that runs before the handler and returns **429**
  with a `Retry-After` header and a JSON `{ error, code: "rate_limited" }` body
  when `allowed` is false. Reuse `httpError(429, …)` from `@brika/router` if it
  supports custom headers; otherwise add a `tooManyRequests` helper there.
- Record a `rate_limited` row in `reg_audit` (sampled) so trips are observable.

### Config

`apps/registry/wrangler.jsonc` gains the rate-limit binding declarations, e.g.:

```jsonc
"ratelimits": [
  { "binding": "PUBLISH_LIMITER", "namespace_id": "1001",
    "simple": { "limit": 30, "period": 60 } },
  { "binding": "DEVICE_LIMITER", "namespace_id": "1002",
    "simple": { "limit": 10, "period": 60 } }
]
```

Exact limits to confirm during implementation; start conservative
(publish ~30/min/principal, device-code ~10/min/IP). Document them next to
`REGISTRY_LIMITS` so the numbers have one home.

### Tests

- `InMemoryRateLimiter`: allows under the limit, denies over it, resets after the
  window (deterministic via injected clock).
- Controller/integration: a burst past the limit returns 429 + `Retry-After`;
  authenticated calls are keyed by principal, not IP.

### Touch list

- `packages/registry-core/src/ports.ts` (+ index export)
- `apps/registry/src/adapters/cf-rate-limiter.ts`, `in-memory-rate-limiter.ts` (+ test)
- `apps/registry/src/services.ts`, `index.ts`
- `apps/registry/wrangler.jsonc`
- `@brika/router` if a 429 helper is needed

---

## 2. Malware-scan hook

**Goal:** a defined extension point in the publish pipeline where tarball bytes
are scanned before they are committed, so a real scanner can be dropped in later
without touching the orchestration. Ship it with a no-op (allow-all) default so
behavior is unchanged until a scanner exists.

### Design (port in the existing pipeline)

New port alongside `ManifestValidator` in `publish.ts`:

```ts
export interface TarballScanner {
  /** Inspect raw tarball bytes; reject to block the publish. */
  scan(tarball: Uint8Array): Promise<{ ok: true } | { ok: false; message: string }>;
}
```

Slot it into `PublishService.publish` as **step 3.5** — after the manifest gate
(step 3) and immutability check (step 4), before integrity/write (steps 5–6) —
so we never store bytes we would reject, and the existing "rejected publish
never touches storage" invariant holds. A failed scan returns
`{ ok: false, code: "invalid", message }` (or a new `"rejected"` code if we want
to distinguish it in `statusForPublishError`; 422/400).

The constructor takes the scanner as an optional dependency defaulting to an
allow-all `NoopScanner`, so existing `new PublishService(...)` call sites and
tests keep compiling. `buildServices` passes the concrete adapter.

Adapters in `apps/registry/src/adapters`:

- **`NoopTarballScanner`** (default; allow-all).
- Later: a `ClamAv`/external-service adapter, or a heuristic scanner over
  `readTarGzEntries` (suspicious paths, embedded binaries, install-script
  red flags). Out of scope for the hook PR — the point is the seam.

### Tests

- `PublishService` rejects when the scanner says no, and does **not** call
  `tarballs.put`/`meta.commitVersion` (storage untouched).
- A passing scan publishes as before (regression).
- The publish audit records `publish_rejected` with the scan message.

### Touch list

- `packages/registry-core/src/publish.ts` (port + pipeline step + index export)
- `apps/registry/src/adapters/noop-tarball-scanner.ts`
- `apps/registry/src/services.ts`
- `apps/registry/src/controllers/publish.ts` only if a new error code is added

---

## 3. Abuse/takedown surfacing

**Goal:** an **operator-initiated** removal (distinct from a publisher's yank)
that hides a version from installs *and* surfaces a public policy reason, plus an
audit trail. Yank is publisher-owned and reason-less; takedown is admin-owned and
explains itself.

### New concept needed: operator-admin identity

Today `requireWrite` resolves a *publisher* identity (OIDC repo owner or a
publish token), gated by scope ownership. Takedown must NOT be gated by scope
ownership (the operator is acting *against* the owner). So we add:

- An **admin allowlist**: an env var (e.g. `REGISTRY_ADMINS` = comma-separated
  GitHub logins) read via `vars()`, plus a `requireAdmin(req, db)` in `auth.ts`
  that resolves a publish token / OIDC identity and checks membership. Returns
  `403` for non-admins.

### Data model

Extend `reg_versions` rather than add a table (keeps the read path simple). Add:

- `takedown` (text, json, nullable): `{ reason, by, at }` when taken down, else
  null. Presence ⇒ removed-for-policy.

A migration adds the column (nullable, no backfill needed).

### Domain

Extend `ManagementService` (or a sibling `TakedownService`) with:

```ts
takedown(admin: AdminIdentity, name, version, reason): Promise<ManageResult>
restore(admin: AdminIdentity, name, version): Promise<ManageResult>
```

backed by a `setTakedown(name, version, info | null)` method on `VersionManager`
/ `MetadataWriter` and its D1 adapter.

### Surfacing

- **Resolve / packument** (`ResolveService` + `D1MetadataReader`): a taken-down
  version is omitted from the packument's `versions`/`dist-tags` exactly like a
  yank (so installs can't pick it), and the bytes are retained so pinned
  lockfiles still verify integrity. Optionally expose the reason on a detail
  endpoint the store reads, so the storefront can show "removed: <reason>".
- **Catalog** (`/-/v1/packages`): exclude or flag taken-down versions.
- **Audit**: `takedown` / `restore` rows with actor + reason.

### Endpoints

```
POST /-/package/:name/:version/takedown   body { reason: string }     (admin)
POST /-/package/:name/:version/restore                                 (admin)
```

Mirror `manage.ts`'s `runManaged` shape but call `requireAdmin` instead of
`requireWrite`.

### Tests

- Non-admin → 403; admin → 200 and the version drops out of the packument and
  catalog; bytes remain (tarball GET still 200, integrity unchanged).
- `restore` re-exposes it. Both audited.

### Touch list

- `apps/registry/src/env.ts` (`REGISTRY_ADMINS`), `auth.ts` (`requireAdmin`)
- `packages/db/src/schema.ts` + a migration (`takedown` column)
- `packages/registry-core/src/manage.ts` (+ ports), `resolve.ts`/`packument.ts`
- `apps/registry/src/adapters/d1-metadata*.ts`, `controllers/manage.ts` (+ catalog)

---

## 4. R2 + D1 backups

**Goal:** scheduled, restorable snapshots of registry state. R2 tarball bytes are
already immutable, but D1 metadata (packages, versions, dist-tags, scopes,
tokens, audit) is the irreplaceable part — losing it orphans every tarball.

### Design (cron-triggered export)

Add a `scheduled()` handler to the registry worker (`export default { fetch,
scheduled }`) plus a `triggers.crons` entry in `wrangler.jsonc` (e.g. daily).

- **D1 export:** read each `reg_*` table and write a timestamped JSON/NDJSON
  snapshot to a dedicated backup R2 bucket (`brika-registry-backups`), keyed
  `d1/YYYY-MM-DD/<table>.ndjson`. Keep it adapter-shaped: a `BackupSink` port
  (write a named object) + an R2 adapter, so the export logic is testable with an
  in-memory sink.
- **R2 manifest:** list the tarball bucket and write a manifest
  (key, size, etag/integrity) to `r2/YYYY-MM-DD/manifest.ndjson`. We don't copy
  bytes bucket-to-bucket on every run (cost); the manifest + immutability means
  bytes are recoverable/verifiable. A periodic full copy can come later.
- **Retention:** prune snapshots older than N days in the same run.
- **Restore:** a documented `scripts/restore.ts` (manual, operator-run) that
  reads a snapshot back into D1. Not automated.

### Why this is last / lighter on tests

The value is operational and the moving parts are bindings + cron, which unit
tests can only cover shallowly. Test the export *logic* against an in-memory
`BackupSink` (correct keys, all tables present, retention math); the cron
trigger and real R2/D1 I/O are verified manually on a deploy.

### Touch list

- `apps/registry/src/index.ts` (`scheduled` export), `wrangler.jsonc`
  (`triggers.crons`, backup R2 bucket binding)
- `apps/registry/src/backup.ts` + `BackupSink` port/adapter (+ tests)
- `scripts/restore.ts`, a short section in `DEPLOYMENT.md`

---

## Cross-cutting notes

- **Docs:** update `docs/ROADMAP.md` M6 line as each item lands; fold rate-limit
  numbers into the `REGISTRY_LIMITS` doc home.
- **Audit:** every new mutating/abuse action writes a `reg_audit` row, matching
  publish/deprecate/yank.
- **Operator tasks (🔑):** create the rate-limit namespaces, the
  `brika-registry-backups` bucket, set `REGISTRY_ADMINS`, and the cron trigger —
  add these to the operator checklist in `ROADMAP.md` / `DEPLOYMENT.md`.
