---
id: PUB-006
title: "Version immutability"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
  tests:
    - packages/registry-core/src/publish.test.ts
---

## Description

A published name@version is permanent. Re-publishing an existing version is refused
before any byte is stored, so an existing release can never be silently overwritten.

## Acceptance criteria

### PUB-006-AC1 , Re-publishing an existing version is rejected as exists
```gherkin
Given name@version already exists in the registry
When the same name@version is published again
Then the publish result is not ok with code "exists"
And the endpoint responds 409
And the stored tarball and version metadata for the existing version are unchanged
```

### PUB-006-AC2 , A new version passes the immutability gate
```gherkin
Given name@version does not yet exist in the registry
When the package is published
Then the immutability gate passes and evaluation proceeds to the next gate
```
