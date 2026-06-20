---
id: MANAGE-010
title: "Non-admin takedown or restore is forbidden"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/auth.ts
    - apps/registry/src/controllers/manage.ts
  tests:
    - apps/registry/src/auth.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Takedown and restore are gated on the REGISTRY_ADMINS allowlist, matched as a
provider-qualified identity (provider:owner). A valid write credential that is not an admin
is refused, even if it owns the package scope.

## Acceptance criteria

### MANAGE-010-AC1 , A non-admin taking down a version is forbidden
```gherkin
Given an existing version
And an authenticated caller whose provider:owner is not in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/takedown
Then the endpoint responds 403 Forbidden
And the version's takedown state is unchanged
```

### MANAGE-010-AC2 , A request with no valid credential is unauthorized
```gherkin
Given a takedown or restore request with no Bearer credential that authenticates
When the endpoint authorizes the admin operation
Then the endpoint responds 401 Unauthorized
And no state changes
```
