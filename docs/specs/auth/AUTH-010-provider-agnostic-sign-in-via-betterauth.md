---
id: AUTH-010
title: "Provider-agnostic sign-in via BetterAuth"
status: todo
area: auth
group: auth
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

Console sign-in is provider-agnostic, served by BetterAuth's social-provider plugin on the
Cloudflare Worker. GitHub ships first; additional providers (Google, GitLab, etc.) are added
by configuration with no new bespoke route per provider. This supersedes the hand-rolled
GitHub-only Authorization Code flow (`AUTH-001`/`AUTH-002`). The CLI device-authorization +
publish-token / OIDC path (`AUTH-008`, `PUB-016`) is a separate registry concern and is NOT
served by BetterAuth.

## Acceptance criteria

### AUTH-010-AC1 , Sign-in initiates against a configured provider
```gherkin
Given GitHub is a configured BetterAuth social provider
When a client starts sign-in for provider github
Then the response is a 302 redirect to GitHub's authorize endpoint
And the redirect carries the OAuth state and the configured callback URL
```

### AUTH-010-AC2 , Adding a provider needs no new bespoke route
```gherkin
Given a second provider (e.g. google) is added to the BetterAuth social-provider config
When a client starts sign-in for provider google
Then sign-in initiates against that provider through the same shared BetterAuth handler
And no provider-specific initiate/callback route was hand-written
```

### AUTH-010-AC3 , The provider callback completes sign-in and lands on a safe path
```gherkin
Given a successful provider callback with valid state
When the BetterAuth handler runs
Then a session is established for the resolved account
And the visitor is redirected to a same-site return path (never an absolute URL)
```

### AUTH-010-AC4 , An unconfigured provider is rejected
```gherkin
Given a client starts sign-in for a provider that is not configured
When the handler runs
Then the response is a 400 and no sign-in is initiated
```
