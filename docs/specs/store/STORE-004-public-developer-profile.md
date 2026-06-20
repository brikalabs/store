---
id: STORE-004
title: "Public developer profile"
status: done
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/developers.$id.tsx
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

`GET /developers/<id>` renders a maintainer's public profile: avatar, display name,
verified badge, bio and links, aggregate stats, and a grid of the maintainer's
published plugins. The maintainer's plugins are resolved via a `maintainer:<id>`
search; D1-stored profile edits (bio, display name, website, verification) overlay
the npm-derived base.

## Acceptance criteria

### STORE-004-AC1 , Profile renders the maintainer header and stats
```gherkin
Given a maintainer with id <login> has published plugins
When a visitor requests GET /developers/<login>
Then the response is 200 HTML
And the page shows the maintainer display name (or id) and an @<login> handle
And the page shows a plugin count
```

### STORE-004-AC2 , Profile lists the maintainer's published plugins
```gherkin
Given the maintainer <login> has published plugins
When a visitor requests GET /developers/<login>
Then a "Plugins" grid is shown with one card per published plugin
```

### STORE-004-AC3 , A maintainer with no plugins shows an empty state
```gherkin
Given the maintainer <login> has no published Brika plugins
When a visitor requests GET /developers/<login>
Then the page shows a "No published Brika plugins found" message
```
