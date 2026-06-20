---
id: SOCIAL-008
title: "Read the developer profile (data layer)"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.account.profile.ts
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social-data.test.ts
---

## Description

The store owns the developer profile data (display name, bio, website, avatar,
github login, verified flag, plugin count). The signed-in developer reads their
own profile, keyed by their GitHub login. The display name defaults to the
developer id when none has been set. (The profile edit UI lives in CONSOLE; this
spec covers the data and endpoint behaviour only.)

## Acceptance criteria

### SOCIAL-008-AC1 , Anonymous profile read is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends GET /api/account/profile
Then the response status is 401
```

### SOCIAL-008-AC2 , The profile defaults to the developer id
```gherkin
Given a developer with id "octo" and no stored profile fields
When the developer profile for "octo" is read
Then the displayName is "octo"
```

### SOCIAL-008-AC3 , A signed-in developer reads their own profile
```gherkin
Given a signed-in developer whose GitHub login is "octo"
When the developer sends GET /api/account/profile
Then the response status is 200
And the body is the profile keyed by "octo"
```
