# HARDEN , Abuse, integrity & operational hardening (M6)

> The cross-cutting defenses that keep the registry safe to operate: rate limits on
> the abuse-prone POST endpoints (publish, device-code), tarball-origin pinning that
> refuses to trust a client `Host`, the asset path-traversal guard on the store, the
> scoped read-only CORS policy on the npm read surface, an append-only `reg_audit`
> trail for every mutating action, the operator-admin allowlist that gates takedown,
> the malware-scan seam in the publish pipeline, and the planned R2 + D1 backups. The
> behaviour of takedown/restore itself is specified in MANAGE; this domain specs the
> hardening aspects (rate limiting, audit, admin auth, the scan seam, backups).

Status legend and the code scheme live in [README](./README.md).

---

## HARDEN-001 , Publish rate limit, keyed by authenticated principal

- **Status:** [DONE]
- **Area:** Rate limiting / publish
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/publish.ts` (rateLimit middleware), `apps/registry/src/auth.ts` (principal key) - `packages/router/src/rate-limit.test.ts`

`POST /-/publish` is capped at 100 requests per minute, keyed by the authenticated
principal (the OIDC repository, else the publish-token owner). CI shares GitHub
Actions egress IPs, so a per-IP cap would throttle unrelated repos on the same
runner; keying by identity isolates publishers. Over the limit the request is
rejected before the handler runs.

**HARDEN-001-AC1** , A burst past the publish limit returns 429 with Retry-After
```gherkin
Given an authenticated publisher has made 100 POST /-/publish requests within one minute
When the same principal makes one more POST /-/publish request in that window
Then the response status is 429
And the response carries a Retry-After header with the seconds until the window resets
And the publish handler does not run (no tarball is staged and no version is committed)
```

**HARDEN-001-AC2** , The limit is keyed by principal, not by client IP
```gherkin
Given two different principals share one client IP (the same CI runner egress)
And one principal has exhausted its 100/minute publish budget
When the other principal makes a POST /-/publish request in that window
Then that request is not rate limited and reaches the publish handler
```

---

## HARDEN-002 , Device-code rate limit, keyed by unspoofable client IP

- **Status:** [DONE]
- **Area:** Rate limiting / device flow
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/device.ts` (rateLimit middleware), `apps/registry/src/adapters/cf-rate-limiter.ts` (clientKey) - `apps/registry/src/controllers/device.test.ts`

`POST /-/device/code` (grant creation) is capped at 10 requests per minute, keyed
by `CF-Connecting-IP`. The pre-auth grant-creation step has no principal yet, so it
keys by the edge-set client IP, never the client-supplied `X-Forwarded-For`. IPv6 is
collapsed to its /64 so a client cannot walk its own range to mint fresh keys.

**HARDEN-002-AC1** , A burst past the device-code limit returns 429 with Retry-After
```gherkin
Given a client IP has made 10 POST /-/device/code requests within one minute
When that same IP makes one more POST /-/device/code request in that window
Then the response status is 429
And the response carries a Retry-After header with the seconds until the window resets
```

**HARDEN-002-AC2** , The key uses CF-Connecting-IP, not a spoofable forwarded header
```gherkin
Given a client sends an X-Forwarded-For header it controls and a fixed CF-Connecting-IP
When it makes repeated POST /-/device/code requests rotating X-Forwarded-For each time
Then all requests count against the single bucket for that CF-Connecting-IP
And rotating X-Forwarded-For does not mint fresh rate-limit buckets
```

**HARDEN-002-AC3** , IPv6 clients are bucketed by their /64 network
```gherkin
Given two POST /-/device/code requests from two addresses within the same IPv6 /64
When both are received within one minute
Then both count against the same rate-limit bucket
```

---

## HARDEN-003 , Device-token polling is deliberately not rate limited

- **Status:** [DONE]
- **Area:** Rate limiting / device flow
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/device.ts` (token route has no rateLimit middleware) - `apps/registry/src/controllers/device.test.ts`

`POST /-/device/token` carries no rate-limit middleware. The CLI polls it every few
seconds during a login (RFC 8628), so an IP cap would break legitimate device flows.
Grant creation (`/-/device/code`) is the abuse-prone step and is limited instead;
token polling is bounded by the flow's own `interval`.

**HARDEN-003-AC1** , Repeated token polling is never rate limited
```gherkin
Given a CLI is polling POST /-/device/token for a pending device code
When it makes more than 10 such requests within one minute
Then no request receives a 429 response
And each request is answered by the device-token handler (authorization_pending until approved, then the token)
```

---

## HARDEN-004 , In-memory rate-limit fallback when the Workers binding is absent

- **Status:** [DONE]
- **Area:** Rate limiting / adapter
- **Test mode:** unit
- **Traceability:** `apps/registry/src/adapters/cf-rate-limiter.ts` (bindingRateLimiter, FixedWindowRateLimiter) - `apps/registry/src/adapters/cf-rate-limiter.test.ts`

The `cf(name)` store resolves the named `*_LIMITER` Workers binding per call. When
the binding is unbound (local dev, tests, a non-Cloudflare host) it falls back to a
per-isolate `FixedWindowRateLimiter`. If a bound call itself errors it fails OPEN to
the same fallback rather than turning infrastructure noise into a 500. Both paths are
abuse-blunting behind the edge WAF, not exact counters.

**HARDEN-004-AC1** , With no binding bound, the in-memory window still enforces the cap
```gherkin
Given the named *_LIMITER binding is not present in the environment
When more requests than the configured max arrive for one key within the window
Then requests under the max return allowed
And requests over the max return not allowed with a retryAfterSeconds equal to the window seconds
And the counter resets after the window elapses
```

**HARDEN-004-AC2** , A binding backend error fails open to the in-memory fallback
```gherkin
Given the named *_LIMITER binding is present
And its limit call throws (a backend hiccup)
When a request is evaluated for that key
Then the result is taken from the in-memory fallback instead of surfacing a 500
```

---

## HARDEN-005 , Tarball-origin pinning (no Host trust)

- **Status:** [DONE]
- **Area:** Integrity / resolve
- **Test mode:** manual
- **Traceability:** `apps/registry/src/index.ts` (baseUrlFor, REGISTRY_URL) - (no dedicated test; verified manually)

Packument tarball URLs are built from the pinned `REGISTRY_URL` when configured,
otherwise from the request origin. Pinning means a client-supplied `Host` header can
never redirect installers to an attacker origin for the bytes.

**HARDEN-005-AC1** , Tarball URLs use the pinned origin, ignoring a spoofed Host
```gherkin
Given REGISTRY_URL is configured to the canonical registry origin
And a packument request arrives carrying an attacker-controlled Host header
When the packument is built
Then every dist.tarball URL uses the configured REGISTRY_URL origin
And no tarball URL reflects the request's Host header
```

**HARDEN-005-AC2** , Without a pin, tarball URLs fall back to the request origin
```gherkin
Given REGISTRY_URL is not configured
When the packument is built for a request to the registry origin
Then every dist.tarball URL uses that request's own origin
```

---

## HARDEN-006 , Asset path-traversal guard on the store asset endpoint

- **Status:** [DONE]
- **Area:** Integrity / store assets
- **Test mode:** unit
- **Traceability:** `apps/web/src/lib/registry-source.ts` (isSafeAssetPath), `apps/web/src/routes/v1.plugins.$name.v.$version.files.$.ts` (handler) - `apps/web/src/lib/registry-source.test.ts`

`GET /v1/plugins/:name/v/:version/files/<path>` extracts a single file from the
published tarball. The requested path is validated before any storage access: empty,
absolute, and parent-traversal paths are rejected, so a caller cannot escape the
tarball to read arbitrary files.

**HARDEN-006-AC1** , A parent-traversal asset path is blocked before storage access
```gherkin
Given a request for an asset path containing a .. segment
When the asset endpoint handles it
Then the response status is 400 with an invalid asset path error
And no tarball is fetched and no storage read occurs
```

**HARDEN-006-AC2** , Empty and absolute asset paths are rejected
```gherkin
Given a request for an asset path that is empty or starts with a leading slash
When the asset endpoint handles it
Then the response status is 400 with an invalid asset path error
```

**HARDEN-006-AC3** , A safe in-tarball path is served
```gherkin
Given a request for a normal relative path that exists in the tarball
When the asset endpoint handles it
Then the response status is 200 with the file bytes and its content type
And the response carries an immutable cache-control header
```

---

## HARDEN-007 , Scoped read-only CORS on the registry read surface

- **Status:** [DONE]
- **Area:** Integrity / CORS
- **Test mode:** manual
- **Traceability:** `apps/registry/src/index.ts` (cors middleware) - (no dedicated test; verified manually)

The registry serves the public npm protocol cross-origin so any browser client can
read packuments, tarballs, and the catalog. CORS is opened with `origin: *` but
scoped to read methods only (GET, HEAD, OPTIONS), so a browser cannot drive a
cross-origin mutating request against publish or management.

**HARDEN-007-AC1** , Cross-origin reads are allowed
```gherkin
Given a cross-origin browser request for a packument, tarball, or the catalog
When the registry responds
Then the response carries Access-Control-Allow-Origin: *
And a GET preflight advertises GET, HEAD, and OPTIONS as allowed methods
```

**HARDEN-007-AC2** , Cross-origin mutating methods are not advertised as allowed
```gherkin
Given a CORS preflight asking to use POST against a registry endpoint
When the registry responds
Then POST is not listed among the Access-Control-Allow-Methods
```

---

## HARDEN-008 , Append-only audit log for every mutating action

- **Status:** [DONE]
- **Area:** Audit / observability
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/d1-audit.ts` (D1AuditLog, AuditLog port) - `packages/db/src/adapters/d1-audit.test.ts`

Every mutating action (publish, deprecate, yank, takedown, restore, scope_*) appends
a row to the append-only `reg_audit` table with the action, package, version, the
resolved actor (CI publishes attributed to the repo, local ones to the owner), and an
optional detail blob. The trail is never updated or deleted in place.

**HARDEN-008-AC1** , A successful mutating action writes an audit row
```gherkin
Given a publish (or deprecate, yank, takedown, restore, scope_* action) commits
When the action completes
Then a reg_audit row is appended recording the action, package name, version, and actor
```

**HARDEN-008-AC2** , The actor is the repository for CI and the owner otherwise
```gherkin
Given a publish authenticated by GitHub Actions OIDC carrying a repository
When its audit row is written
Then the actor column holds the repository
Given a publish authenticated by a local publish token with no repository
When its audit row is written
Then the actor column holds the token owner
```

---

## HARDEN-009 , Audit writes are best-effort and never fail a committed action

- **Status:** [DONE]
- **Area:** Audit / reliability
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/d1-audit.ts` (record swallows failures) - `packages/db/src/adapters/d1-audit.test.ts`

The audit write runs after the action it records has already committed (a published
tarball, a flipped flag). A failed audit write is logged and swallowed: it must never
throw back and turn a successful action into a 500, which the client would read as
failure and then fail to retry against the immutability guard.

**HARDEN-009-AC1** , A failing audit write does not surface to the caller
```gherkin
Given a mutating action has already committed
And the reg_audit insert throws (a write failure)
When the audit record call runs
Then the error is swallowed (logged, not rethrown)
And the action's response remains its committed success status, not a 500
```

---

## HARDEN-010 , Operator-admin allowlist for takedown and restore

- **Status:** [DONE]
- **Area:** Admin auth / authorization
- **Test mode:** unit
- **Traceability:** `apps/registry/src/auth.ts` (requireAdmin), `apps/registry/src/env.ts` (registryAdmins, REGISTRY_ADMINS) - `apps/registry/src/auth.test.ts`

Operator takedown/restore is admin-gated, deliberately separate from (and overriding)
scope ownership, because the operator acts against the owner. `requireAdmin` resolves
a valid write credential, then checks its provider-qualified identity (`provider:owner`)
against the `REGISTRY_ADMINS` allowlist. Matching the full `provider:owner` keeps the
check correct once a second provider exists, so a `gitlab` user cannot inherit a
`github` admin's slot.

**HARDEN-010-AC1** , A valid credential not in the allowlist is forbidden
```gherkin
Given a request carries a valid write credential whose provider:owner is not in REGISTRY_ADMINS
When requireAdmin evaluates it
Then it throws 403 Forbidden
```

**HARDEN-010-AC2** , No valid credential is unauthorized, not forbidden
```gherkin
Given a request carries no valid write credential
When requireAdmin evaluates it
Then it throws 401 Unauthorized (distinct from the 403 for a non-admin)
```

**HARDEN-010-AC3** , The allowlist match is provider-qualified
```gherkin
Given REGISTRY_ADMINS contains github:octocat
And a request carries a valid credential for provider gitlab, owner octocat
When requireAdmin evaluates it
Then it throws 403 (the bare owner does not match across providers)
```

---

## HARDEN-011 , Malware-scan hook seam in the publish pipeline

- **Status:** [DONE]
- **Area:** Integrity / publish pipeline
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (TarballScanner port, step 4.5), `apps/registry/src/adapters/noop-tarball-scanner.ts` (NoopTarballScanner), `apps/registry/src/controllers/publish.ts` (422 mapping) - `packages/registry-core/src/publish.test.ts`

The publish pipeline has a defined `TarballScanner` seam that inspects tarball bytes
after the immutability check and before integrity/write, so refused bytes never reach
storage. The shipped default is the allow-all `NoopTarballScanner`; a refusal returns
the `rejected` code, mapped to HTTP 422 (distinct from 400 for a malformed manifest)
and audited as `publish_rejected` with the scan message.

**HARDEN-011-AC1** , A scanner refusal blocks the publish with 422 and writes nothing
```gherkin
Given a scanner that refuses the tarball bytes is wired into the publish pipeline
When a publish reaches the scan step (after the immutability check passes)
Then no tarball is staged and no version is committed
And the publish returns the rejected code mapped to HTTP 422
And a publish_rejected audit row is written with the scan message
```

**HARDEN-011-AC2** , The scan runs only after the immutability check
```gherkin
Given the version being published already exists
When the publish pipeline runs
Then the existing-version rejection happens before the scanner is invoked
And the scanner is not called for an already-published version
```

**HARDEN-011-AC3** , The default allow-all scanner publishes unchanged
```gherkin
Given the default NoopTarballScanner is wired (no real scanner exists yet)
When a valid new version is published
Then the scan passes and the version is committed exactly as before the seam existed
```

---

## HARDEN-012 , Real malware scanner behind the hook

- **Status:** [TODO]
- **Area:** Integrity / publish pipeline
- **Test mode:** none
- **Traceability:** , (not yet built; replaces NoopTarballScanner via PublishOptions.scanner)

A real `TarballScanner` adapter (ClamAV, an external scanning service, or a heuristic
scanner over the tarball entries: suspicious paths, embedded binaries, install-script
red flags) dropped in behind the existing seam, swapping `NoopTarballScanner` without
touching the publish orchestration.

**HARDEN-012-AC1** , A known-bad tarball is refused by the real scanner
```gherkin
Given a real TarballScanner adapter is wired into the publish pipeline
When a publish presents tarball bytes the scanner classifies as malicious
Then the publish returns the rejected code mapped to HTTP 422
And no tarball is staged and no version is committed
And a publish_rejected audit row records the scan reason
```

---

## HARDEN-013 , Scheduled R2 + D1 backups

- **Status:** [TODO]
- **Area:** Operational / backups
- **Test mode:** none
- **Traceability:** , (not yet built; see docs/m6-hardening-plan.md section 4)

A scheduled cron handler exports registry state to a dedicated backup bucket: each
`reg_*` D1 table as a timestamped NDJSON snapshot, plus an R2 tarball manifest
(key, size, integrity). Retention prunes snapshots older than N days, and a manual
operator-run restore script reads a snapshot back into D1. The export logic sits
behind a `BackupSink` port so it is testable against an in-memory sink.

**HARDEN-013-AC1** , A scheduled run writes a timestamped snapshot of every table
```gherkin
Given the backup cron handler runs against an in-memory BackupSink
When the export completes
Then a timestamped NDJSON object is written for each reg_* table under d1/<date>/<table>.ndjson
And an R2 tarball manifest is written under r2/<date>/manifest.ndjson
```

**HARDEN-013-AC2** , Retention prunes snapshots older than the window
```gherkin
Given snapshots exist that are older than the retention window
When the backup run completes
Then those expired snapshots are deleted from the backup sink
And snapshots within the window are retained
```

**HARDEN-013-AC3** , The restore script reloads a snapshot into D1
```gherkin
Given an operator runs the restore script against a chosen snapshot
When it completes
Then the reg_* tables are populated from that snapshot's rows
```

---

## HARDEN-014 , Operator provisioning of hardening infrastructure

- **Status:** [HOLD]
- **Area:** Operational / provisioning
- **Test mode:** manual
- **Traceability:** `apps/registry/wrangler.jsonc` (bindings + triggers.crons), `apps/registry/src/env.ts` (REGISTRY_ADMINS) - (manual, blocked on operator credentials)

The operator-side steps that activate the shipped hardening: creating the
`PUBLISH_LIMITER` and `DEVICE_LIMITER` rate-limit namespaces, the
`brika-registry-backups` bucket and cron trigger, and setting `REGISTRY_ADMINS`.
Blocked on operator credentials; the code paths degrade safely until then (in-memory
rate-limit fallback, empty admin allowlist, no scheduled backups).

**HARDEN-014-AC1** , Rate-limit namespaces are provisioned and bound
```gherkin
Given the operator has created the PUBLISH_LIMITER and DEVICE_LIMITER namespaces
When the worker is deployed with those bindings present
Then the distributed binding enforces the limits instead of the per-isolate fallback
```

**HARDEN-014-AC2** , The admin allowlist is set so takedown is operable
```gherkin
Given the operator has set REGISTRY_ADMINS to the operator identities
When an operator with a matching credential calls takedown or restore
Then requireAdmin authorizes the request
```

**HARDEN-014-AC3** , The backup cron trigger and bucket are provisioned
```gherkin
Given the operator has created the brika-registry-backups bucket and the cron trigger
When the schedule fires
Then the scheduled handler runs and writes snapshots to the backup bucket
```
