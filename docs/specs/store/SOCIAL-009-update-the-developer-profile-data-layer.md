---
id: SOCIAL-009
title: "Update the developer profile (data layer)"
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

The signed-in developer updates their own profile display name, bio and website.
The update is an upsert keyed by the developer id, so it creates the profile row
if none exists. The website must be a valid URL and fields have length limits.

## Acceptance criteria

### SOCIAL-009-AC1 , Anonymous profile update is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends PUT /api/account/profile
Then the response status is 401
And no profile field is changed
```

### SOCIAL-009-AC2 , A valid update is persisted and returned
```gherkin
Given a signed-in developer
When the developer sends PUT /api/account/profile with displayName "Octo Cat", bio "Hi" and website "https://o.dev"
Then the response status is 200
And a subsequent read returns displayName "Octo Cat", bio "Hi" and website "https://o.dev"
```

### SOCIAL-009-AC3 , An invalid update is rejected
```gherkin
Given a signed-in developer
When the developer sends PUT /api/account/profile with a website that is not a valid URL
Then the response status is 400
And no profile field is changed
```
