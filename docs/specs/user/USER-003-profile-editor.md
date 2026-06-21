---
id: USER-003
title: "Account profile editor"
status: done
area: user
group: user
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/dashboard/profile.tsx
    - apps/web/src/routes/api/account/profile.ts
    - apps/web/src/lib/social/social.ts:getUserProfile
    - apps/web/src/lib/social/social.ts:updateUserProfile
    - packages/contract/src/index.ts:UserProfile
  tests: []
---

## Description

A signed-in user edits their own account profile: display name, bio, avatar, and links. The
edited fields are the user-authored profile surfaced on the public page (`USER-002`) and are
never derived from npm (`USER-005`). This re-frames the existing console profile editor
(`CONSOLE-012`) onto the account/user model: it edits the account profile, not a "developer"
row. `CONSOLE-012` is the console-surface spec; this is the account-model behaviour it backs.

## Acceptance criteria

### USER-003-AC1 , The editor loads the account's current profile
```gherkin
Given a signed-in user opens their profile editor
When the current profile is loaded
Then the editor is populated with the account's display name, bio, avatar, and links
```

### USER-003-AC2 , Saving persists user-authored fields to the account
```gherkin
Given a signed-in user edits display name, bio, avatar, or links and submits
When the save is sent
Then on success the account profile is updated with the trimmed values
And the persisted profile is reflected back
```

### USER-003-AC3 , A user can only edit their own account profile
```gherkin
Given a signed-in user
When they save a profile edit
Then the edit is applied to their own account only
And they cannot edit another account's profile
```
