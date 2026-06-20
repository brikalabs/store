# MANAGE , Version management, tokens & device flow

> Lifecycle operations on a published version after it lands, plus the credentials
> that authorize them. A version is permanent (PUB-006), but its visibility can change:
> an owner can deprecate it (a warning; it stays installable) or yank it (hidden from new
> installs and the catalog, bytes kept so pinned lockfiles still resolve), and a platform
> operator can take a version down (admin-only, existence-gated, reason surfaced publicly
> in the packument) or restore it. Authorization comes from two credential types: registry
> publish tokens (issued once in plaintext, only the SHA-256 hash stored, 90-day TTL,
> verify/revoke) and the RFC 8628 device-authorization flow that the `brika` CLI uses to
> mint a token without a browser paste. This domain covers each management operation and
> its guard, token issuance/listing/revocation, and the device-code request/poll/revoke
> endpoints. The store-side approval page that links a device code to a user lives in the
> AUTH spec and is referenced, not duplicated, here.

Status legend and the code scheme live in [README](./README.md).

The authorization model is the contract: deprecate and yank are owner-gated (the caller
must be a member of the package scope); takedown and restore are admin-only (the caller
must be in the REGISTRY_ADMINS allowlist) and existence-gated rather than ownership-gated.
Every management operation is audited, whether accepted or rejected.

---

## MANAGE-001 , Deprecate a version (owner)

- **Status:** [DONE]
- **Area:** Management / deprecate
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.deprecate), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/deprecate) - `packages/registry-core/src/manage.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

A scope member marks a version as deprecated with a human message (max 1024 chars, or
null to clear). Deprecation is advisory only: the version stays in the packument and stays
installable. The endpoint requires a write credential whose identity owns the scope.

**MANAGE-001-AC1** , An owner deprecates a version with a message
```gherkin
Given an existing version name@version owned by the authenticated caller
When the caller POSTs /-/package/:name/:version/deprecate with { message: "<text>" }
Then the result is ok and the endpoint responds 200
And reading the packument shows the version with its "deprecated" field set to the message
```

**MANAGE-001-AC2** , A deprecation message over 1024 chars is truncated
```gherkin
Given an existing version owned by the caller
When the caller deprecates it with a message longer than 1024 characters
Then the stored deprecation message is truncated to 1024 characters
```

---

## MANAGE-002 , Un-deprecate a version (owner)

- **Status:** [DONE]
- **Area:** Management / deprecate
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.deprecate with null), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/deprecate) - `packages/registry-core/src/manage.test.ts`

Passing a null message clears the deprecation, returning the version to an undeprecated
state.

**MANAGE-002-AC1** , Deprecating with a null message clears the warning
```gherkin
Given a version that is currently deprecated and owned by the caller
When the caller POSTs /-/package/:name/:version/deprecate with { message: null }
Then the result is ok and the endpoint responds 200
And reading the packument shows the version with no "deprecated" field
```

---

## MANAGE-003 , A deprecated version stays installable

- **Status:** [DONE]
- **Area:** Management / deprecate
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/packument.ts` (buildPackument), `packages/registry-core/src/manage.ts` (ManagementService.deprecate) - `packages/registry-core/src/packument.test.ts`, `packages/registry-core/src/manage.test.ts`

Deprecation never removes a version from resolution. The version remains present in both
the full and abbreviated packument and resolves normally, so existing and new consumers
can still install it.

**MANAGE-003-AC1** , A deprecated version remains visible and resolvable
```gherkin
Given a version that has been deprecated
When a client reads the packument and resolves the version
Then the version is still present in the packument "versions" map
And it carries the "deprecated" warning field
And it resolves to its tarball as normal
```

---

## MANAGE-004 , Yank a version (owner)

- **Status:** [DONE]
- **Area:** Management / yank
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.setYanked true), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/yank) - `packages/registry-core/src/manage.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

A scope member yanks a version to hide it from new installs and the catalog. The tarball
bytes are kept, so a lockfile that already pins the yanked version still resolves. The
endpoint requires a write credential whose identity owns the scope.

**MANAGE-004-AC1** , An owner yanks a version and it disappears from new installs
```gherkin
Given an existing version name@version owned by the authenticated caller
When the caller POSTs /-/package/:name/:version/yank with { yanked: true }
Then the result is ok and the endpoint responds 200
And reading the packument no longer lists the version in its "versions" map
And the catalog no longer surfaces the version
```

**MANAGE-004-AC2** , A pinned lockfile still resolves a yanked version
```gherkin
Given a version that has been yanked
And the tarball bytes for that version still exist in storage
When a client requests the exact yanked version by its pinned tarball path
Then the tarball is served as normal (the bytes are not deleted on yank)
```

---

## MANAGE-005 , Un-yank a version (owner)

- **Status:** [DONE]
- **Area:** Management / yank
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.setYanked false), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/yank) - `packages/registry-core/src/manage.test.ts`

Yanking is reversible. Setting yanked to false restores the version to the packument and
catalog.

**MANAGE-005-AC1** , Un-yanking restores the version to installs and the catalog
```gherkin
Given a version that is currently yanked and owned by the caller
When the caller POSTs /-/package/:name/:version/yank with { yanked: false }
Then the result is ok and the endpoint responds 200
And reading the packument lists the version again in its "versions" map
And the catalog surfaces the version again
```

---

## MANAGE-006 , Non-owner deprecate or yank is forbidden

- **Status:** [DONE]
- **Area:** Management / authorization
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ownership check, ManageErrorCode "forbidden"), `apps/registry/src/controllers/manage.ts` (requireWrite + ownership) - `packages/registry-core/src/manage.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

Deprecate and yank are owner-gated. A valid write credential whose identity does not own
the package scope is refused before any state changes.

**MANAGE-006-AC1** , A non-owner deprecating a version is forbidden
```gherkin
Given an existing version whose scope the authenticated caller does not own
When the caller POSTs /-/package/:name/:version/deprecate
Then the result is not ok with code "forbidden"
And the endpoint responds 403
And the version's deprecation state is unchanged
```

**MANAGE-006-AC2** , A non-owner yanking a version is forbidden
```gherkin
Given an existing version whose scope the authenticated caller does not own
When the caller POSTs /-/package/:name/:version/yank
Then the result is not ok with code "forbidden"
And the endpoint responds 403
And the version's yanked state is unchanged
```

---

## MANAGE-007 , Deprecate or yank of a missing version is not found

- **Status:** [DONE]
- **Area:** Management / validation
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (versionExists, ManageErrorCode "not_found") - `packages/registry-core/src/manage.test.ts`

An owner-gated operation on a name@version that does not exist returns not_found rather
than silently succeeding.

**MANAGE-007-AC1** , Deprecating a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller that owns the scope
When the caller POSTs /-/package/:name/:version/deprecate
Then the result is not ok with code "not_found"
And the endpoint responds 404
```

**MANAGE-007-AC2** , Yanking a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller that owns the scope
When the caller POSTs /-/package/:name/:version/yank
Then the result is not ok with code "not_found"
And the endpoint responds 404
```

---

## MANAGE-008 , Operator takedown (admin-only)

- **Status:** [DONE]
- **Area:** Management / takedown
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.takedown), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/takedown, requireAdmin), `apps/registry/src/auth.ts` (requireAdmin), `apps/registry/src/env.ts` (registryAdmins) - `packages/registry-core/src/manage.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

A platform operator removes a version for policy or legal reasons. Takedown is admin-only
(the caller must be in the REGISTRY_ADMINS allowlist) and existence-gated, not
ownership-gated: an operator can take down any existing version regardless of who owns it.
Like a yank, the version is hidden from installs and the catalog and the bytes are kept,
but the reason (max 1024 chars) is surfaced publicly in the packument "takedowns" map.

**MANAGE-008-AC1** , An admin takes down any existing version with a public reason
```gherkin
Given an existing version name@version
And an authenticated caller in the REGISTRY_ADMINS allowlist (need not own the scope)
When the caller POSTs /-/package/:name/:version/takedown with { reason: "<text>" }
Then the result is ok and the endpoint responds 200
And reading the packument no longer lists the version in its "versions" map
And the packument "takedowns" map maps the version to the supplied reason
```

**MANAGE-008-AC2** , Taking down a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/takedown
Then the result is not ok with code "not_found"
And the endpoint responds 404
```

---

## MANAGE-009 , Restore a taken-down version (admin-only)

- **Status:** [DONE]
- **Area:** Management / takedown
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/manage.ts` (ManagementService.restore), `apps/registry/src/controllers/manage.ts` (POST /-/package/:name/:version/restore, requireAdmin) - `packages/registry-core/src/manage.test.ts`

Takedown is reversible by an operator. Restore clears the takedown, returning the version
to the packument and catalog and removing it from the "takedowns" map.

**MANAGE-009-AC1** , An admin restores a taken-down version
```gherkin
Given a version that is currently taken down
And an authenticated caller in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/restore
Then the result is ok and the endpoint responds 200
And reading the packument lists the version again in its "versions" map
And the version no longer appears in the packument "takedowns" map
```

---

## MANAGE-010 , Non-admin takedown or restore is forbidden

- **Status:** [DONE]
- **Area:** Management / authorization
- **Test mode:** unit
- **Traceability:** `apps/registry/src/auth.ts` (requireAdmin, REGISTRY_ADMINS check), `apps/registry/src/controllers/manage.ts` (requireAdmin) - `apps/registry/src/auth.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

Takedown and restore are gated on the REGISTRY_ADMINS allowlist, matched as a
provider-qualified identity (provider:owner). A valid write credential that is not an admin
is refused, even if it owns the package scope.

**MANAGE-010-AC1** , A non-admin taking down a version is forbidden
```gherkin
Given an existing version
And an authenticated caller whose provider:owner is not in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/takedown
Then the endpoint responds 403 Forbidden
And the version's takedown state is unchanged
```

**MANAGE-010-AC2** , A request with no valid credential is unauthorized
```gherkin
Given a takedown or restore request with no Bearer credential that authenticates
When the endpoint authorizes the admin operation
Then the endpoint responds 401 Unauthorized
And no state changes
```

---

## MANAGE-011 , Management operations are audited

- **Status:** [DONE]
- **Area:** Management / audit
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/manage.ts` (auditAndRespond) - `apps/registry/src/controllers/handlers.test.ts`

Every management attempt is recorded in the audit log (reg_audit), accepted or rejected,
with the actor identity and the action, so the registry has a complete record of who
changed a version's visibility.

**MANAGE-011-AC1** , A successful management operation records an audit row
```gherkin
Given a successful deprecate, yank, unyank, takedown, or restore
When the attempt completes
Then an audit row is recorded with the matching action, the package name, version, and the actor identity
```

**MANAGE-011-AC2** , A rejected management operation records a rejected audit row
```gherkin
Given a management operation rejected by an ownership, admin, or existence gate
When the attempt completes
Then an audit row is recorded with the "<action>_rejected" action and a detail carrying the error code and message
```

---

## MANAGE-012 , Web console deprecate and yank (session-auth, member-gated)

- **Status:** [DONE]
- **Area:** Management / console
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.plugins.deprecate.ts`, `apps/web/src/routes/api.plugins.yank.ts`, `apps/web/src/routes/dashboard.plugins.$.tsx` (Versions panel) - `packages/registry-core/src/manage.test.ts`

The developer console exposes deprecate and yank from the plugin Versions panel. The
routes authenticate by session and gate on scope membership through the same
ManagementService ownership check as the registry endpoints. Takedown and restore are
operator-only and are deliberately absent from the console.

**MANAGE-012-AC1** , A signed-in scope member deprecates from the console
```gherkin
Given a signed-in user who is a member of the package scope
When the user POSTs /api/plugins/deprecate for a version with a message (or null)
Then the response reports ok with the resulting deprecated state
```

**MANAGE-012-AC2** , A signed-in scope member yanks from the console
```gherkin
Given a signed-in user who is a member of the package scope
When the user POSTs /api/plugins/yank for a version with a yanked boolean
Then the response reports ok with the resulting yanked state
```

**MANAGE-012-AC3** , A signed-in non-member is refused
```gherkin
Given a signed-in user who is not a member of the package scope
When the user POSTs /api/plugins/deprecate or /api/plugins/yank for that package
Then the operation is refused and the version's state is unchanged
```

---

## MANAGE-013 , Console version list with manage capability

- **Status:** [DONE]
- **Area:** Management / console
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.plugins.versions.ts` (GET versions + canManage) - `packages/registry-core/src/manage.test.ts`

The console lists a package's versions and tells the UI whether the signed-in user may
manage them, so the Versions panel only offers deprecate/yank to members.

**MANAGE-013-AC1** , The version list reports canManage for a member
```gherkin
Given a signed-in user who is a member of the package scope
When the user GETs /api/plugins/versions?name=<package>
Then the response lists the package versions with their current deprecated and yanked state
And canManage is true
```

**MANAGE-013-AC2** , The version list reports canManage false for a non-member
```gherkin
Given a signed-in user who is not a member of the package scope
When the user GETs /api/plugins/versions?name=<package>
Then the response lists the versions
And canManage is false
```

---

## MANAGE-014 , Issue a publish token (plaintext shown once)

- **Status:** [DONE]
- **Area:** Tokens / issuance
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/tokens.ts` (TokenStore.issue), `packages/db/src/adapters/token.ts` (D1TokenStore.issue), `apps/web/src/routes/api.account.tokens.ts` (POST) - `packages/db/src/adapters/queries.test.ts`

Issuing a token returns the plaintext exactly once. The token has the `brika_` prefix, and
the registry stores only its SHA-256 hash with a 90-day TTL; the plaintext is never
persisted and cannot be recovered.

**MANAGE-014-AC1** , Issuing a token returns the plaintext exactly once
```gherkin
Given a signed-in user
When the user POSTs /api/account/tokens to issue a publish token
Then the response carries a plaintext token string prefixed with "brika_"
And only the SHA-256 hash of the token is persisted (the plaintext is never stored)
```

**MANAGE-014-AC2** , An issued token records a 90-day expiry
```gherkin
Given a token issued for a subject
When the token row is read back
Then its expiresAt is its createdAt plus 90 days
```

---

## MANAGE-015 , List my tokens (metadata only)

- **Status:** [DONE]
- **Area:** Tokens / listing
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.account.tokens.ts` (GET, queries.listSubjectTokens) - `packages/db/src/adapters/queries.test.ts`

A user lists their own tokens by metadata only. The plaintext is never returned by the
listing; only the hash and timestamps are exposed, and only for the caller's own subject.

**MANAGE-015-AC1** , Listing tokens returns metadata only, scoped to the caller
```gherkin
Given a signed-in user with one or more issued tokens
When the user GETs /api/account/tokens
Then the response lists only that user's tokens
And each entry carries the token hash, createdAt, expiresAt, and lastUsedAt
And no entry carries the plaintext token
```

---

## MANAGE-016 , Revoke my own token

- **Status:** [DONE]
- **Area:** Tokens / revocation
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.account.tokens.$hash.ts` (DELETE, queries.revokeTokenByHash), `packages/registry-core/src/tokens.ts` (TokenStore.revoke) - `packages/db/src/adapters/queries.test.ts`

A user revokes one of their own tokens by its hash. After revocation the token no longer
verifies for publishing.

**MANAGE-016-AC1** , Revoking an owned token removes it
```gherkin
Given a signed-in user who owns a token with hash H
When the user DELETEs /api/account/tokens/H
Then the response reports ok
And the token no longer appears in the user's token list
And verifying the plaintext token no longer authorizes a write
```

---

## MANAGE-017 , Cannot revoke another user's token

- **Status:** [DONE]
- **Area:** Tokens / authorization
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.account.tokens.$hash.ts` (ownership-guarded queries.revokeTokenByHash) - `packages/db/src/adapters/queries.test.ts`

Revocation is ownership-guarded by the caller's subject. Targeting a hash that belongs to
another user is reported as not found and does not delete anything.

**MANAGE-017-AC1** , Revoking a token owned by another user returns not found
```gherkin
Given a signed-in user and a token hash H that belongs to a different subject
When the user DELETEs /api/account/tokens/H
Then the endpoint responds 404 Not Found
And the other user's token is not removed
```

---

## MANAGE-018 , Token verification and expiry

- **Status:** [DONE]
- **Area:** Tokens / verification
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/tokens.ts` (TokenStore.verify), `packages/db/src/adapters/token.ts` (verifyToken) - `packages/db/src/adapters/queries.test.ts`

Verification resolves a presented plaintext token to its owning principal by matching its
SHA-256 hash. A token that does not match, has been revoked, or is past its expiry does not
verify.

**MANAGE-018-AC1** , A valid unexpired token verifies to its principal
```gherkin
Given a token issued for provider P and subject S that has not expired or been revoked
When the registry verifies the plaintext token
Then it resolves to a principal with provider P and subject S
```

**MANAGE-018-AC2** , An expired, revoked, or unknown token does not verify
```gherkin
Given a token that is past its expiresAt, has been revoked, or was never issued
When the registry verifies the plaintext token
Then verification returns no principal (the token is rejected)
```

---

## MANAGE-019 , Device-code request (RFC 8628)

- **Status:** [DONE]
- **Area:** Device flow / request
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/device.ts` (DeviceService.requestCode), `apps/registry/src/controllers/device.ts` (POST /-/device/code, rate-limited) - `packages/registry-core/src/device.test.ts`, `apps/registry/src/controllers/device.test.ts`

The `brika` CLI starts the device-authorization flow with no credential. The endpoint
mints a device code and a user-facing code with a verification URI, a poll interval, and an
expiry, and is rate-limited to 10 requests per minute per client IP.

**MANAGE-019-AC1** , Requesting a device code returns the grant fields
```gherkin
Given an unauthenticated client
When the client POSTs /-/device/code
Then the response carries device_code, user_code, verification_uri, verification_uri_complete, interval, and expires_in
```

**MANAGE-019-AC2** , Device-code requests are rate-limited per IP
```gherkin
Given a single client IP that has made 10 device-code requests within a minute
When the same IP POSTs /-/device/code again within that minute
Then the request is rejected with 429 Too Many Requests
```

---

## MANAGE-020 , Device-token poll and redeem

- **Status:** [DONE]
- **Area:** Device flow / poll
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/device.ts` (DeviceService.redeem), `apps/registry/src/controllers/device.ts` (POST /-/device/token) - `packages/registry-core/src/device.test.ts`, `packages/registry-core/src/device.extra.test.ts`

The CLI polls the token endpoint with its device code. Until the user approves (store-side,
see AUTH), the poll reports authorization_pending; once approved, the grant is consumed and
exchanged for a bearer access token. The poll endpoint is not rate-limited. An unknown code
is invalid_grant and an expired code is expired_token.

**MANAGE-020-AC1** , Polling before approval reports authorization pending
```gherkin
Given a device code whose grant exists and has not yet been approved
When the client POSTs /-/device/token with that device_code
Then the response reports error "authorization_pending"
And the grant is not consumed (the client may keep polling)
```

**MANAGE-020-AC2** , Polling after approval returns a bearer access token
```gherkin
Given a device code whose grant has been approved and linked to a user (per AUTH)
When the client POSTs /-/device/token with that device_code
Then the response carries an access_token with token_type "bearer" and the approved login
And the grant is consumed so the same device_code cannot be redeemed twice
```

**MANAGE-020-AC3** , Polling an unknown or expired device code is rejected
```gherkin
Given a device_code that is unknown to the registry, or whose grant has passed its expiry
When the client POSTs /-/device/token with that device_code
Then the response reports error "invalid_grant" for an unknown code, or "expired_token" for an expired one
```

---

## MANAGE-021 , Revoke a device-issued token (Bearer)

- **Status:** [DONE]
- **Area:** Device flow / revocation
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/device.ts` (POST /-/token/revoke), `packages/registry-core/src/tokens.ts` (TokenStore.revoke) - `apps/registry/src/controllers/device.test.ts`

A client revokes the token it currently holds by presenting it as a Bearer credential to
the revoke endpoint. After revocation the token no longer verifies for publishing.

**MANAGE-021-AC1** , Revoking the held token via Bearer succeeds
```gherkin
Given a client holding a valid registry token
When the client POSTs /-/token/revoke with Authorization Bearer set to that token
Then the response reports ok
And the token no longer verifies for subsequent writes
```
