---
id: OPERATOR-003
title: "Operator scope moderation (takedown / restore)"
status: done
area: operator
group: operator
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api/operator/scopes/$scope/takedown.ts
    - apps/web/src/routes/api/operator/scopes/$scope/restore.ts
    - apps/web/src/routes/operator/scopes.tsx
  tests: []
---

## Description

An operator can withdraw a squatted or abusive scope from public listings (ORG-007)
and later restore it. Both actions are operator-gated and the reason is recorded in
the audit log.

## Acceptance criteria

### OPERATOR-003-AC1 , takedown withdraws a scope from public listings
```gherkin
Given an operator and a public scope
When they POST /api/operator/scopes/:scope/takedown with a reason
Then the scope is withdrawn from public listings
And an audit "scope_takedown" entry with the reason is written
```

### OPERATOR-003-AC2 , restore re-lists a taken-down scope
```gherkin
Given an operator and a taken-down scope
When they POST /api/operator/scopes/:scope/restore
Then the scope appears in public listings again
And the action is audited
```

### OPERATOR-003-AC3 , scope moderation rejects non-operators
```gherkin
Given a request that is not an authenticated operator
When it calls a scope moderation endpoint
Then the response is 404
```
