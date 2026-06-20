---
id: CONSOLE-006
title: "Scopes list"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.scopes.tsx
    - apps/web/src/routes/api.scopes.ts
  tests: []
---

## Description

`/dashboard/scopes` lists the scopes the signed-in user belongs to, with the
scope name, verified display name (when set), and the user's role, each linking to
the scope detail page. Reads `GET /api/scopes`.

## Acceptance criteria

### CONSOLE-006-AC1 , Scopes route lists the user's scopes
```gherkin
Given the user is signed in and belongs to one or more scopes
When the user opens /dashboard/scopes
Then GET /api/scopes is fetched
And each scope is listed with its name and the user's role (admin or member)
```

### CONSOLE-006-AC2 , Empty state when the user belongs to no scope
```gherkin
Given GET /api/scopes returns an empty list
When the scopes list renders
Then it shows the "you don't belong to any scope yet" empty state
```

### CONSOLE-006-AC3 , A scope row links to its detail page
```gherkin
Given a scope row is rendered
When the user activates the row
Then the app navigates to /dashboard/scopes/<scope>
```
