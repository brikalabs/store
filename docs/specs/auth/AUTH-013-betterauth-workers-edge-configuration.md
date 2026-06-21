---
id: AUTH-013
title: "BetterAuth Workers/D1 configuration and migration"
status: todo
area: auth
group: auth
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

Running BetterAuth on Cloudflare Workers requires edge-specific configuration: the auth
secret and per-provider client id/secret as Worker secrets, the D1 binding wired through the
Drizzle adapter for session/account/user/verification storage, a configured trusted origin /
base URL for CSRF protection, and a one-time migration that creates the BetterAuth tables.
This replaces the `SESSION_SECRET` + `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` config that
fed the hand-rolled flow (`AUTH-009`); the registry CLI/publish secrets are unaffected.

## Acceptance criteria

### AUTH-013-AC1 , Boot fails fast without the required auth secrets
```gherkin
Given the BetterAuth secret or a configured provider's client id/secret is missing
When the config is validated at boot
Then validation fails rather than serving requests with an unconfigured auth stack
```

### AUTH-013-AC2 , Sessions are stored in D1 via the bound database
```gherkin
Given the Worker has its D1 binding wired through the BetterAuth Drizzle adapter
When a session is created
Then it is persisted in the D1 session table (not in worker memory or a signed cookie alone)
```

### AUTH-013-AC3 , CSRF is enforced via a configured trusted origin
```gherkin
Given BetterAuth is configured with the console base URL as a trusted origin
When a state-changing auth request arrives from an untrusted origin
Then it is rejected
```

### AUTH-013-AC4 , A migration provisions the BetterAuth tables
```gherkin
Given a deployment that has not yet run the BetterAuth migration
When the migration is applied to D1
Then the user, session, account, and verification tables are created
And the schema is verified against the live D1 after deploy (migrations are not auto-run on deploy)
```
