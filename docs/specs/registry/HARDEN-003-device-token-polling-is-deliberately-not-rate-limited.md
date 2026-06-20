---
id: HARDEN-003
title: "Device-token polling is deliberately not rate limited"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/device.ts
  tests:
    - apps/registry/src/controllers/device.test.ts
---

## Description

`POST /-/device/token` carries no rate-limit middleware. The CLI polls it every few
seconds during a login (RFC 8628), so an IP cap would break legitimate device flows.
Grant creation (`/-/device/code`) is the abuse-prone step and is limited instead;
token polling is bounded by the flow's own `interval`.

## Acceptance criteria

### HARDEN-003-AC1 , Repeated token polling is never rate limited
```gherkin
Given a CLI is polling POST /-/device/token for a pending device code
When it makes more than 10 such requests within one minute
Then no request receives a 429 response
And each request is answered by the device-token handler (authorization_pending until approved, then the token)
```
