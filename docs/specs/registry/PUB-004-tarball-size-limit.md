---
id: PUB-004
title: "Tarball size limit"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
    - packages/registry-core/src/limits.ts
  tests:
    - packages/registry-core/src/publish.test.ts
---

## Description

An oversized payload is refused before it is inspected or stored, capping the work an
abusive publish can force.

## Acceptance criteria

### PUB-004-AC1 , Tarball over the byte limit is rejected as too_large
```gherkin
Given a tarball whose byte length exceeds the configured maxTarballBytes
When the package is published
Then the publish result is not ok with code "too_large"
And the endpoint responds 413
And no tarball is written and no version metadata is committed
```

### PUB-004-AC2 , Tarball within the limit passes the size gate
```gherkin
Given a tarball whose byte length is within maxTarballBytes
When the package is published
Then the size gate passes and evaluation proceeds to the next gate
```
