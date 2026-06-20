---
id: CONSOLE-012
title: "Profile editor"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.profile.tsx
    - apps/web/src/routes/api.account.profile.ts
  tests: []
---

## Description

`/dashboard/profile` loads the developer's own public profile and lets them edit
display name, bio, and website. Saves via `PUT /api/account/profile` (enforces
SOCIAL profile rules), then reflects the persisted result.

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

### CONSOLE-012-AC3 , Profile links to the public developer page
```gherkin
Given the profile editor is rendered
When the user activates the View public profile link
Then the app navigates to /developers/<id>
```
