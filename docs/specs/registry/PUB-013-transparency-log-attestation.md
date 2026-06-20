---
id: PUB-013
title: "Transparency-log attestation"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/publish.ts
    - packages/registry-core/src/attestation.ts
  tests:
    - packages/registry-core/src/attestation.test.ts
---

## Description

A client may send a sigstore/transparency-log entry with the publish. It is attached to
the persisted provenance only when it can be trusted: the publish is OIDC-authenticated and
the attested integrity matches the received bytes. Otherwise it is silently dropped and
never blocks the publish.

## Acceptance criteria

### PUB-013-AC1 , A matching attestation on an OIDC publish is attached to provenance
```gherkin
Given an OIDC-authenticated publish with provenance
And a transparency-log entry whose integrity equals sha512Integrity of the tarball
When the publish is processed
Then the entry is attached to the stored version's provenance as its transparencyLog
```

### PUB-013-AC2 , An attestation whose integrity does not match the bytes is dropped
```gherkin
Given an OIDC-authenticated publish
And a transparency-log entry whose integrity does not equal the tarball's integrity
When the publish is processed
Then the entry is not attached to provenance
And the publish still succeeds
```

### PUB-013-AC3 , An attestation on a non-OIDC publish is dropped
```gherkin
Given a publish authenticated by a token (no OIDC provenance)
And a transparency-log entry is supplied
When the publish is processed
Then the entry is not attached
And the publish still succeeds
```
