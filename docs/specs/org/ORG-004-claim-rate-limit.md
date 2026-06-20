---
id: ORG-004
title: "Claim rate limit"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

Throttle org/scope claims per authenticated principal so a script cannot mass-claim.

## Acceptance criteria

### ORG-004-AC1 , claims are throttled per principal
```gherkin
Given I am authenticated as principal P
And I have made the maximum allowed claims this window
When I attempt another claim
Then I get 429 with a Retry-After header
And no new org is created
```
