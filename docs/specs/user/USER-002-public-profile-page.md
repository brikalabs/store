---
id: USER-002
title: "Public profile page at /u/:id"
status: done
area: user
group: user
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/u/$id.tsx
    - apps/web/src/lib/social/social.ts:getUserProfile
    - apps/web/src/lib/social/social.ts:listReviewsByUser
  tests: []
---

## Description

`GET store.brika.dev/u/:id` renders an account's public profile, keyed by its stable opaque
account id (NOT a username/handle: there is no uniqueness or claim flow). It shows the
user-authored profile (display name, bio, avatar, links, see `USER-003`/`USER-005`), the
plugins the account publishes (derived by ownership: account -> scope memberships -> owned
scopes -> their catalog plugins), and the account's reviews. It REPLACES the retired
npm-maintainer profile at `/developers/:id` (see the gone `STORE-004`).

## Acceptance criteria

### USER-002-AC1 , The profile page renders for a known account id
```gherkin
Given an account with id <accountId> exists
When a visitor requests GET /u/<accountId>
Then the response is 200 HTML
And it shows the account's display name (or a fallback) and avatar
```

### USER-002-AC2 , Published plugins are derived from owned scopes
```gherkin
Given the account owns scopes that have published, listed plugins
When a visitor requests GET /u/<accountId>
Then a plugins section lists one entry per published plugin across the account's owned scopes
And the listing is derived live (no stored pluginCount)
```

### USER-002-AC3 , The account's reviews are shown
```gherkin
Given the account has authored reviews
When a visitor requests GET /u/<accountId>
Then a reviews section shows the reviews authored by that account
```

### USER-002-AC4 , An unknown account id is 404
```gherkin
Given no account exists with id <accountId>
When a visitor requests GET /u/<accountId>
Then the response is 404
```

### USER-002-AC5 , The id is opaque, not a claimable handle
```gherkin
Given the profile is addressed by the stable opaque account id
When the page is rendered
Then it is not addressed by a unique username/handle
And there is no uniqueness or claim flow for the id
```
