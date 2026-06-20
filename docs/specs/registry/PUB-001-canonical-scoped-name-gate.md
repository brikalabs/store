---
id: PUB-001
title: "Canonical scoped-name gate"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
    - packages/registry-core/src/names.ts
  tests:
    - packages/registry-core/src/publish.test.ts
    - packages/registry-core/src/names.test.ts
---

## Description

The first gate. A non-canonical name is rejected before the ownership gate runs, so a
malformed name never reaches identity resolution or storage.

## Acceptance criteria

### PUB-001-AC1 , Non-scoped or non-canonical name is rejected as invalid
```gherkin
Given a publish input whose name is not a lowercase scoped name (@scope/name) of a-z, 0-9 and '-'
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

### PUB-001-AC2 , Canonical scoped name passes the name gate
```gherkin
Given a publish input whose name is a canonical scoped name (e.g. @acme/widget)
When the package is published
Then the canonical-name gate passes and evaluation proceeds to the next gate
```
