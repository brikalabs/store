---
id: SCOPE-015
title: "Claim rate limit (per principal)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/scope.ts
    - apps/registry/src/adapters/cf-rate-limiter.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

`PUT /-/scope/:scope` (claim) is rate-limited per authenticated principal via the
shared `@brika/router` `rateLimit` middleware and the `CLAIM_LIMITER` Cloudflare
binding (in-memory fallback when absent), like publish and device-code. This blunts
claim bursts; the per-user cap (`SCOPE-014`) is the hard ceiling. On the planned org
model this becomes `ORG-004`.

## Acceptance criteria

### SCOPE-015-AC1 , claims are throttled per principal
```gherkin
Given I am an authenticated principal
And I have exhausted the claim window for this principal
When I attempt another claim
Then I get HTTP 429 with a Retry-After header
And a JSON body with code "rate_limited"
```
