---
id: SCOPE-004
title: "List members (member-gated)"
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

Any member of a scope may view its members. A non-member is refused, and the refusal
distinguishes an unknown scope (404) from a real scope the caller has no membership in (403).

## Acceptance criteria

### SCOPE-004-AC1 , A member can list the scope's members
```gherkin
Given the scope @acme has members alice (admin) and bob (member)
And the caller's verified identity is provider=github owner=bob
When the caller lists members of @acme
When the registry handles GET /-/scope/@acme/members
Then the result is ok with members containing alice (admin) and bob (member)
And the HTTP response status is 200
```

### SCOPE-004-AC2 , A non-member of an existing scope is forbidden
```gherkin
Given the scope @acme exists with member alice (admin)
And the caller's verified identity is provider=github owner=carol who is not a member
When the caller lists members of @acme
Then the result is not ok with code forbidden
And the HTTP response status is 403
```

### SCOPE-004-AC3 , Listing members of an unknown scope is not found
```gherkin
Given no reg_scopes row exists for @ghost
And the caller's verified identity is provider=github owner=alice
When the caller lists members of @ghost
Then the result is not ok with code not_found
And the HTTP response status is 404
```
