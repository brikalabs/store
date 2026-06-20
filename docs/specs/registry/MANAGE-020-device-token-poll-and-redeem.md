---
id: MANAGE-020
title: "Device-token poll and redeem"
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
    - packages/registry-core/src/device.extra.test.ts
---

## Description

The CLI polls the token endpoint with its device code. Until the user approves (store-side,
see AUTH), the poll reports authorization_pending; once approved, the grant is consumed and
exchanged for a bearer access token. The poll endpoint is not rate-limited. An unknown code
is invalid_grant and an expired code is expired_token.

## Acceptance criteria

### MANAGE-020-AC1 , Polling before approval reports authorization pending
```gherkin
Given a device code whose grant exists and has not yet been approved
When the client POSTs /-/device/token with that device_code
Then the response reports error "authorization_pending"
And the grant is not consumed (the client may keep polling)
```

### MANAGE-020-AC2 , Polling after approval returns a bearer access token
```gherkin
Given a device code whose grant has been approved and linked to a user (per AUTH)
When the client POSTs /-/device/token with that device_code
Then the response carries an access_token with token_type "bearer" and the approved login
And the grant is consumed so the same device_code cannot be redeemed twice
```

### MANAGE-020-AC3 , Polling an unknown or expired device code is rejected
```gherkin
Given a device_code that is unknown to the registry, or whose grant has passed its expiry
When the client POSTs /-/device/token with that device_code
Then the response reports error "invalid_grant" for an unknown code, or "expired_token" for an expired one
```
