---
id: MANAGE-007
title: "Deprecate or yank of a missing version is not found"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/manage.ts
  tests:
    - packages/registry-core/src/manage.test.ts
---

## Description

An owner-gated operation on a name@version that does not exist returns not_found rather
than silently succeeding.

## Acceptance criteria

### MANAGE-007-AC1 , Deprecating a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller that owns the scope
When the caller POSTs /-/package/:name/:version/deprecate
Then the result is not ok with code "not_found"
And the endpoint responds 404
```

### MANAGE-007-AC2 , Yanking a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller that owns the scope
When the caller POSTs /-/package/:name/:version/yank
Then the result is not ok with code "not_found"
And the endpoint responds 404
```
