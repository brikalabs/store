---
id: SCOPE-013
title: "Console session surface enforces the same scope rules"
status: gone
area: scope
group: registry
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/api.scopes.$scope.ts
    - apps/web/src/routes/api.scopes.$scope.members.ts
    - apps/web/src/routes/api.scopes.$scope.members.$memberId.ts
    - apps/web/src/routes/api.scopes.$scope.display-name.ts
  tests: []
---

## Description

> **Superseded by the ORG-\* specs** (the organisation rename; see [ADR 0001](../../adr/0001-organisation-1n-model.md)). Retained for history; behaviour now lives under `ORG-*`.

The web console API (session auth, identity = sessionIdentity(user) = {provider: github,
owner: login}) reuses the SAME `ScopeService` over the same shared D1 as the registry HTTP
surface, so claim, membership, last-admin, and display-name rules and result codes are
identical across both surfaces. Domain result codes map the same way: forbidden -> 403,
not_found -> 404, conflict -> 409.

## Acceptance criteria

### SCOPE-013-AC1 , The console claims a scope and makes the user its admin
```gherkin
Given a signed-in console user whose github login is maxtest
When the console handles PUT /api/scopes/@maxtest
Then the response status is 201 with created true
And a reg_scope_members row exists with scope=@maxtest, provider=github, memberId=maxtest, role=admin
```

### SCOPE-013-AC2 , The console enforces the last-admin invariant identically
```gherkin
Given the console user is the only admin of @maxtest
When the console handles PUT /api/scopes/@maxtest/members demoting themselves to member
Then the response status is 409
And their reg_scope_members role stays admin
```

### SCOPE-013-AC3 , The console applies the shared display-name validation
```gherkin
Given the console user is an admin of @maxtest
When the console handles POST /api/scopes/@maxtest/display-name with a name carrying invisible characters
Then the response status is 400
And the reg_scopes displayName is unchanged
```

### SCOPE-013-AC4 , Console membership writes are admin-gated like the registry
```gherkin
Given the console user is a non-admin member of @maxtest
When the console handles PUT /api/scopes/@maxtest/members or DELETE /api/scopes/@maxtest/members/:memberId
Then the response status is 403
```
