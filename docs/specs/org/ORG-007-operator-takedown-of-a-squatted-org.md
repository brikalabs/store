---
id: ORG-007
title: "Operator takedown of a squatted org"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
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
