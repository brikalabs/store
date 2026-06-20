---
id: MANAGE-021
title: "Revoke a device-issued token (Bearer)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/device.ts
    - packages/registry-core/src/tokens.ts
  tests:
    - apps/registry/src/controllers/device.test.ts
---

## Description

A client revokes the token it currently holds by presenting it as a Bearer credential to
the revoke endpoint. After revocation the token no longer verifies for publishing.

## Acceptance criteria

### MANAGE-021-AC1 , Revoking the held token via Bearer succeeds
```gherkin
Given a client holding a valid registry token
When the client POSTs /-/token/revoke with Authorization Bearer set to that token
Then the response reports ok
And the token no longer verifies for subsequent writes
```
