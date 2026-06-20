---
id: SCOPE-006
title: "Cannot demote the last admin (conflict)"
status: gone
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

> **Superseded by the ORG-\* specs** (the organisation rename; see [ADR 0001](../../adr/0001-organisation-1n-model.md)). Retained for history; behaviour now lives under `ORG-*`.

A scope must always keep at least one admin. Demoting the last admin to member is refused
atomically: the "more than one admin" check is a subquery inside the UPDATE, so concurrent
demotions of different admins cannot both succeed.

## Acceptance criteria

### SCOPE-006-AC1 , Demoting the only admin is refused with conflict
```gherkin
Given the scope @acme has exactly one admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: alice} to role member
Then the result is not ok with code conflict
And the HTTP response status is 409
And the reg_scope_members row for alice still has role=admin
```

### SCOPE-006-AC2 , Demoting one of several admins succeeds
```gherkin
Given the scope @acme has two admins alice and bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: bob} to role member
Then the result is ok with member {provider: github, id: bob, role: member}
And the reg_scope_members row for bob has role=member
And the reg_scope_members row for alice still has role=admin
```
