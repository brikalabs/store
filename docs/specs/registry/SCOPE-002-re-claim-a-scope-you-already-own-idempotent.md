---
id: SCOPE-002
title: "Re-claim a scope you already own (idempotent)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

Claiming a scope you already own is a no-op success, so the operation is safe to retry.

## Acceptance criteria

### SCOPE-002-AC1 , Re-claiming an owned scope returns created false and 200
```gherkin
Given a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme again
When the registry handles PUT /-/scope/@acme
Then the result is ok with created false and owner {provider: github, id: alice}
And the HTTP response status is 200
And no duplicate reg_scopes or reg_scope_members row is created
```
