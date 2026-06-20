---
id: SCOPE-008
title: "Cannot remove the last admin (conflict)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/db/src/adapters/d1-scope-members.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

The last-admin invariant also guards removal: an admin who is the scope's only admin
cannot be removed. The guard is part of the DELETE statement (`role <> 'admin' or
moreThanOneAdmin`), so non-admins are always removable and only the last admin is protected.

## Acceptance criteria

### SCOPE-008-AC1 , Removing the only admin is refused with conflict
```gherkin
Given the scope @acme has exactly one admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: alice}
Then the result is not ok with code conflict
And the HTTP response status is 409
And the reg_scope_members row for alice still exists with role=admin
```

### SCOPE-008-AC2 , Removing one of several admins succeeds
```gherkin
Given the scope @acme has two admins alice and bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: bob}
Then the result is ok with removed {provider: github, id: bob}
And no reg_scope_members row exists for bob
And the reg_scope_members row for alice still has role=admin
```
