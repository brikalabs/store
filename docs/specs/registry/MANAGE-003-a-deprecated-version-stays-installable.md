---
id: MANAGE-003
title: "A deprecated version stays installable"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/packument.ts
    - packages/registry-core/src/manage.ts
  tests:
    - packages/registry-core/src/packument.test.ts
    - packages/registry-core/src/manage.test.ts
---

## Description

Deprecation never removes a version from resolution. The version remains present in both
the full and abbreviated packument and resolves normally, so existing and new consumers
can still install it.

## Acceptance criteria

### MANAGE-003-AC1 , A deprecated version remains visible and resolvable
```gherkin
Given a version that has been deprecated
When a client reads the packument and resolves the version
Then the version is still present in the packument "versions" map
And it carries the "deprecated" warning field
And it resolves to its tarball as normal
```
