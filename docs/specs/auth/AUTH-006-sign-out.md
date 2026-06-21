---
id: AUTH-006
title: "Sign out"
status: done
area: auth
group: auth
test_mode: none
traceability:
  code:
    - apps/web/src/routes/auth/logout.ts
    - apps/web/src/server/auth.ts:getAuth
  tests: []
---

## Description

`GET /auth/logout` clears the session cookie and returns the user home.

> **Now BetterAuth-backed:** the route is retained as a GET shim (existing links keep working),
> but it delegates to BetterAuth's `signOut`, which deletes the D1 `session` row and expires
> the session cookie (`AUTH-012-AC4`). The behaviour below is unchanged.

## Acceptance criteria

### AUTH-006-AC1 , Clears the session cookie and redirects home
```gherkin
Given a signed-in client requests GET /auth/logout
When the handler runs
Then the response status is 302
And the Location header is /
And a Set-Cookie header expires brika_session (empty value, Max-Age=0, Path=/)
```

### AUTH-006-AC2 , After sign-out the session no longer resolves
```gherkin
Given the browser has applied the sign-out Set-Cookie
When GET /auth/me is called next
Then the response JSON is { "user": null }
```
