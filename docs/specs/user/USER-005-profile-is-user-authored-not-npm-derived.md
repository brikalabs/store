---
id: USER-005
title: "Profile data is user-authored, never derived from npm"
status: todo
area: user
group: user
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

The account profile (display name, bio, avatar, links) is **user-authored** and stored on the
account. It is NEVER synthesised from npm `maintainer` data or any npm-derived base. This
explicitly supersedes the retired npm-maintainer-derived profile (the gone `STORE-004`, whose
profile overlaid D1 edits on an npm-derived base keyed by `maintainer:<id>`): there is no
npm-derived base anymore, only the account's own fields.

## Acceptance criteria

### USER-005-AC1 , Profile fields come only from the account
```gherkin
Given an account with a user-authored profile
When the profile is read for display (USER-002) or editing (USER-003)
Then every field comes from the account's stored profile
And no field is synthesised from npm maintainer data
```

### USER-005-AC2 , An unset field is empty, not back-filled from npm
```gherkin
Given a user has not set a bio (or any optional profile field)
When the profile is read
Then that field is empty/absent
And it is not back-filled from an npm-derived source
```

### USER-005-AC3 , No npm-maintainer base overlay exists
```gherkin
Given the account profile model
When the profile is resolved
Then there is no npm-maintainer base that D1 edits overlay (unlike the gone STORE-004)
And the account fields are the sole source of truth
```
