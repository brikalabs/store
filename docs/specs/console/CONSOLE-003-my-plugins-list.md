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
    - apps/web/src/lib/use-my-plugins.ts
  tests: []
---

## Description

`/dashboard/plugins` lists the plugins the signed-in developer maintains, one row
each, with icon, display name, version, a Published badge, capability count, and
an edit link. An empty state shows when the maintainer has no plugins.

## Acceptance criteria

### CONSOLE-003-AC1 , My plugins route renders the table
```gherkin
Given the user is signed in
When the user opens /dashboard/plugins
Then the My plugins page renders a table with column headers Plugin, Status, and Capabilities
```

### CONSOLE-003-AC2 , One row per maintained plugin
```gherkin
Given the maintainer query returns N plugins
When the My plugins table renders
Then it shows N rows
And each row shows the plugin display name, version, a Published badge, and a verified mark when the plugin is verified
```

### CONSOLE-003-AC3 , Empty state when no plugins
```gherkin
Given the maintainer query returns no plugins
When the My plugins table renders
Then it shows the "No published plugins yet" empty state instead of rows
```

### CONSOLE-003-AC4 , Row edit link opens the plugin editor
```gherkin
Given a plugin row is rendered
When the user activates the row edit control
Then the app navigates to /dashboard/plugins/<name>
```
