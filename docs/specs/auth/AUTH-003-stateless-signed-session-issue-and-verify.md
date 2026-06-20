---
id: AUTH-003
title: "Stateless signed session: issue and verify"
status: done
area: auth
group: auth
test_mode: unit
traceability:
  code:
    - apps/web/src/lib/session.ts
    - apps/web/src/lib/auth.ts
  tests:
    - apps/web/src/lib/session.test.ts
---

## Description

The session is stateless: the `brika_session` value is `<userId>.<hmac>`, where the HMAC is
computed over the user id with `SESSION_SECRET` (HMAC-SHA-256). Verification recomputes the
HMAC and compares in constant time. No session table is read or written.

## Acceptance criteria

### AUTH-003-AC1 , A signed token round-trips back to the user id
```gherkin
Given a token produced by signing user id gh_42 with the session secret
When the token is verified with the same secret
Then verification returns gh_42
```

### AUTH-003-AC2 , A tampered or wrongly-signed token is rejected
```gherkin
Given a brika_session token whose HMAC does not match its user id
When the token is verified
Then verification returns null
Given a token signed with a different secret
When the token is verified with the session secret
Then verification returns null
```

### AUTH-003-AC3 , A malformed token shape is rejected
```gherkin
Given a token with no separating dot, or an empty user-id segment before the dot
When the token is verified
Then verification returns null
```

### AUTH-003-AC4 , The session cookie carries hardened attributes
```gherkin
Given the session cookie is built for an https request
When the Set-Cookie string is produced
Then it sets brika_session and includes HttpOnly, SameSite=Lax, Path=/, Secure, and Max-Age=2592000 (30 days)
```

### AUTH-003-AC5 , A request with no session cookie has no session user
```gherkin
Given an incoming request that carries no brika_session cookie
When the session user id is resolved
Then it resolves to null
```
