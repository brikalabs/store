---
id: ORG-005
title: "Per-account org cap"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

A soft cap on how many orgs one account may hold, raisable on request.

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
