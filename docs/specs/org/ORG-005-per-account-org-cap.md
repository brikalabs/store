---
id: ORG-005
title: "Per-account scope cap"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/registry-core/src/limits.ts
    - packages/db/src/adapters/d1-scope-store.ts
  tests:
    - packages/registry-core/src/scope.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

A soft cap (`REGISTRY_LIMITS.maxScopesPerAccount`) on how many scopes one account may
hold, raisable on request. Enforced in `ScopeService.claim` (via the scope store's
owned-count) so a script cannot mass-claim names; it is the hard ceiling that
complements the edge claim rate limit (`ORG-004`).

## Acceptance criteria

### ORG-005-AC1 , cap blocks further claims
```gherkin
Given my account already holds the maximum number of scopes
When I attempt to claim another
Then the claim is refused with a clear "limit reached" message
And no new scope is created
```

### ORG-005-AC2 , cap is raisable
```gherkin
Given an operator raises my scope limit
When I claim another scope within the new limit
Then the claim succeeds
```
