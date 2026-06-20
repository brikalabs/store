---
id: PUB-008
title: "Integrity computation"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
    - packages/registry-core/src/integrity.ts
  tests:
    - packages/registry-core/src/integrity.test.ts
    - packages/registry-core/src/publish.test.ts
---

## Description

Integrity is computed from the exact bytes about to be stored, after every gate has
passed, so the recorded digests always describe the stored artifact.

## Acceptance criteria

### PUB-008-AC1 , A successful publish returns sha512 integrity, sha1 shasum, and size
```gherkin
Given a publish that has passed every gate
When the package is published
Then the publish result is ok
And it carries a sha512 Subresource Integrity string, a sha1 shasum, and the byte size of the tarball
```

### PUB-008-AC2 , Recorded integrity matches the stored bytes
```gherkin
Given a successful publish of a tarball
When the stored version metadata is read back
Then its integrity equals sha512Integrity of the stored tarball bytes
And its shasum equals sha1Hex of the same bytes
And its size equals the tarball byte length
```
