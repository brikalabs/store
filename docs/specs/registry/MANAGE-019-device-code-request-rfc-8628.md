---
id: MANAGE-019
title: "Device-code request (RFC 8628)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/device.ts
    - apps/registry/src/controllers/device.ts
  tests:
    - packages/registry-core/src/device.test.ts
    - apps/registry/src/controllers/device.test.ts
---

## Description

The `brika` CLI starts the device-authorization flow with no credential. The endpoint
mints a device code and a user-facing code with a verification URI, a poll interval, and an
expiry, and is rate-limited to 10 requests per minute per client IP.

## Acceptance criteria

### MANAGE-019-AC1 , Requesting a device code returns the grant fields
```gherkin
Given an unauthenticated client
When the client POSTs /-/device/code
Then the response carries device_code, user_code, verification_uri, verification_uri_complete, interval, and expires_in
```

### MANAGE-019-AC2 , Device-code requests are rate-limited per IP
```gherkin
Given a single client IP that has made 10 device-code requests within a minute
When the same IP POSTs /-/device/code again within that minute
Then the request is rejected with 429 Too Many Requests
```
