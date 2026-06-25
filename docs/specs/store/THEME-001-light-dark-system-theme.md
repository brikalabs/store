---
id: THEME-001
title: "Light / dark / system theme with no-flash SSR"
status: done
area: theme
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/hooks/use-theme.ts
    - apps/web/src/server/theme.ts
  tests: []
---

## Description

The store supports an explicit light or dark theme, or "system" to follow the OS
`prefers-color-scheme`. The choice is stored in a cookie (not localStorage) so the
server can read it at SSR and render the matching `data-mode` with no hydration
flash; "system" and the unset case resolve on the client from the OS preference.

## Acceptance criteria

### THEME-001-AC1 , default to system when nothing is chosen
```gherkin
Given a visitor with no theme cookie
When the page loads
Then the applied theme follows the OS prefers-color-scheme
```

### THEME-001-AC2 , an explicit choice persists across reloads
```gherkin
Given a visitor selects the "dark" theme
When they reload the page later
Then the theme cookie still reads "dark"
And the page renders dark
```

### THEME-001-AC3 , an explicit theme renders at SSR with no flash
```gherkin
Given a request carrying an explicit "light" or "dark" theme cookie
When the document is server-rendered
Then the root element's data-mode already matches that theme before hydration
```

### THEME-001-AC4 , system mode tracks the OS preference live
```gherkin
Given the theme mode is "system"
When the OS switches between light and dark
Then the applied theme follows the OS preference without a reload
```
