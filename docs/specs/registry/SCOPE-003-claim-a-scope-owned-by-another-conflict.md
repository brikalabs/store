---
id: SCOPE-003
title: "Claim a scope owned by another (conflict)"
status: gone
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - apps/registry/src/controllers/scope.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

> **Superseded by the ORG-\* specs** (the organisation rename; see [ADR 0001](../../adr/0001-organisation-1n-model.md)). Retained for history; behaviour now lives under `ORG-*`.

A scope is owned by exactly one identity. A second identity cannot take it over.

## Acceptance criteria

### SCOPE-003-AC1 , Claiming a scope owned by someone else returns 409
```gherkin
Given a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the caller's verified identity is provider=github owner=bob
When the caller claims @acme
When the registry handles PUT /-/scope/@acme
Then the result is not ok with code conflict
And the HTTP response status is 409
And the existing reg_scopes owner is unchanged (ownerId=alice)
```
