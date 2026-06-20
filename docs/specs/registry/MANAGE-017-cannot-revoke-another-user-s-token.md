---
id: MANAGE-017
title: "Cannot revoke another user's token"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.account.tokens.$hash.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

Revocation is ownership-guarded by the caller's subject. Targeting a hash that belongs to
another user is reported as not found and does not delete anything.

## Acceptance criteria

### MANAGE-017-AC1 , Revoking a token owned by another user returns not found
```gherkin
Given a signed-in user and a token hash H that belongs to a different subject
When the user DELETEs /api/account/tokens/H
Then the endpoint responds 404 Not Found
And the other user's token is not removed
```
