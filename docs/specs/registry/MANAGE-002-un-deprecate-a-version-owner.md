---
id: MANAGE-002
title: "Un-deprecate a version (owner)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/manage.ts
    - apps/registry/src/controllers/manage.ts
  tests:
    - packages/registry-core/src/manage.test.ts
---

## Description

Passing a null message clears the deprecation, returning the version to an undeprecated
state.

## Acceptance criteria

### MANAGE-002-AC1 , Deprecating with a null message clears the warning
```gherkin
Given a version that is currently deprecated and owned by the caller
When the caller POSTs /-/package/:name/:version/deprecate with { message: null }
Then the result is ok and the endpoint responds 200
And reading the packument shows the version with no "deprecated" field
```
