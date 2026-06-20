---
id: MANAGE-015
title: "List my tokens (metadata only)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.account.tokens.ts
  tests:
    - packages/db/src/adapters/queries.test.ts
---

## Description

A user lists their own tokens by metadata only. The plaintext is never returned by the
listing; only the hash and timestamps are exposed, and only for the caller's own subject.

## Acceptance criteria

### MANAGE-015-AC1 , Listing tokens returns metadata only, scoped to the caller
```gherkin
Given a signed-in user with one or more issued tokens
When the user GETs /api/account/tokens
Then the response lists only that user's tokens
And each entry carries the token hash, createdAt, expiresAt, and lastUsedAt
And no entry carries the plaintext token
```
