---
id: STORE-002
title: "Browse all plugins"
status: done
area: store
group: store
test_mode: e2e
traceability:
  code:
    - apps/web/src/routes/packages/index.tsx
    - apps/web/src/components/plugin/discover-index.tsx
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

`GET /packages` lists plugins, reading only the Brika registry catalog
(`searchPlugins` -> `listRegistryPlugins`; npm is not a discovery source). With no
query it shows the dense discovery index (filter rail, grid, trending sidebar); with
a `?q=` query it shows a results header, a matching-scopes section, and a sorted grid
of matching plugins. Results are grouped by scope: matching scopes link to the scope
page (`/@scope`), not a developer profile.

## Acceptance criteria

### STORE-002-AC1 , Browse without a query renders the discovery index
```gherkin
Given a visitor requests GET /packages with no q parameter
When the page is server-rendered
Then the response is 200 HTML
And the page shows the "Browse packages" discovery index
```

### STORE-002-AC2 , A registry-published plugin surfaces in browse results
```gherkin
Given the registry has published @brika/plugin-i18n titled "i18n Toolkit"
When a visitor requests GET /packages?q=i18n
Then the rendered results contain "i18n Toolkit"
```

### STORE-002-AC3 , A results query shows matching scopes and a result count
```gherkin
Given a query that matches at least one plugin
When a visitor requests GET /packages?q=<term>
Then the results header shows the query term and a plugin count
And matching scopes (up to 3) are shown with a "View scope" link to /@<scope>
```

### STORE-002-AC4 , No matches shows an empty state
```gherkin
Given a query that matches no plugins
When a visitor requests GET /packages?q=<term>
Then the page shows a "No plugins found" empty state
```
