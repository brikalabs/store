---
id: CONSOLE-010
title: "API tokens list, create-once, and revoke"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.account.tokens.tsx
    - apps/web/src/routes/api.account.tokens.ts
    - api.account.tokens.$hash.ts
  tests: []
---

## Description

`/dashboard/account/tokens` lists the user's publish tokens (fingerprint and
dates only; plaintext is never stored), lets the user create a token whose
plaintext is shown exactly once, and revoke a token by its hash. Enforces MANAGE
token rules; revoke is subject-scoped so a user can only revoke their own token.

## Acceptance criteria

### CONSOLE-010-AC1 , Tokens route lists the user's tokens
```gherkin
Given the user is signed in
When the user opens /dashboard/account/tokens
Then GET /api/account/tokens is fetched
And each token is listed by its fingerprint with created, expires, and last-used dates
```

### CONSOLE-010-AC2 , Empty state when no tokens
```gherkin
Given GET /api/account/tokens returns an empty list
When the token list renders
Then it shows the "No tokens yet" empty state
```

### CONSOLE-010-AC3 , Creating a token shows the plaintext once
```gherkin
Given the user clicks New token
Then POST /api/account/tokens is sent
And on a 201 the plaintext token is shown once in a copyable panel with a "won't be shown again" warning
And the token list reloads to include the new token's fingerprint
```

### CONSOLE-010-AC4 , Revoking a token removes it from the list
```gherkin
Given a token row is rendered
When the user activates its revoke control
Then DELETE /api/account/tokens/<hash> is sent
And on a 200 the token list reloads without that token
```
