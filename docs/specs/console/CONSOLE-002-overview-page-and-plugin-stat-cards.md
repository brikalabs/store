---
id: CONSOLE-002
title: "Overview page and plugin stat cards"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.index.tsx
    - apps/web/src/lib/use-my-plugins.ts
  tests: []
---

## Description

`/dashboard` (the index route) renders the Overview: a greeting, four stat cards
derived from the maintainer's plugins (total plugins, weekly downloads, average
rating, verified count), a link to My plugins, and a "Publish from GitHub" guide
with a copyable workflow snippet.

## Acceptance criteria

### CONSOLE-002-AC1 , Overview route renders the four stat cards
```gherkin
Given the user is signed in
When the user opens /dashboard
Then the Overview page renders with stat cards labelled Total plugins, Weekly downloads, Avg rating, and Verified
```

### CONSOLE-002-AC2 , Stat cards reflect the maintainer's plugins
```gherkin
Given the maintainer query (maintainer:<login>) returns the user's plugins
When the Overview loads its stats from use-my-plugins
Then Total plugins shows the count of returned plugins
And Weekly downloads, Avg rating, and Verified are computed from those plugins (a dot placeholder when there is nothing to show)
```

### CONSOLE-002-AC3 , Total plugins card links to My plugins
```gherkin
Given the Overview page is rendered
When the user activates the Total plugins card or the Manage my plugins link
Then the app navigates to /dashboard/plugins
```

### CONSOLE-002-AC4 , Publish-from-GitHub snippet is copyable
```gherkin
Given the Overview page is rendered
When the user clicks the copy control on the Publish from GitHub workflow block
Then the workflow YAML is written to the clipboard
And the control shows a copied confirmation state
```
