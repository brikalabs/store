---
id: ORG-007
title: "Operator takedown of a squatted org"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/org.ts
    - packages/db/src/adapters/d1-org-store.ts
    - apps/registry/src/controllers/org.ts
  tests:
    - packages/registry-core/src/org.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

An operator (admin allowlist) can take down and restore an org name, as a backstop
for squats that slip through.

## Acceptance criteria

### ORG-007-AC1 , operator takes down a squatted org
```gherkin
Given an org name is being squatted
When an operator takes it down with a reason
Then the org is withdrawn from public listings
And the action is audited with the operator and reason
```

### ORG-007-AC2 , non-operator cannot take down
```gherkin
Given I am not an operator admin
When I attempt to take down an org
Then I get 403 forbidden
```
