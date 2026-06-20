---
id: PUB-012
title: "Build provenance persistence"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/auth.ts
    - packages/registry-core/src/publish.ts
  tests:
    - packages/registry-core/src/publish.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

CI provenance is derived only from the verified OIDC claims (it cannot be forged) and is
persisted on the version. A local token publish has no provenance.

## Acceptance criteria

### PUB-012-AC1 , An OIDC publish persists provenance on the version
```gherkin
Given a publish authenticated by a valid GitHub Actions OIDC token
When the version is committed
Then the stored version carries provenance with the token's repository, sha, ref, workflowRef, and runId
```

### PUB-012-AC2 , A token publish stores no provenance
```gherkin
Given a publish authenticated by a registry publish token (no OIDC)
When the version is committed
Then the stored version's provenance is null
```
