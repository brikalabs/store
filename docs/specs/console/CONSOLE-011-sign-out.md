---
id: CONSOLE-011
title: "Sign-out"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.account.tokens.tsx
    - apps/web/src/routes/auth.logout.ts
  tests: []
---

## Description

The account tokens page shows the signed-in identity and a Sign out link that
ends the session via `/auth/logout`.

## Acceptance criteria

### CONSOLE-011-AC1 , Sign-out link ends the session
```gherkin
Given the user is on /dashboard/account/tokens
When the user activates the Sign out link
Then the browser navigates to /auth/logout
And the session is cleared (a subsequent /dashboard request redirects to sign-in per CONSOLE-001-AC2)
```
