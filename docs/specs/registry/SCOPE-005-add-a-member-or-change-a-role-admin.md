---
id: SCOPE-005
title: "Add a member or change a role (admin only)"
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

Only an admin may add a member or change a member's role. `PUT /-/scope/:scope/member/:provider/:id`
carries the target role in the body (`{role: "admin" | "member"}`).

## Acceptance criteria

### SCOPE-005-AC1 , An admin can add a new member
```gherkin
Given the scope @acme has admin alice
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: dave} to role member
When the registry handles PUT /-/scope/@acme/member/github/dave with body {role: member}
Then the result is ok with member {provider: github, id: dave, role: member}
And a reg_scope_members row exists with scope=@acme, provider=github, memberId=dave, role=member
And the HTTP response status is 200
```

### SCOPE-005-AC2 , An admin can promote a member to admin
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: bob} to role admin
Then the result is ok with member {provider: github, id: bob, role: admin}
And the reg_scope_members row for bob has role=admin
```

### SCOPE-005-AC3 , A non-admin member cannot change membership
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=bob
When the caller sets member {provider: github, id: dave} to role member
Then the result is not ok with code forbidden
And the HTTP response status is 403
And no reg_scope_members row is created for dave
```
