---
id: USER-001
title: "User account is the first-class identity"
status: todo
area: user
group: user
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

The first-class identity is a Brika **user account** with a stable, opaque account id. It is
NOT a GitHub user row keyed by `gh_<githubId>`. Provider identities (GitHub now; others later)
link to the account (see `AUTH-011`); the account, not any single provider, is what owns
scope memberships, authors reviews, and carries a profile. The retired `developers` table is
folded into the account; there is no `pluginCount` column (published plugins are derived live
from owned scopes, see `USER-002`).

## Acceptance criteria

### USER-001-AC1 , The account has a stable opaque id, not a provider id
```gherkin
Given a person signs in for the first time via any provider
When their account is created
Then the account has a stable opaque id that is not derived from the provider's user id
And that id remains stable if they later link or unlink a provider
```

### USER-001-AC2 , Provider identities reference the account
```gherkin
Given an account exists
When a provider identity is linked to it
Then the provider identity row references the account id
And resolving any linked provider identity yields the same account
```

### USER-001-AC3 , The account is the subject of memberships and authored content
```gherkin
Given an account that belongs to one or more scopes and has authored reviews
When ownership or authorship is resolved
Then it resolves to the account id (not to a provider-specific id)
```

### USER-001-AC4 , No separate developers table, no stored pluginCount
```gherkin
Given the account model
When a user's published plugins are needed
Then they are derived live from the scopes the account owns (USER-002)
And there is no developers table and no stored pluginCount field
```
