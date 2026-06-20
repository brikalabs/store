---
id: SCOPE-014
title: "Per-user scope cap (anti-squatting)"
status: gone
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/registry-core/src/limits.ts
    - packages/db/src/adapters/d1-scope-store.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

> **Superseded by the ORG-\* specs** (the organisation rename; see [ADR 0001](../../adr/0001-organisation-1n-model.md)). Retained for history; behaviour now lives under `ORG-*`.

An identity may own at most `REGISTRY_LIMITS.maxScopesPerUser` scopes. The cap is
enforced in `ScopeService.claim` (via `ScopeStore.countOwnedBy`) so a script cannot
mass-claim names. It is the hard ceiling that complements the edge claim rate limit
(`SCOPE-015`). On the planned org model this becomes `ORG-005` (per-account org cap).

## Acceptance criteria

### SCOPE-014-AC1 , a new claim is refused once the per-user cap is reached
```gherkin
Given I already own the maximum number of scopes allowed
When I claim a new, unclaimed scope
Then the claim is refused with code "too_many" (HTTP 429)
And the over-cap scope is not created
```

### SCOPE-014-AC2 , the cap is per identity, not global
```gherkin
Given identity A is at its scope cap
And identity B is below the cap
When identity B claims a new scope
Then B's claim succeeds
```

### SCOPE-014-AC3 , re-claiming a scope you already own is exempt
```gherkin
Given I am at my scope cap
And I already own scope "@a"
When I claim "@a" again
Then it returns ok (created: false), not a cap error
```
