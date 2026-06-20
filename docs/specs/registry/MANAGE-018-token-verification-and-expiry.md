---
id: MANAGE-018
title: "Token verification and expiry"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/tokens.ts
    - packages/db/src/adapters/token.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

Verification resolves a presented plaintext token to its owning principal by matching its
SHA-256 hash. A token that does not match, has been revoked, or is past its expiry does not
verify.

## Acceptance criteria

### MANAGE-018-AC1 , A valid unexpired token verifies to its principal
```gherkin
Given a token issued for provider P and subject S that has not expired or been revoked
When the registry verifies the plaintext token
Then it resolves to a principal with provider P and subject S
```

### MANAGE-018-AC2 , An expired, revoked, or unknown token does not verify
```gherkin
Given a token that is past its expiresAt, has been revoked, or was never issued
When the registry verifies the plaintext token
Then verification returns no principal (the token is rejected)
```
