---
id: AUTH-001
title: "GitHub OAuth sign-in: initiate"
status: gone
area: auth
group: auth
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/auth.github.ts
    - apps/web/src/lib/github.ts
  tests:
    - apps/web/src/lib/github.test.ts
---

## Description

> **Superseded/removed:** replaced by BetterAuth provider-agnostic sign-in (`AUTH-010`, now `done`). The hand-rolled `GET /auth/github` initiate route (`apps/web/src/routes/auth.github.ts`) was deleted; sign-in now goes through BetterAuth's `/api/auth/*` handler. Retained for history.

`GET /auth/github` starts the Authorization Code flow: it mints a CSRF state, stashes a
safe return path, sets both as short-lived cookies, and redirects to GitHub's authorize
endpoint. An optional `?return=<path>` is remembered so the callback can land the user back
where they started (e.g. `/device?code=...`).

## Acceptance criteria

### AUTH-001-AC1 , Redirects to GitHub authorize with the OAuth parameters
```gherkin
Given a client requests GET /auth/github
When the handler runs
Then the response status is 302
And the Location header points to https://github.com/login/oauth/authorize
And the Location carries client_id, redirect_uri, state, and scope=read:user query parameters
```

### AUTH-001-AC2 , Sets a short-lived CSRF state cookie
```gherkin
Given a client requests GET /auth/github
When the handler runs
Then a Set-Cookie header sets brika_oauth_state
And that cookie carries HttpOnly, SameSite=Lax, Path=/, and Max-Age=600
And the same state value appears in the authorize Location's state parameter
```

### AUTH-001-AC3 , Remembers a safe return path for after sign-in
```gherkin
Given a client requests GET /auth/github?return=/dashboard/scopes
When the handler runs
Then a Set-Cookie header sets brika_oauth_return to the URL-encoded value of /dashboard/scopes
And that cookie carries HttpOnly, SameSite=Lax, Path=/, and Max-Age=600
```

### AUTH-001-AC4 , A hostile return path is neutralised at initiate
```gherkin
Given a client requests GET /auth/github?return=https://evil.example/phish
When the handler runs
Then the brika_oauth_return cookie value is / (the safe default), not the absolute URL
```

### AUTH-001-AC5 , Secure attribute tracks the request scheme
```gherkin
Given a client requests GET /auth/github over https
When the handler runs
Then every Set-Cookie header includes the Secure attribute
Given the same request over http (local dev)
When the handler runs
Then no Set-Cookie header includes the Secure attribute
```
