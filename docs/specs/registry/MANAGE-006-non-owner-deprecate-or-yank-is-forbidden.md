---
id: MANAGE-006
title: "Non-owner deprecate or yank is forbidden"
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
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Deprecate and yank are owner-gated. A valid write credential whose identity does not own
the package scope is refused before any state changes.

## Acceptance criteria

### MANAGE-006-AC1 , A non-owner deprecating a version is forbidden
```gherkin
Given an existing version whose scope the authenticated caller does not own
When the caller POSTs /-/package/:name/:version/deprecate
Then the result is not ok with code "forbidden"
And the endpoint responds 403
And the version's deprecation state is unchanged
```

### MANAGE-006-AC2 , A non-owner yanking a version is forbidden
```gherkin
Given an existing version whose scope the authenticated caller does not own
When the caller POSTs /-/package/:name/:version/yank
Then the result is not ok with code "forbidden"
And the endpoint responds 403
And the version's yanked state is unchanged
```
