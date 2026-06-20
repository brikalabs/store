---
id: MANAGE-005
title: "Un-yank a version (owner)"
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

Yanking is reversible. Setting yanked to false restores the version to the packument and
catalog.

## Acceptance criteria

### MANAGE-005-AC1 , Un-yanking restores the version to installs and the catalog
```gherkin
Given a version that is currently yanked and owned by the caller
When the caller POSTs /-/package/:name/:version/yank with { yanked: false }
Then the result is ok and the endpoint responds 200
And reading the packument lists the version again in its "versions" map
And the catalog surfaces the version again
```
