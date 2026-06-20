---
id: MANAGE-014
title: "Issue a publish token (plaintext shown once)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/tokens.ts
    - packages/db/src/adapters/token.ts
    - apps/web/src/routes/api.account.tokens.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

Issuing a token returns the plaintext exactly once. The token has the `brika_` prefix, and
the registry stores only its SHA-256 hash with a 90-day TTL; the plaintext is never
persisted and cannot be recovered.

## Acceptance criteria

### MANAGE-014-AC1 , Issuing a token returns the plaintext exactly once
```gherkin
Given a signed-in user
When the user POSTs /api/account/tokens to issue a publish token
Then the response carries a plaintext token string prefixed with "brika_"
And only the SHA-256 hash of the token is persisted (the plaintext is never stored)
```

### MANAGE-014-AC2 , An issued token records a 90-day expiry
```gherkin
Given a token issued for a subject
When the token row is read back
Then its expiresAt is its createdAt plus 90 days
```
