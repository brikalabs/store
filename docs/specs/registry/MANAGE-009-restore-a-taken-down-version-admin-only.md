---
id: MANAGE-009
title: "Restore a taken-down version (admin-only)"
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

Takedown is reversible by an operator. Restore clears the takedown, returning the version
to the packument and catalog and removing it from the "takedowns" map.

## Acceptance criteria

### MANAGE-009-AC1 , An admin restores a taken-down version
```gherkin
Given a version that is currently taken down
And an authenticated caller in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/restore
Then the result is ok and the endpoint responds 200
And reading the packument lists the version again in its "versions" map
And the version no longer appears in the packument "takedowns" map
```
