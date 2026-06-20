---
id: SCOPE-001
title: "Claim a new scope (creator becomes first admin)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/db/src/adapters/d1-scope-store.ts
    - apps/registry/src/controllers/scope.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

A scope must exist before anything publishes under it. The first caller to claim an
unclaimed scope owns it and is seeded as its first `admin`. The claim is race-safe:
the insert-if-absent is the serialization point, so a loser of a concurrent claim
reads back the winner's record. `PUT /-/scope/:scope` validates the scope is canonical
(`@` + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen).

## Acceptance criteria

### SCOPE-001-AC1 , Claiming an unclaimed scope creates it and returns 201
```gherkin
Given the scope @acme has no record in reg_scopes
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme
When the registry handles PUT /-/scope/@acme
Then the result is ok with created true and owner {provider: github, id: alice}
And a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the HTTP response status is 201
```

### SCOPE-001-AC2 , The creator is seeded as the scope's first admin
```gherkin
Given the scope @acme has no record in reg_scopes
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme
Then a reg_scope_members row exists with scope=@acme, provider=github, memberId=alice, role=admin
```

### SCOPE-001-AC3 , A non-canonical scope name is rejected before any write
```gherkin
Given the caller's verified identity is provider=github owner=alice
When the registry handles PUT /-/scope/Acme!
Then the HTTP response status is 400
And no reg_scopes row is created for that name
```
