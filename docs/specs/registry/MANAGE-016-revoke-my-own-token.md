---
id: MANAGE-016
title: "Revoke my own token"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.account.tokens.$hash.ts
    - packages/registry-core/src/tokens.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

A user revokes one of their own tokens by its hash. After revocation the token no longer
verifies for publishing.

## Acceptance criteria

### MANAGE-016-AC1 , Revoking an owned token removes it
```gherkin
Given a signed-in user who owns a token with hash H
When the user DELETEs /api/account/tokens/H
Then the response reports ok
And the token no longer appears in the user's token list
And verifying the plaintext token no longer authorizes a write
```
