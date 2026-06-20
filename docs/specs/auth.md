# AUTH , Authentication & sessions

> How a developer signs in to Brika and stays signed in. Sign-in is GitHub OAuth
> (Authorization Code flow); the session is a stateless, HMAC-signed `brika_session`
> cookie (no session table). This domain also covers the open-redirect guard on the
> post-login return path, the who-am-I endpoint, sign-out, the server-side console
> auth guard (redirect before render, no login flash), the store side of the CLI
> device-authorization approval (RFC 8628), and the required OAuth/secret config.

Status legend and the code scheme live in [README](./README.md).

---

## AUTH-001 , GitHub OAuth sign-in: initiate

- **Status:** [DONE]
- **Area:** OAuth / initiate
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/auth.github.ts` (handler), `apps/web/src/lib/github.ts` (authorizeUrl) - `apps/web/src/lib/github.test.ts`

`GET /auth/github` starts the Authorization Code flow: it mints a CSRF state, stashes a
safe return path, sets both as short-lived cookies, and redirects to GitHub's authorize
endpoint. An optional `?return=<path>` is remembered so the callback can land the user back
where they started (e.g. `/device?code=...`).

**AUTH-001-AC1** , Redirects to GitHub authorize with the OAuth parameters
```gherkin
Given a client requests GET /auth/github
When the handler runs
Then the response status is 302
And the Location header points to https://github.com/login/oauth/authorize
And the Location carries client_id, redirect_uri, state, and scope=read:user query parameters
```

**AUTH-001-AC2** , Sets a short-lived CSRF state cookie
```gherkin
Given a client requests GET /auth/github
When the handler runs
Then a Set-Cookie header sets brika_oauth_state
And that cookie carries HttpOnly, SameSite=Lax, Path=/, and Max-Age=600
And the same state value appears in the authorize Location's state parameter
```

**AUTH-001-AC3** , Remembers a safe return path for after sign-in
```gherkin
Given a client requests GET /auth/github?return=/dashboard/scopes
When the handler runs
Then a Set-Cookie header sets brika_oauth_return to the URL-encoded value of /dashboard/scopes
And that cookie carries HttpOnly, SameSite=Lax, Path=/, and Max-Age=600
```

**AUTH-001-AC4** , A hostile return path is neutralised at initiate
```gherkin
Given a client requests GET /auth/github?return=https://evil.example/phish
When the handler runs
Then the brika_oauth_return cookie value is / (the safe default), not the absolute URL
```

**AUTH-001-AC5** , Secure attribute tracks the request scheme
```gherkin
Given a client requests GET /auth/github over https
When the handler runs
Then every Set-Cookie header includes the Secure attribute
Given the same request over http (local dev)
When the handler runs
Then no Set-Cookie header includes the Secure attribute
```

---

## AUTH-002 , GitHub OAuth sign-in: callback

- **Status:** [DONE]
- **Area:** OAuth / callback
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/auth.github.callback.ts` (handler), `apps/web/src/lib/github.ts` (exchangeCode, fetchUser) - `apps/web/src/lib/github.test.ts`

`GET /auth/github/callback` finishes the flow: it validates the returned state against the
state cookie, exchanges the code for a token, fetches the GitHub user, upserts the user row,
marks the developer verified, sets the `brika_session` cookie, and redirects to the saved
safe return path.

**AUTH-002-AC1** , Rejects a missing or mismatched state
```gherkin
Given a request to GET /auth/github/callback whose state does not match the brika_oauth_state cookie
When the handler runs
Then the response status is 400
And no brika_session Set-Cookie header is emitted
```

**AUTH-002-AC2** , Rejects a missing code or state parameter
```gherkin
Given a request to GET /auth/github/callback with no code parameter
When the handler runs
Then the response status is 400
And no brika_session Set-Cookie header is emitted
```

**AUTH-002-AC3** , Surfaces a failed code-for-token exchange
```gherkin
Given a valid matching state but GitHub rejects the authorization code exchange
When the handler runs
Then the response status is 502
And no brika_session Set-Cookie header is emitted
```

**AUTH-002-AC4** , Surfaces a failed user fetch
```gherkin
Given a successful token exchange but the GitHub user endpoint cannot be loaded
When the handler runs
Then the response status is 502
And no brika_session Set-Cookie header is emitted
```

**AUTH-002-AC5** , On success, persists the user and issues the session
```gherkin
Given a valid matching state, a successful token exchange, and a fetched GitHub user
When the handler runs
Then a users row keyed gh_<githubId> is upserted with the login, name, and avatar
And the developer with that login is marked verified
And a Set-Cookie header sets brika_session to a signed token for gh_<githubId>
And the response status is 302
```

**AUTH-002-AC6** , On success, redirects to the remembered safe return path and clears it
```gherkin
Given a successful callback whose brika_oauth_return cookie holds /dashboard/scopes
When the handler runs
Then the Location header is /dashboard/scopes
And a Set-Cookie header expires brika_oauth_return (Max-Age=0)
Given the same callback with no brika_oauth_return cookie
When the handler runs
Then the Location header is /
```

---

## AUTH-003 , Stateless signed session: issue and verify

- **Status:** [DONE]
- **Area:** Session / cookie
- **Test mode:** unit
- **Traceability:** `apps/web/src/lib/session.ts` (signSession, verifySession), `apps/web/src/lib/auth.ts` (sessionCookie, getSessionUserId) - `apps/web/src/lib/session.test.ts`

The session is stateless: the `brika_session` value is `<userId>.<hmac>`, where the HMAC is
computed over the user id with `SESSION_SECRET` (HMAC-SHA-256). Verification recomputes the
HMAC and compares in constant time. No session table is read or written.

**AUTH-003-AC1** , A signed token round-trips back to the user id
```gherkin
Given a token produced by signing user id gh_42 with the session secret
When the token is verified with the same secret
Then verification returns gh_42
```

**AUTH-003-AC2** , A tampered or wrongly-signed token is rejected
```gherkin
Given a brika_session token whose HMAC does not match its user id
When the token is verified
Then verification returns null
Given a token signed with a different secret
When the token is verified with the session secret
Then verification returns null
```

**AUTH-003-AC3** , A malformed token shape is rejected
```gherkin
Given a token with no separating dot, or an empty user-id segment before the dot
When the token is verified
Then verification returns null
```

**AUTH-003-AC4** , The session cookie carries hardened attributes
```gherkin
Given the session cookie is built for an https request
When the Set-Cookie string is produced
Then it sets brika_session and includes HttpOnly, SameSite=Lax, Path=/, Secure, and Max-Age=2592000 (30 days)
```

**AUTH-003-AC5** , A request with no session cookie has no session user
```gherkin
Given an incoming request that carries no brika_session cookie
When the session user id is resolved
Then it resolves to null
```

---

## AUTH-004 , Open-redirect-safe return path

- **Status:** [DONE]
- **Area:** Security / open-redirect guard
- **Test mode:** unit
- **Traceability:** `apps/web/src/lib/auth-cookies.ts` (safeReturnPath, parseCookies) - `apps/web/src/lib/auth-cookies.test.ts`

`safeReturnPath` is the single guard that keeps the OAuth `?return=` round-trip from becoming
an open redirect. Only a same-site path beginning with a single `/` is honoured; everything
else falls back to `/`. The cookie parser never throws on a garbled `Cookie` header.

**AUTH-004-AC1** , A same-site path is preserved
```gherkin
Given a return value of /dashboard/scopes
When it is passed through the safe-return guard
Then the result is /dashboard/scopes unchanged
```

**AUTH-004-AC2** , Absolute and protocol-relative URLs fall back to root
```gherkin
Given a return value of https://evil.example/phish or //evil.example
When it is passed through the safe-return guard
Then the result is /
```

**AUTH-004-AC3** , Missing or non-path input falls back to root
```gherkin
Given a return value that is null, undefined, or a string not starting with /
When it is passed through the safe-return guard
Then the result is /
```

**AUTH-004-AC4** , A malformed cookie header does not crash request handling
```gherkin
Given a Cookie header containing a percent-encoding that cannot be decoded
When the cookies are parsed
Then parsing does not throw
And the offending value is returned in its raw form
```

---

## AUTH-005 , Who am I

- **Status:** [DONE]
- **Area:** Session / identity endpoint
- **Test mode:** none
- **Traceability:** `apps/web/src/routes/auth.me.ts` (handler), `apps/web/src/lib/auth.ts` (getCurrentUser) - , (not yet built)

`GET /auth/me` returns the signed-in user (id, login, name, avatarUrl) or `null`. The response
is never cached.

**AUTH-005-AC1** , Returns the user for a valid session
```gherkin
Given a request carrying a valid brika_session cookie for an existing user
When GET /auth/me is called
Then the response is 200 with JSON { "user": { id, login, name, avatarUrl } }
And the Cache-Control header is no-store
```

**AUTH-005-AC2** , Returns null with no session
```gherkin
Given a request with no brika_session cookie
When GET /auth/me is called
Then the response is 200 with JSON { "user": null }
And the Cache-Control header is no-store
```

**AUTH-005-AC3** , Returns null when the session user no longer exists
```gherkin
Given a valid brika_session cookie whose user id has no matching users row
When GET /auth/me is called
Then the response is 200 with JSON { "user": null }
```

---

## AUTH-006 , Sign out

- **Status:** [DONE]
- **Area:** Session / logout
- **Test mode:** none
- **Traceability:** `apps/web/src/routes/auth.logout.ts` (handler), `apps/web/src/lib/auth.ts` (clearSessionCookie) - , (not yet built)

`GET /auth/logout` clears the session cookie and returns the user home.

**AUTH-006-AC1** , Clears the session cookie and redirects home
```gherkin
Given a signed-in client requests GET /auth/logout
When the handler runs
Then the response status is 302
And the Location header is /
And a Set-Cookie header expires brika_session (empty value, Max-Age=0, Path=/)
```

**AUTH-006-AC2** , After sign-out the session no longer resolves
```gherkin
Given the browser has applied the sign-out Set-Cookie
When GET /auth/me is called next
Then the response JSON is { "user": null }
```

---

## AUTH-007 , Server-side console auth guard

- **Status:** [DONE]
- **Area:** Console / route guard
- **Test mode:** manual
- **Traceability:** `apps/web/src/lib/require-user.ts` (requireUser, fetchSessionUser), `apps/web/src/routes/dashboard.tsx` (beforeLoad) - , (not yet built)

The console (`/dashboard` and its children) is gated server-side in the `/dashboard`
`beforeLoad`. An unauthenticated visit throws a redirect to GitHub OAuth carrying an encoded
`?return=`, before any client render, so there is no LoginCard flash. The resolved user is
placed on the route context and inherited by every child route. Verified in-browser:
unauthenticated `/dashboard/scopes` returns 307 to
`/auth/github?return=%2Fdashboard%2Fscopes`.

**AUTH-007-AC1** , Unauthenticated console access redirects to sign-in carrying the return path
```gherkin
Given a visitor with no valid session navigates to /dashboard/scopes
When the /dashboard beforeLoad guard runs
Then the navigation is redirected to /auth/github?return=%2Fdashboard%2Fscopes
And no console UI (and no login-card flash) is rendered before the redirect
```

**AUTH-007-AC2** , Authenticated console access renders with the user on context
```gherkin
Given a visitor with a valid session navigates to a /dashboard route
When the guard runs
Then no redirect occurs
And the signed-in user is available on the route context to the child route
```

**AUTH-007-AC3** , After sign-in the visitor returns to the originally requested path
```gherkin
Given an unauthenticated visit to /dashboard/scopes was redirected to sign-in
When the visitor completes GitHub OAuth
Then the OAuth callback redirects them to /dashboard/scopes
```

---

## AUTH-008 , CLI device-authorization approval (store side)

- **Status:** [DONE]
- **Area:** Device flow / approval (RFC 8628)
- **Test mode:** none
- **Traceability:** `apps/web/src/routes/device.tsx` (OTP page), `apps/web/src/routes/api.device.approve.ts` (handler), `apps/web/src/lib/device-approval.ts` (approveDeviceCode) - , (not yet built)

`brika login` opens a device-authorization (RFC 8628). The store renders `/device` (an
8-character OTP form) and exposes `POST /api/device/approve`, which is session-gated and binds
the signed-in user's GitHub login to the pending device record so the CLI can mint a publish
token. The approval is a single race-free conditional UPDATE: it only matches a code that is
unexpired and not yet approved.

**AUTH-008-AC1** , Approving requires a signed-in user
```gherkin
Given a POST /api/device/approve with no valid session
When the handler runs
Then the response is 401 Unauthorized
And no device record is approved
```

**AUTH-008-AC2** , A malformed approval body is rejected
```gherkin
Given a signed-in user POSTs /api/device/approve with a body missing user_code
When the handler runs
Then the response is 400 Bad Request
```

**AUTH-008-AC3** , A valid code is approved and bound to the user's login
```gherkin
Given a signed-in user POSTs /api/device/approve with a user_code for a pending, unexpired device record
When the handler runs
Then the reg_device_auth row for that code is set approved=true with the user's githubLogin
And the response is 200 with JSON { "ok": true }
```

**AUTH-008-AC4** , An invalid, expired, or already-used code is a safe no-op
```gherkin
Given a signed-in user POSTs /api/device/approve with a code that is unknown, expired, or already approved
When the handler runs
Then no device record is modified
And the response is 400 with a message that the code is invalid, expired, or already used
```

**AUTH-008-AC5** , The device page gates the OTP form behind sign-in
```gherkin
Given a visitor opens /device?code=BR7K-MNPQ while not signed in
When the page renders
Then it shows a "Sign in with GitHub to continue" action linking to /auth/github?return=/device?code=BR7K-MNPQ
And the approve action is not available until the visitor is signed in
```

---

## AUTH-009 , OAuth and secret configuration

- **Status:** [HOLD]
- **Area:** Config / secrets
- **Test mode:** none
- **Traceability:** `apps/web/src/lib/env.ts` (vars schema) - , (not yet built)

Authentication requires a registered GitHub OAuth app and the matching secrets/vars. The
schema in `env.ts` validates `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
(required, no default) and `GITHUB_REDIRECT_URI` (defaulting to the production callback).
Provisioning the GitHub OAuth app and loading the secrets into the deployment is blocked on
operator credentials.

**AUTH-009-AC1** , Boot fails fast when a required auth secret is missing
```gherkin
Given the environment is missing SESSION_SECRET, GITHUB_CLIENT_ID, or GITHUB_CLIENT_SECRET
When the config is read via vars()
Then validation fails rather than serving requests with an unconfigured auth stack
```

**AUTH-009-AC2** , The redirect URI defaults to production and is overridable for local dev
```gherkin
Given GITHUB_REDIRECT_URI is not set
When the config is read
Then it defaults to https://store.brika.dev/auth/github/callback
Given GITHUB_REDIRECT_URI is set to http://localhost:3000/auth/github/callback
When the config is read
Then that local value is used
```

**AUTH-009-AC3** , The GitHub OAuth app is registered and secrets are deployed
```gherkin
Given an operator with GitHub org and deployment credentials
When the GitHub OAuth app is created and its client id/secret plus SESSION_SECRET are loaded into the deployment
Then the live callback URL matches GITHUB_REDIRECT_URI
And a real GitHub sign-in completes end to end against the deployed app
```
