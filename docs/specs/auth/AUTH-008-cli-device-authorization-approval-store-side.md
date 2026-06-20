---
id: AUTH-008
title: "CLI device-authorization approval (store side)"
status: done
area: auth
group: auth
test_mode: none
traceability:
  code:
    - apps/web/src/routes/device.tsx
    - apps/web/src/routes/api.device.approve.ts
    - apps/web/src/lib/device-approval.ts
  tests: []
---

## Description

`brika login` opens a device-authorization (RFC 8628). The store renders `/device` (an
8-character OTP form) and exposes `POST /api/device/approve`, which is session-gated and binds
the signed-in user's GitHub login to the pending device record so the CLI can mint a publish
token. The approval is a single race-free conditional UPDATE: it only matches a code that is
unexpired and not yet approved.

## Acceptance criteria

### AUTH-008-AC1 , Approving requires a signed-in user
```gherkin
Given a POST /api/device/approve with no valid session
When the handler runs
Then the response is 401 Unauthorized
And no device record is approved
```

### AUTH-008-AC2 , A malformed approval body is rejected
```gherkin
Given a signed-in user POSTs /api/device/approve with a body missing user_code
When the handler runs
Then the response is 400 Bad Request
```

### AUTH-008-AC3 , A valid code is approved and bound to the user's login
```gherkin
Given a signed-in user POSTs /api/device/approve with a user_code for a pending, unexpired device record
When the handler runs
Then the reg_device_auth row for that code is set approved=true with the user's githubLogin
And the response is 200 with JSON { "ok": true }
```

### AUTH-008-AC4 , An invalid, expired, or already-used code is a safe no-op
```gherkin
Given a signed-in user POSTs /api/device/approve with a code that is unknown, expired, or already approved
When the handler runs
Then no device record is modified
And the response is 400 with a message that the code is invalid, expired, or already used
```

### AUTH-008-AC5 , The device page gates the OTP form behind sign-in
```gherkin
Given a visitor opens /device?code=BR7K-MNPQ while not signed in
When the page renders
Then it shows a "Sign in with GitHub to continue" action linking to /auth/github?return=/device?code=BR7K-MNPQ
And the approve action is not available until the visitor is signed in
```
