---
id: AUTH-005
title: "Who am I"
status: done
area: auth
group: auth
test_mode: none
traceability:
  code:
    - apps/web/src/routes/auth/me.ts
    - apps/web/src/lib/auth/auth.ts:getCurrentUser
  tests: []
---

## Description

`GET /auth/me` returns the signed-in user (id, login, name, avatarUrl) or `null`. The response
is never cached.

> **Now BetterAuth-backed:** the route is retained as a convenience JSON shim, but the session
> is resolved by `getCurrentUser` (`apps/web/src/lib/auth/auth.ts`) over the BetterAuth
> DB-backed session (`AUTH-012`), not the old stateless cookie. The behaviour below is unchanged.

## Acceptance criteria

### AUTH-005-AC1 , Returns the user for a valid session
```gherkin
Given a request carrying a valid brika_session cookie for an existing user
When GET /auth/me is called
Then the response is 200 with JSON { "user": { id, login, name, avatarUrl } }
And the Cache-Control header is no-store
```

### AUTH-005-AC2 , Returns null with no session
```gherkin
Given a request with no brika_session cookie
When GET /auth/me is called
Then the response is 200 with JSON { "user": null }
And the Cache-Control header is no-store
```

### AUTH-005-AC3 , Returns null when the session user no longer exists
```gherkin
Given a valid brika_session cookie whose user id has no matching users row
When GET /auth/me is called
Then the response is 200 with JSON { "user": null }
```
