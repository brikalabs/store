---
id: STORE-002
title: "Browse all plugins"
status: done
area: store
group: store
test_mode: e2e
traceability:
  code:
    - apps/web/src/routes/plugins.index.tsx
    - apps/web/src/components/discover-index.tsx
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

`GET /plugins` lists plugins. With no query it shows the dense discovery index
(filter rail, grid, trending/authors sidebar); with a `?q=` query it shows a
results header, an authors section, and a sorted grid of matching plugins.

## Acceptance criteria

### STORE-002-AC1 , Browse without a query renders the discovery index
```gherkin
Given a visitor requests GET /plugins with no q parameter
When the page is server-rendered
Then the response is 200 HTML
And the page shows the "Browse plugins" discovery index
```

### STORE-002-AC2 , A registry-published plugin surfaces in browse results
```gherkin
Given the registry has published @brika/plugin-i18n titled "i18n Toolkit"
When a visitor requests GET /plugins?q=i18n
Then the rendered results contain "i18n Toolkit"
```

### STORE-002-AC3 , A results query shows authors and a result count
```gherkin
Given a query that matches at least one plugin
When a visitor requests GET /plugins?q=<term>
Then the results header shows the query term and a plugin count
And matching authors (up to 3) are shown with a "View profile" link to /developers/<id>
```

### STORE-002-AC4 , No matches shows an empty state
```gherkin
Given a query that matches no plugins
When a visitor requests GET /plugins?q=<term>
Then the page shows a "No plugins found" empty state
```
