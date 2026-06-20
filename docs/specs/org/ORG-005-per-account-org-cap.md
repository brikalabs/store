---
id: ORG-005
title: "Per-account org cap"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/org.ts
    - packages/registry-core/src/limits.ts
    - packages/db/src/adapters/d1-org-members.ts
  tests:
    - packages/registry-core/src/org.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

A soft cap on how many orgs one account may hold, raisable on request.
Supersedes `SCOPE-014` (the per-user scope cap on today's model) when the org rename lands.

## Acceptance criteria

### ORG-005-AC1 , cap blocks further claims
```gherkin
Given my account already holds the maximum number of orgs
When I attempt to claim another
Then the claim is refused with a clear "limit reached" message
And no new org is created
```

### ORG-005-AC2 , cap is raisable
```gherkin
Given an operator raises my org limit
When I claim another org within the new limit
Then the claim succeeds
```
