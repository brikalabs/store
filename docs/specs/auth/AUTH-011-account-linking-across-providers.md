---
id: AUTH-011
title: "Account linking (one account, multiple provider identities)"
status: todo
area: auth
group: auth
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

One Brika account can carry multiple provider identities (e.g. GitHub and Google) via
BetterAuth account linking. A new provider identity links to the existing account rather than
minting a duplicate, and a signed-in user can link an additional provider to their current
account. See `USER-004` for the console link/unlink surface; this spec covers the auth-layer
linking semantics.

## Acceptance criteria

### AUTH-011-AC1 , A new provider links to the matching account
```gherkin
Given an existing account already has a GitHub identity with verified email a@example.com
When the same person signs in with Google whose verified email is a@example.com
And account linking is enabled for trusted (verified-email) providers
Then the Google identity is linked to the existing account
And no second account is created
```

### AUTH-011-AC2 , A signed-in user links an additional provider
```gherkin
Given a user is signed in to their account
When they complete the link flow for a second provider
Then a new account-provider row is stored referencing their account id
And both provider identities resolve to the same account on subsequent sign-in
```

### AUTH-011-AC3 , Linking a provider already bound elsewhere is refused
```gherkin
Given a provider identity is already linked to a different account
When a user attempts to link that same provider identity to their account
Then the link is refused
And neither account's identities are changed
```

### AUTH-011-AC4 , Untrusted auto-link is not performed silently
```gherkin
Given a provider sign-in whose email is unverified or the provider is not trusted for auto-link
When sign-in completes
Then the identity is not silently merged into an existing account by email
```
