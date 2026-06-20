---
id: STORE-015
title: "Public scope page"
status: done
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/$.tsx
    - apps/web/src/components/plugin/scope-page.tsx
    - apps/web/src/lib/registry/registry.ts
  tests: []
---

## Description

`GET /@scope` renders a scope's public page: a header with the scope's verified
publisher (the scope's `display_name`) and a Verified badge, scope stats, and a
grid of every plugin published under that scope. The data is read from the same
registry catalog as browse (`getScopePage` filters `listRegistryPlugins` by scope),
so cards carry real install counts. The page is the publisher surface that replaced
the retired developer profile (STORE-004); a scope with no listed plugin 404s.

## Acceptance criteria

### STORE-015-AC1 , Scope page lists the scope's plugins
```gherkin
Given the registry has plugins published under @brika
When a visitor requests GET /@brika
Then the response is 200 HTML
And a grid shows one card per plugin published under @brika
And the header shows the scope's plugin count
```

### STORE-015-AC2 , A verified scope shows the publisher and a verified badge
```gherkin
Given @brika is owned by a verified publisher named "Brika Labs"
When a visitor requests GET /@brika
Then the header shows the display name "Brika Labs"
And a Verified badge is shown
```

### STORE-015-AC3 , A scope with no listed plugins 404s
```gherkin
Given no plugin is published under @empty-scope
When a visitor requests GET /@empty-scope
Then the page renders a not-found state (no scope header)
```
