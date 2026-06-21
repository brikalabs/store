---
id: AUTH-002
title: "GitHub OAuth sign-in: callback"
status: done
area: auth
group: auth
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/auth.github.callback.ts
    - apps/web/src/lib/github.ts
  tests:
    - apps/web/src/lib/github.test.ts
---

## Description

> **Planned supersession:** replaced by BetterAuth multi-provider auth (the provider callback, see `AUTH-010`). Still `done` and accurate for current production; not retired until BetterAuth ships.

`GET /auth/github/callback` finishes the flow: it validates the returned state against the
state cookie, exchanges the code for a token, fetches the GitHub user, upserts the user row,
marks the developer verified, sets the `brika_session` cookie, and redirects to the saved
safe return path.

## Acceptance criteria

### AUTH-002-AC1 , Rejects a missing or mismatched state
```gherkin
Given a request to GET /auth/github/callback whose state does not match the brika_oauth_state cookie
When the handler runs
Then the response status is 400
And no brika_session Set-Cookie header is emitted
```

### AUTH-002-AC2 , Rejects a missing code or state parameter
```gherkin
Given a request to GET /auth/github/callback with no code parameter
When the handler runs
Then the response status is 400
And no brika_session Set-Cookie header is emitted
```

### AUTH-002-AC3 , Surfaces a failed code-for-token exchange
```gherkin
Given a valid matching state but GitHub rejects the authorization code exchange
When the handler runs
Then the response status is 502
And no brika_session Set-Cookie header is emitted
```

### AUTH-002-AC4 , Surfaces a failed user fetch
```gherkin
Given a successful token exchange but the GitHub user endpoint cannot be loaded
When the handler runs
Then the response status is 502
And no brika_session Set-Cookie header is emitted
```

### AUTH-002-AC5 , On success, persists the user and issues the session
```gherkin
Given a valid matching state, a successful token exchange, and a fetched GitHub user
When the handler runs
Then a users row keyed gh_<githubId> is upserted with the login, name, and avatar
And the developer with that login is marked verified
And a Set-Cookie header sets brika_session to a signed token for gh_<githubId>
And the response status is 302
```

### AUTH-002-AC6 , On success, redirects to the remembered safe return path and clears it
```gherkin
Given a successful callback whose brika_oauth_return cookie holds /dashboard/scopes
When the handler runs
Then the Location header is /dashboard/scopes
And a Set-Cookie header expires brika_oauth_return (Max-Age=0)
Given the same callback with no brika_oauth_return cookie
When the handler runs
Then the Location header is /
```
