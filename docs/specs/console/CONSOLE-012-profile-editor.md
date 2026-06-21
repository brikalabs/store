---
id: CONSOLE-012
title: "Profile editor"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard/profile.tsx
    - apps/web/src/routes/api/account/profile.ts
    - apps/web/src/lib/social/social.ts:updateUserProfile
  tests: []
---

## Description

`/dashboard/profile` loads the signed-in user's own **account** profile and lets them
edit display name, bio, and website/links. It edits the account profile directly (the
account is the first-class identity, `USER-001`), not a separate "developer" row.
Saves via `PUT /api/account/profile` (enforces the profile rules), then reflects the
persisted result. The profile is user-authored and never derived from npm (`USER-005`);
the public surface for this profile is the account page `/u/:id` (`USER-002`). This is
the console surface backing the account profile-editor behaviour in `USER-003`. (The
old standalone npm-maintainer developer page was retired, see the gone `STORE-004`.)

## Acceptance criteria

### CONSOLE-012-AC1 , Profile route loads the current profile
```gherkin
Given the user is signed in
When the user opens /dashboard/profile
Then GET /api/account/profile is fetched
And the editor is populated with the current display name, bio, and website
```

### CONSOLE-012-AC2 , Saving the profile persists and confirms
```gherkin
Given the user edits the display name, bio, or website and submits
When PUT /api/account/profile is sent with the trimmed values
Then on a 200 the editor updates to the persisted profile
And a Saved confirmation is shown
```

### CONSOLE-012-AC3 , Profile shows the public account page link
```gherkin
Given the profile editor is rendered
Then it shows a link to the account's public page /u/<accountId> and the avatar
```
