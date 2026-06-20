---
id: STORE-001
title: "Home / discover page"
status: done
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/index.tsx
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

The store landing page (`GET /`) loads a page of plugins server-side and presents
discovery rails: a featured plugin, a featured rail, a trending rail, and a
browse-by-capability section. It is the entry point into browse and detail.

## Acceptance criteria

### STORE-001-AC1 , Home renders server-side with a page of plugins
```gherkin
Given a visitor requests GET /
When the page is server-rendered
Then the response is 200 HTML
And the loader has fetched a page of plugin summaries (searchPlugins with no query)
And the rendered HTML contains the marketplace headline and a total plugin count
```

### STORE-001-AC2 , Home offers entry points into browse and search
```gherkin
Given the home page is rendered
When the visitor reads the hero
Then there is a link to browse all plugins (/plugins)
And there is a control to search the store
```

### STORE-001-AC3 , Browse-by-capability tiles cover the five capability kinds
```gherkin
Given the home page is rendered
When the visitor reaches the browse-by-capability section
Then there are tiles for Tools, Blocks, Bricks, Sparks, and Pages
```
