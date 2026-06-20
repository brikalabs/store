---
id: CONSOLE-003
title: "My plugins list"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.plugins.index.tsx
    - apps/web/src/routes/api/plugins/mine.ts
    - apps/web/src/lib/use-my-plugins.ts
  tests: []
---

## Description

`/dashboard/plugins` lists the plugins the signed-in developer maintains, one row
each, with icon, display name, version, a Published badge, capability count, and
an edit link. The list is sourced from ownership, not an npm maintainer search:
`GET /api/plugins/mine` resolves the user's scopes via `listScopesForMember` and
filters the registry catalog to plugins published under a scope they own. An empty
state shows when the user owns no published plugins.

## Acceptance criteria

### CONSOLE-003-AC1 , My plugins route renders the table
```gherkin
Given the user is signed in
When the user opens /dashboard/plugins
Then the My plugins page renders a table with column headers Plugin, Status, and Capabilities
```

### CONSOLE-003-AC2 , One row per owned plugin
```gherkin
Given GET /api/plugins/mine returns N plugins published under the user's scopes
When the My plugins table renders
Then it shows N rows
And each row shows the plugin display name, version, a Published badge, and a verified mark when the plugin is verified
```

### CONSOLE-003-AC3 , Empty state when no plugins
```gherkin
Given GET /api/plugins/mine returns no plugins
When the My plugins table renders
Then it shows the "No published plugins yet" empty state instead of rows
```

### CONSOLE-003-AC4 , Row edit link opens the plugin editor
```gherkin
Given a plugin row is rendered
When the user activates the row edit control
Then the app navigates to /dashboard/plugins/<name>
```
