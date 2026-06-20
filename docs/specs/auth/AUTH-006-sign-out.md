---
id: AUTH-006
title: "Sign out"
status: done
area: auth
group: auth
test_mode: none
traceability:
  code:
    - apps/web/src/routes/auth.logout.ts
    - apps/web/src/lib/auth.ts
  tests: []
---

## Description

`GET /auth/logout` clears the session cookie and returns the user home.

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
