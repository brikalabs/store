---
id: AUTH-012
title: "BetterAuth-backed session (DB-backed, D1 adapter)"
status: done
area: auth
group: auth
test_mode: manual
traceability:
  code:
    - apps/web/src/server/auth.ts:getAuth
    - apps/web/src/lib/auth/auth.ts:getCurrentUser
    - apps/web/src/server/db/schema.ts:session
    - apps/web/src/server/db/schema.ts:account
    - apps/web/src/server/db/schema.ts:verification
    - apps/web/drizzle/0001_betterauth.sql
  tests: []
---

## Description

Sessions are DB-backed via BetterAuth's Drizzle/D1 adapter on the Worker: the canonical
`users` (adapted), `session`, `account`, and `verification` tables are stored in D1
(`apps/web/src/server/db/schema.ts`, provisioned by `apps/web/drizzle/0001_betterauth.sql`).
A session cookie references a server-side `session` row (created at sign-in, deleted at
sign-out, expiring at its stored expiry) rather than the prior stateless `<userId>.<hmac>`
token (`AUTH-003`, now `gone`). `getCurrentUser` (`apps/web/src/lib/auth/auth.ts`) resolves
the BetterAuth session into a `SessionUser`. This supersedes the stateless session and absorbs
who-am-i (`AUTH-005`) and sign-out (`AUTH-006`) into BetterAuth's session endpoints.

## Acceptance criteria

### AUTH-012-AC1 , Sign-in creates a session row and a referencing cookie
```gherkin
Given a successful provider sign-in
When the session is established
Then a session row is written to the D1 session table for the account
And a hardened session cookie (HttpOnly, SameSite=Lax, Secure on https, Path=/) is set referencing it
```

### AUTH-012-AC2 , A valid session resolves to its account
```gherkin
Given a request carrying a valid session cookie whose session row exists and is unexpired
When the session is resolved
Then it resolves to the owning account
```

### AUTH-012-AC3 , A revoked or expired session does not resolve
```gherkin
Given a session cookie whose session row was deleted (sign-out) or whose expiry has passed
When the session is resolved
Then it resolves to no account
```

### AUTH-012-AC4 , Sign-out deletes the session row
```gherkin
Given a signed-in user signs out
When the handler runs
Then the corresponding session row is removed from D1
And the session cookie is expired (Max-Age=0)
```

### AUTH-012-AC5 , The canonical BetterAuth tables back the model
```gherkin
Given the BetterAuth Drizzle/D1 adapter is configured
When the schema is applied
Then user, session, account, and verification tables exist in D1
And provider identities are stored in account rows referencing a user row
```
