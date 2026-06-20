---
id: SCOPE-012
title: "List the scopes I belong to (console read)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/queries.ts
    - apps/web/src/routes/api.scopes.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

The console lists the scopes the signed-in user is a member of, each with their role and
the scope's verified display name, sorted by scope name. This is a plain read model, not an
authorization-bearing use case.

## Acceptance criteria

### SCOPE-012-AC1 , The read returns every scope the member belongs to, with role
```gherkin
Given github user alice is admin of @acme and member of @beta
And github user alice is not a member of @gamma
When listScopesForMember(db, github, alice) is called
When the console handles GET /api/scopes
Then the result contains @acme with role admin and @beta with role member
And it does not contain @gamma
And the entries are sorted by scope name
```

### SCOPE-012-AC2 , Each entry carries the scope's verified display name
```gherkin
Given @acme has displayName="Acme Corporation" and alice is a member
When listScopesForMember(db, github, alice) is called
Then the @acme entry has displayName "Acme Corporation"
```
