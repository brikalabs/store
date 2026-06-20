---
id: HARDEN-002
title: "Device-code rate limit, keyed by unspoofable client IP"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/device.ts
    - apps/registry/src/adapters/cf-rate-limiter.ts
  tests:
    - apps/registry/src/controllers/device.test.ts
---

## Description

`POST /-/device/code` (grant creation) is capped at 10 requests per minute, keyed
by `CF-Connecting-IP`. The pre-auth grant-creation step has no principal yet, so it
keys by the edge-set client IP, never the client-supplied `X-Forwarded-For`. IPv6 is
collapsed to its /64 so a client cannot walk its own range to mint fresh keys.

## Acceptance criteria

### HARDEN-002-AC1 , A burst past the device-code limit returns 429 with Retry-After
```gherkin
Given a client IP has made 10 POST /-/device/code requests within one minute
When that same IP makes one more POST /-/device/code request in that window
Then the response status is 429
And the response carries a Retry-After header with the seconds until the window resets
```

### HARDEN-002-AC2 , The key uses CF-Connecting-IP, not a spoofable forwarded header
```gherkin
Given a client sends an X-Forwarded-For header it controls and a fixed CF-Connecting-IP
When it makes repeated POST /-/device/code requests rotating X-Forwarded-For each time
Then all requests count against the single bucket for that CF-Connecting-IP
And rotating X-Forwarded-For does not mint fresh rate-limit buckets
```

### HARDEN-002-AC3 , IPv6 clients are bucketed by their /64 network
```gherkin
Given two POST /-/device/code requests from two addresses within the same IPv6 /64
When both are received within one minute
Then both count against the same rate-limit bucket
```
