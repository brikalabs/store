---
id: STORE-003
title: "Plugin detail page"
status: done
area: store
group: store
test_mode: e2e
traceability:
  code:
    - apps/web/src/routes/plugins.$.tsx
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

`GET /plugins/<name>` renders a plugin's detail: header (icon, title, author,
version, rating, install command), a default Overview tab, and routed tabs for
Permissions, Supply chain, Versions, Reviews, and Discussion. A sidebar with
downloads, metadata, and links persists across tabs.

## Acceptance criteria

### STORE-003-AC1 , Detail renders server-side with the install command
```gherkin
Given the registry has published @brika/plugin-i18n
When a visitor requests GET /plugins/@brika/plugin-i18n
Then the response is 200 HTML
And the heading shows the display name "i18n Toolkit"
And the rendered page contains the package name "@brika/plugin-i18n" in the install command
And the Overview readme content is rendered
```

### STORE-003-AC2 , An unknown plugin returns a not-found page
```gherkin
Given no plugin named @brika/does-not-exist exists in the registry or npm
When a visitor requests GET /plugins/@brika/does-not-exist
Then the page renders a not-found state (no detail header)
```

### STORE-003-AC3 , Tabs are routed via the URL and the panel follows
```gherkin
Given the detail page for @brika/plugin-i18n is open on Overview
When the visitor clicks the Versions tab
Then the URL gains ?tab=versions
And the Changelog panel is shown
And the Overview "Capabilities" heading is no longer shown
```

### STORE-003-AC4 , A tab is deep-linkable via SSR
```gherkin
Given a visitor requests GET /plugins/@brika/plugin-i18n?tab=reviews
When the page is server-rendered
Then the Reviews panel is shown directly
```

### STORE-003-AC5 , Overview lists capabilities and translations
```gherkin
Given the detail page Overview tab for a plugin that declares capabilities and locales
When the Overview panel renders
Then a Capabilities section is shown
And a localization section states the number of languages the plugin ships
```

### STORE-003-AC6 , Versions panel badges latest and deprecated, hides yanked
```gherkin
Given @brika/plugin-managed has a latest v1.2.0, a deprecated v1.1.0, and a yanked v1.0.0
When a visitor requests GET /plugins/@brika/plugin-managed?tab=versions
Then v1.2.0 is shown with a "Latest" badge
And v1.1.0 is shown with a "Deprecated" badge
And v1.0.0 (yanked) is not shown
```

### STORE-003-AC7 , Detail shows a real install count and a downloads trend chart
```gherkin
Given @brika/plugin-i18n has recorded installs
When a visitor requests GET /plugins/@brika/plugin-i18n
Then the page shows a numeric install count
And the sidebar shows a "Total downloads" card with a trend chart
```
