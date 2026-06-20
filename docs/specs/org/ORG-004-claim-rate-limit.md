---
id: ORG-004
title: "Scope claim rate limit"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/scope.ts
    - apps/registry/src/adapters/cf-rate-limiter.ts
  tests:
    - apps/registry/src/controllers/scope.ratelimit.test.ts
---

## Description

Throttle scope claims per authenticated principal so a script cannot mass-claim scope
names. The scope (`@brika`) is the ownership entity itself; claiming it is the
throttled action (`PUT /-/scope/:scope`). The hard ceiling is the per-account cap
(`ORG-005`); this is the edge throttle on top.

## Acceptance criteria

### ORG-004-AC1 , claims are throttled per principal
```gherkin
Given I am authenticated as principal P
And I have made the maximum allowed claims this window
When I attempt another scope claim
Then I get 429 with a Retry-After header
And no new scope is created
```
