---
id: AUTH-009
title: "OAuth and secret configuration"
status: hold
area: auth
group: auth
test_mode: none
traceability:
  code:
    - apps/web/src/lib/env.ts
  tests: []
---

## Description

Authentication requires a registered GitHub OAuth app and the matching secrets/vars. The
schema in `env.ts` validates `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
(required, no default) and `GITHUB_REDIRECT_URI` (defaulting to the production callback).
Provisioning the GitHub OAuth app and loading the secrets into the deployment is blocked on
operator credentials.

## Acceptance criteria

### AUTH-009-AC1 , Boot fails fast when a required auth secret is missing
```gherkin
Given the environment is missing SESSION_SECRET, GITHUB_CLIENT_ID, or GITHUB_CLIENT_SECRET
When the config is read via vars()
Then validation fails rather than serving requests with an unconfigured auth stack
```

### AUTH-009-AC2 , The redirect URI defaults to production and is overridable for local dev
```gherkin
Given GITHUB_REDIRECT_URI is not set
When the config is read
Then it defaults to https://store.brika.dev/auth/github/callback
Given GITHUB_REDIRECT_URI is set to http://localhost:3000/auth/github/callback
When the config is read
Then that local value is used
```

### AUTH-009-AC3 , The GitHub OAuth app is registered and secrets are deployed
```gherkin
Given an operator with GitHub org and deployment credentials
When the GitHub OAuth app is created and its client id/secret plus SESSION_SECRET are loaded into the deployment
Then the live callback URL matches GITHUB_REDIRECT_URI
And a real GitHub sign-in completes end to end against the deployed app
```
