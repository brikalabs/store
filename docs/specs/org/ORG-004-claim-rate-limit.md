---
id: ORG-004
title: "Claim rate limit"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/org.ts
    - apps/registry/src/adapters/cf-rate-limiter.ts
  tests:
    - apps/registry/src/controllers/org.ratelimit.test.ts
---

## Description

Throttle org/scope claims per authenticated principal so a script cannot mass-claim.
Supersedes `SCOPE-015` (the same control on today's scope model) when the org rename lands.

## Acceptance criteria

### ORG-004-AC1 , claims are throttled per principal
```gherkin
Given I am authenticated as principal P
And I have made the maximum allowed claims this window
When I attempt another claim
Then I get 429 with a Retry-After header
And no new org is created
```
