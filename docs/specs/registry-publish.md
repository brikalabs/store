# PUB , Publish pipeline

> How a plugin version enters the registry. A single `POST /-/publish` call runs an
> ordered chain of gates (canonical name, ownership, size, data/manifest, immutability,
> malware scan) before any byte is stored, computes integrity from the exact bytes, and
> then writes the tarball to R2 and commits the version metadata to D1 as one atomic
> unit. Writers may authenticate with a GitHub Actions OIDC token (trusted CI publishing)
> or a registry publish token (local CLI). A rejected publish never touches storage, and
> every attempt (accepted or rejected) is audited. This domain covers each gate, the auth
> modes, integrity, atomicity/rollback, build provenance, and the transparency attestation.

Status legend and the code scheme live in [README](./README.md).

The gate order is the contract: name (PUB-001/PUB-002) -> ownership (PUB-003) -> size
(PUB-004) -> data/manifest (PUB-005) -> immutability (PUB-006) -> malware scan
(PUB-007) -> integrity (PUB-008) -> atomic write (PUB-009). Auth (PUB-010/PUB-011),
provenance (PUB-012), attestation (PUB-013), and audit (PUB-014) wrap the pipeline.

---

## PUB-001 , Canonical scoped-name gate

- **Status:** [DONE]
- **Area:** Publish / name validation
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 0), `packages/registry-core/src/names.ts` (isCanonicalName) - `packages/registry-core/src/publish.test.ts`, `packages/registry-core/src/names.test.ts`

The first gate. A non-canonical name is rejected before the ownership gate runs, so a
malformed name never reaches identity resolution or storage.

**PUB-001-AC1** , Non-scoped or non-canonical name is rejected as invalid
```gherkin
Given a publish input whose name is not a lowercase scoped name (@scope/name) of a-z, 0-9 and '-'
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

**PUB-001-AC2** , Canonical scoped name passes the name gate
```gherkin
Given a publish input whose name is a canonical scoped name (e.g. @acme/widget)
When the package is published
Then the canonical-name gate passes and evaluation proceeds to the next gate
```

---

## PUB-002 , Manifest name/version must match the published name/version

- **Status:** [DONE]
- **Area:** Publish / name validation
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 0) - `packages/registry-core/src/publish.test.ts`

The request name/version is what the registry indexes; the manifest must agree, so a
record cannot be published under one identity while declaring another.

**PUB-002-AC1** , Mismatched manifest name is rejected as invalid
```gherkin
Given a canonical name and a manifest whose "name" differs from the published name
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

**PUB-002-AC2** , Mismatched manifest version is rejected as invalid
```gherkin
Given a manifest whose "version" differs from the published version
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

---

## PUB-003 , Ownership gate

- **Status:** [DONE]
- **Area:** Publish / authorization
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 1, OwnershipPolicy.canPublish) - `packages/registry-core/src/publish.test.ts`

After the name is valid, the resolved identity must be allowed to publish this package
(scope owner or member). This runs before the size, data, and storage steps.

**PUB-003-AC1** , Identity that may not publish the package is forbidden
```gherkin
Given a valid name and a manifest that matches it
And an authenticated identity that OwnershipPolicy.canPublish rejects for that name
When the package is published
Then the publish result is not ok with code "forbidden"
And the endpoint responds 403
And no tarball is written and no version metadata is committed
```

**PUB-003-AC2** , Owning identity passes the ownership gate
```gherkin
Given an authenticated identity that OwnershipPolicy.canPublish accepts for the name
When the package is published
Then the ownership gate passes and evaluation proceeds to the next gate
```

---

## PUB-004 , Tarball size limit

- **Status:** [DONE]
- **Area:** Publish / quotas
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 2, maxTarballBytes), `packages/registry-core/src/limits.ts` - `packages/registry-core/src/publish.test.ts`

An oversized payload is refused before it is inspected or stored, capping the work an
abusive publish can force.

**PUB-004-AC1** , Tarball over the byte limit is rejected as too_large
```gherkin
Given a tarball whose byte length exceeds the configured maxTarballBytes
When the package is published
Then the publish result is not ok with code "too_large"
And the endpoint responds 413
And no tarball is written and no version metadata is committed
```

**PUB-004-AC2** , Tarball within the limit passes the size gate
```gherkin
Given a tarball whose byte length is within maxTarballBytes
When the package is published
Then the size gate passes and evaluation proceeds to the next gate
```

---

## PUB-005 , Data/manifest gate (required metadata + bundled locales)

- **Status:** [DONE]
- **Area:** Publish / data validation
- **Test mode:** unit
- **Traceability:** `apps/registry/src/adapters/manifest-validator.ts` (SchemaManifestValidator), `packages/schema/src/store.ts` (RegistryPublishSchema, validateStoreLocales) - `apps/registry/src/adapters/manifest-validator.test.ts`

The publishability gate. `@brika/schema` is the single source of truth: the manifest must
carry the store metadata the registry lists (icon, displayName/title, description), every
bundled file must be within per-file and unpacked size limits, any embedded package.json
must match the published identity, and every bundled `locales/<lang>/store.json` must
validate against the locale schema.

**PUB-005-AC1** , Manifest missing required store metadata is rejected as invalid
```gherkin
Given a manifest missing a required publish field (icon, displayName, or description)
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

**PUB-005-AC2** , Manifest with required store metadata passes the data gate
```gherkin
Given a manifest carrying a valid icon, displayName, and description
And a tarball that is a readable gzip archive within size limits
When the package is published
Then the data gate passes and evaluation proceeds to the next gate
```

**PUB-005-AC3** , Unreadable or oversized tarball content is rejected as invalid
```gherkin
Given a tarball that is not a readable gzip archive, or contains a file over the per-file limit, or whose unpacked total exceeds the unpacked limit
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

**PUB-005-AC4** , Embedded package.json that diverges from the published manifest is rejected
```gherkin
Given a tarball whose bundled package.json declares a name/version other than the published manifest
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

**PUB-005-AC5** , An invalid bundled locale file is rejected as invalid
```gherkin
Given a tarball containing a locales/<lang>/store.json that does not match the store locale schema
When the package is published
Then the publish result is not ok with code "invalid"
And the response message names the offending locale path
And no tarball is written and no version metadata is committed
```

**PUB-005-AC6** , Every bundled locale file is validated
```gherkin
Given a tarball with multiple locales/<lang>/store.json files all matching the store locale schema
When the package is published
Then the data gate passes for all bundled locale files
```

---

## PUB-006 , Version immutability

- **Status:** [DONE]
- **Area:** Publish / immutability
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 4, MetadataWriter.versionExists) - `packages/registry-core/src/publish.test.ts`

A published name@version is permanent. Re-publishing an existing version is refused
before any byte is stored, so an existing release can never be silently overwritten.

**PUB-006-AC1** , Re-publishing an existing version is rejected as exists
```gherkin
Given name@version already exists in the registry
When the same name@version is published again
Then the publish result is not ok with code "exists"
And the endpoint responds 409
And the stored tarball and version metadata for the existing version are unchanged
```

**PUB-006-AC2** , A new version passes the immutability gate
```gherkin
Given name@version does not yet exist in the registry
When the package is published
Then the immutability gate passes and evaluation proceeds to the next gate
```

---

## PUB-007 , Malware/abuse scan hook

- **Status:** [DONE]
- **Area:** Publish / content safety
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 4.5, TarballScanner, allowAllScanner) - `packages/registry-core/src/publish.test.ts`

The last gate before storage, and after immutability so an existing version is never
scanned. The scanner is an injected seam; the default is allow-all (NoopTarballScanner),
so behavior is unchanged until a real scanner is wired in. A scanner refusal means the
bytes are well-formed but unacceptable, which is distinct from an invalid manifest.

**PUB-007-AC1** , Default allow-all scanner permits well-formed bytes
```gherkin
Given no scanner is configured (the default allow-all scanner is used)
And a publish that has passed every prior gate
When the package is published
Then the scan gate passes and the publish proceeds to integrity and storage
```

**PUB-007-AC2** , A scanner refusal rejects the publish as rejected
```gherkin
Given an injected scanner that refuses the tarball bytes
And a publish that has passed every prior gate
When the package is published
Then the publish result is not ok with code "rejected"
And the endpoint responds 422
And no tarball is written and no version metadata is committed
```

---

## PUB-008 , Integrity computation

- **Status:** [DONE]
- **Area:** Publish / integrity
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 5), `packages/registry-core/src/integrity.ts` (sha512Integrity, sha1Hex) - `packages/registry-core/src/integrity.test.ts`, `packages/registry-core/src/publish.test.ts`

Integrity is computed from the exact bytes about to be stored, after every gate has
passed, so the recorded digests always describe the stored artifact.

**PUB-008-AC1** , A successful publish returns sha512 integrity, sha1 shasum, and size
```gherkin
Given a publish that has passed every gate
When the package is published
Then the publish result is ok
And it carries a sha512 Subresource Integrity string, a sha1 shasum, and the byte size of the tarball
```

**PUB-008-AC2** , Recorded integrity matches the stored bytes
```gherkin
Given a successful publish of a tarball
When the stored version metadata is read back
Then its integrity equals sha512Integrity of the stored tarball bytes
And its shasum equals sha1Hex of the same bytes
And its size equals the tarball byte length
```

---

## PUB-009 , Atomic R2 + D1 write with rollback

- **Status:** [DONE]
- **Area:** Publish / storage atomicity
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/publish.ts` (PublishService.publish step 6, TarballWriter.put/delete, MetadataWriter.commitVersion), `apps/registry/src/controllers/publish.ts` (transaction) - `packages/registry-core/src/publish.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

The only step that writes. The tarball is staged to R2 first, then the version metadata is
committed atomically to D1 inside a transaction. A failed metadata commit rolls the staged
tarball back, so a publish is all-or-nothing across both stores.

**PUB-009-AC1** , A successful publish stores the tarball and commits the version metadata
```gherkin
Given a publish that has passed every gate
When the package is published
Then the tarball is written to R2 at the version's tarball path
And the version metadata is committed to D1 (the version row and its "latest" tag together)
And the endpoint responds 201 with { ok: true, name, version, integrity }
```

**PUB-009-AC2** , A failed metadata commit rolls back the staged tarball
```gherkin
Given the tarball has been staged to R2 and the metadata commit then fails
When the publish transaction unwinds
Then the staged tarball is removed from R2
And no version metadata is left in D1
And the publish does not report success
```

**PUB-009-AC3** , Metadata commit is all-or-nothing
```gherkin
Given a publish whose metadata commit is interrupted partway
When the commit fails
Then a version row never exists without its "latest" tag, nor a tag without its version row
```

---

## PUB-010 , GitHub Actions OIDC authentication

- **Status:** [DONE]
- **Area:** Publish / authentication
- **Test mode:** unit
- **Traceability:** `apps/registry/src/auth.ts` (authenticateWrite/requireWrite), `packages/registry-core/src/oidc.ts` (verifyGithubOidc), `apps/registry/src/adapters/github-jwks.ts` - `packages/registry-core/src/oidc.test.ts`

Trusted (tokenless) publishing from CI. A GitHub Actions OIDC token is verified by RS256
signature against GitHub's JWKS, then by issuer, audience (brika-registry), and time
window, yielding a forge-proof publish identity.

**PUB-010-AC1** , A valid OIDC token authorizes a write as a github identity
```gherkin
Given a request with a Bearer GitHub Actions OIDC token valid for audience "brika-registry"
When the publish endpoint authenticates the write
Then the resolved identity has provider "github" and owner equal to the token's repository_owner
And its repository equals the token's repository
```

**PUB-010-AC2** , An OIDC token with a wrong audience or issuer is rejected
```gherkin
Given a Bearer OIDC token whose audience or issuer does not match what the endpoint requires
And no valid publish token is presented
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
```

**PUB-010-AC3** , An OIDC token with a bad signature or expired window is rejected
```gherkin
Given a Bearer OIDC token whose RS256 signature fails, or whose exp is past or nbf is future
And no valid publish token is presented
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
```

---

## PUB-011 , Registry publish-token authentication

- **Status:** [DONE]
- **Area:** Publish / authentication
- **Test mode:** unit
- **Traceability:** `apps/registry/src/auth.ts` (authenticateWrite, TokenStore.verify) - `apps/registry/src/controllers/handlers.test.ts`

Local publishing from the `brika` CLI. When no OIDC token validates, a registry publish
token is verified and resolves to its owning identity.

**PUB-011-AC1** , A valid publish token authorizes a write as the token owner
```gherkin
Given a request with a Bearer registry publish token and no OIDC token
When the publish endpoint authenticates the write
Then the resolved identity has the token's provider and owner
And its repository is null (a local token publish has no CI repository)
```

**PUB-011-AC2** , A request with no valid credential is unauthorized
```gherkin
Given a publish request with no Bearer credential, or a token that neither OIDC nor TokenStore.verify accepts
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
And no gate runs and no storage is touched
```

---

## PUB-012 , Build provenance persistence

- **Status:** [DONE]
- **Area:** Publish / provenance
- **Test mode:** unit
- **Traceability:** `apps/registry/src/auth.ts` (provenanceFrom), `packages/registry-core/src/publish.ts` (commitVersion provenance) - `packages/registry-core/src/publish.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

CI provenance is derived only from the verified OIDC claims (it cannot be forged) and is
persisted on the version. A local token publish has no provenance.

**PUB-012-AC1** , An OIDC publish persists provenance on the version
```gherkin
Given a publish authenticated by a valid GitHub Actions OIDC token
When the version is committed
Then the stored version carries provenance with the token's repository, sha, ref, workflowRef, and runId
```

**PUB-012-AC2** , A token publish stores no provenance
```gherkin
Given a publish authenticated by a registry publish token (no OIDC)
When the version is committed
Then the stored version's provenance is null
```

---

## PUB-013 , Transparency-log attestation

- **Status:** [DONE]
- **Area:** Publish / attestation
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/publish.ts` (withAttestation), `packages/registry-core/src/attestation.ts` (TransparencyEntry) - `packages/registry-core/src/attestation.test.ts`

A client may send a sigstore/transparency-log entry with the publish. It is attached to
the persisted provenance only when it can be trusted: the publish is OIDC-authenticated and
the attested integrity matches the received bytes. Otherwise it is silently dropped and
never blocks the publish.

**PUB-013-AC1** , A matching attestation on an OIDC publish is attached to provenance
```gherkin
Given an OIDC-authenticated publish with provenance
And a transparency-log entry whose integrity equals sha512Integrity of the tarball
When the publish is processed
Then the entry is attached to the stored version's provenance as its transparencyLog
```

**PUB-013-AC2** , An attestation whose integrity does not match the bytes is dropped
```gherkin
Given an OIDC-authenticated publish
And a transparency-log entry whose integrity does not equal the tarball's integrity
When the publish is processed
Then the entry is not attached to provenance
And the publish still succeeds
```

**PUB-013-AC3** , An attestation on a non-OIDC publish is dropped
```gherkin
Given a publish authenticated by a token (no OIDC provenance)
And a transparency-log entry is supplied
When the publish is processed
Then the entry is not attached
And the publish still succeeds
```

---

## PUB-014 , Publish audit log

- **Status:** [DONE]
- **Area:** Publish / audit
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/publish.ts` (audit.record) - `apps/registry/src/controllers/handlers.test.ts`

Every publish attempt is recorded in the audit log (reg_audit), whether it succeeded or was
rejected, so the registry has a complete record of who attempted what.

**PUB-014-AC1** , A successful publish records a "publish" audit row
```gherkin
Given a publish that succeeds
When the attempt completes
Then an audit row is recorded with action "publish", the package name, version, and the actor identity
```

**PUB-014-AC2** , A rejected publish records a "publish_rejected" audit row with the failure
```gherkin
Given a publish rejected by any gate
When the attempt completes
Then an audit row is recorded with action "publish_rejected", the package name, version, the actor identity, and a detail carrying the error code and message
```

---

## PUB-015 , Real malware scanner

- **Status:** [TODO]
- **Area:** Publish / content safety
- **Test mode:** none
- **Traceability:** `packages/registry-core/src/publish.ts` (TarballScanner seam) - , (not yet built)

The TarballScanner seam (PUB-007) exists and defaults to allow-all. A real scanner
(ClamAV, an external service, or a heuristic pass over the unpacked entries) that actually
inspects the bytes and refuses malicious or abusive content is not yet built.

**PUB-015-AC1** , A real scanner refuses known-malicious content
```gherkin
Given a configured real malware scanner
And a tarball whose bytes contain known-malicious or abusive content
When the package is published
Then the scan gate refuses the bytes
And the publish result is not ok with code "rejected"
And the endpoint responds 422
And no tarball is written and no version metadata is committed
```

**PUB-015-AC2** , A real scanner permits clean content
```gherkin
Given a configured real malware scanner
And a tarball whose bytes are clean
When the package is published
Then the scan gate passes and the publish proceeds to integrity and storage
```
