---
id: SCOPE-007
title: "Remove a member (admin only; 404 non-member)"
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

Only an admin may remove a member. Removing someone who is not a member of the scope
returns 404. `DELETE /-/scope/:scope/member/:provider/:id`.

## Acceptance criteria

### SCOPE-007-AC1 , An admin can remove a member
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: bob}
When the registry handles DELETE /-/scope/@acme/member/github/bob
Then the result is ok with removed {provider: github, id: bob}
And no reg_scope_members row exists for bob in @acme
And the HTTP response status is 200
```

### SCOPE-007-AC2 , Removing a non-member returns 404
```gherkin
Given the scope @acme has admin alice and no member named zoe
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: zoe}
Then the result is not ok with code not_found
And the HTTP response status is 404
```

### SCOPE-007-AC3 , A non-admin member cannot remove a member
```gherkin
Given the scope @acme has admin alice and members bob and dave
And the caller's verified identity is provider=github owner=bob
When the caller removes member {provider: github, id: dave}
Then the result is not ok with code forbidden
And the HTTP response status is 403
And the reg_scope_members row for dave still exists
```
