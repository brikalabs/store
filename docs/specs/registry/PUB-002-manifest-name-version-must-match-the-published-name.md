---
id: PUB-002
title: "Manifest name/version must match the published name/version"
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

The request name/version is what the registry indexes; the manifest must agree, so a
record cannot be published under one identity while declaring another.

## Acceptance criteria

### PUB-002-AC1 , Mismatched manifest name is rejected as invalid
```gherkin
Given a canonical name and a manifest whose "name" differs from the published name
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

### PUB-002-AC2 , Mismatched manifest version is rejected as invalid
```gherkin
Given a manifest whose "version" differs from the published version
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```
