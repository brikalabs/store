---
id: CONSOLE-009
title: "Verified display-name editor (admin-only)"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.scopes_.$scope.tsx
    - apps/web/src/routes/api.scopes.$scope.display-name.ts
  tests: []
---

## Description

On the scope detail page, admins get a Verified publisher name editor that sets
the trusted name shown on every package in the scope. The card is hidden for
non-admins. Sends `POST /api/scopes/:scope/display-name` (enforces SCOPE verified
display-name rules; blank clears it).

## Acceptance criteria

### CONSOLE-009-AC1 , Editor visible only to admins
```gherkin
Given the user opens the scope detail page
When the user is an admin of the scope
Then the Verified publisher name editor is shown
And when the user is a non-admin member, the editor is not shown
```

### CONSOLE-009-AC2 , Admin sets the verified display name
```gherkin
Given an admin enters a display name and submits
When the request is sent
Then POST /api/scopes/<scope>/display-name is sent with the name
And on a 200 the button shows a Saved confirmation
```

### CONSOLE-009-AC3 , Submitting blank clears the verified name
```gherkin
Given an admin clears the display-name field and submits
When the request is sent
Then POST /api/scopes/<scope>/display-name is sent with a null displayName
And on a 200 the verified name is cleared
```
