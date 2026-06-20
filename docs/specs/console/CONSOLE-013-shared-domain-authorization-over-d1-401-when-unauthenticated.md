---
id: CONSOLE-013
title: "Shared-domain authorization over D1 (401 when unauthenticated)"
status: done
area: console
group: console
test_mode: unit (identity + status mapping); API auth verified in-browser
traceability:
  code:
    - apps/web/src/lib/console-api.ts
    - apps/web/src/lib/registry-identity.ts
    - apps/web/src/lib/http.ts
  tests:
    - apps/web/src/lib/registry-identity.test.ts
    - apps/web/src/lib/http.test.ts
---

## Description

Every console `api.*` handler runs `authed(request)`: it resolves the session and
builds the registry service graph over the shared D1, mapping the session user to
a GitHub publish identity (`sessionIdentity`), or returns a 401 when there is no
session. Domain `ScopeResult` / `ManageResult` codes map to HTTP via
`scopeStatus` / `manageStatus`.

## Acceptance criteria

### CONSOLE-013-AC1 , Unauthenticated console API call returns 401
```gherkin
Given a request to a console api.* endpoint with no valid session
When the handler calls authed(request)
Then the handler returns a 401 JSON "Sign in required" response
And no domain mutation is performed
```

### CONSOLE-013-AC2 , Session maps to a local-actor GitHub publish identity
```gherkin
Given a signed-in session user with login <login>
When sessionIdentity builds the publish identity
Then the identity is provider github, owner <login>, repository null (a local non-CI actor)
```

### CONSOLE-013-AC3 , Domain result codes map to HTTP statuses
```gherkin
Given a ScopeResult or ManageResult error code
When the handler maps it via scopeStatus or manageStatus
Then not_found maps to 404, conflict maps to 409, and forbidden maps to 403
```
