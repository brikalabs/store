---
id: ORG-007
title: "Operator takedown of a squatted scope"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/db/src/adapters/d1-scope-store.ts
    - apps/registry/src/controllers/scope.ts
  tests:
    - packages/registry-core/src/scope.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

An operator (admin allowlist) can take down and restore a scope, as a backstop
for squats that slip through. The takedown flag lives on `reg_scopes`; the action is
audited (`scope_*`).

## Acceptance criteria

### ORG-007-AC1 , operator takes down a squatted scope
```gherkin
Given a scope is being squatted
When an operator takes it down with a reason
Then the scope is withdrawn from public listings
And the action is audited with the operator and reason
```

### ORG-007-AC2 , non-operator cannot take down
```gherkin
Given I am not an operator admin
When I attempt to take down a scope
Then I get 403 forbidden
```
