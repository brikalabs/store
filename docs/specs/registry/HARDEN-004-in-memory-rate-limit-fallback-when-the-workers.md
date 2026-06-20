---
id: HARDEN-004
title: "In-memory rate-limit fallback when the Workers binding is absent"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/adapters/cf-rate-limiter.ts
  tests:
    - apps/registry/src/adapters/cf-rate-limiter.test.ts
---

## Description

The `cf(name)` store resolves the named `*_LIMITER` Workers binding per call. When
the binding is unbound (local dev, tests, a non-Cloudflare host) it falls back to a
per-isolate `FixedWindowRateLimiter`. If a bound call itself errors it fails OPEN to
the same fallback rather than turning infrastructure noise into a 500. Both paths are
abuse-blunting behind the edge WAF, not exact counters.

## Acceptance criteria

### HARDEN-004-AC1 , With no binding bound, the in-memory window still enforces the cap
```gherkin
Given the named *_LIMITER binding is not present in the environment
When more requests than the configured max arrive for one key within the window
Then requests under the max return allowed
And requests over the max return not allowed with a retryAfterSeconds equal to the window seconds
And the counter resets after the window elapses
```

### HARDEN-004-AC2 , A binding backend error fails open to the in-memory fallback
```gherkin
Given the named *_LIMITER binding is present
And its limit call throws (a backend hiccup)
When a request is evaluated for that key
Then the result is taken from the in-memory fallback instead of surfacing a 500
```
