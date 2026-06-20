---
id: STORE-016
title: "Scope-centric URL scheme"
status: done
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/$.tsx
    - apps/web/src/routes/plugins/index.tsx
  tests: []
---

## Description

The storefront uses JSR-style root URLs. Every package is scoped and a scope starts
with `@` (no other top-level route does), so the `/$` catch-all resolves `/@scope`
to the scope's package listing (STORE-015) and `/@scope/name` to the plugin detail
page (STORE-003). Browse lives at its own path, `/plugins`. Anything not starting
with `@` (and not a real route) 404s. The retired `/developers/:id` and
`/v1/developers/:id` routes were removed.

## Acceptance criteria

### STORE-016-AC1 , A bare scope resolves to the scope listing
```gherkin
Given the registry has plugins published under @brika
When a visitor requests GET /@brika
Then the scope listing page is rendered (not a plugin detail)
```

### STORE-016-AC2 , A scoped package path resolves to the plugin detail
```gherkin
Given @brika/plugin-i18n is published
When a visitor requests GET /@brika/plugin-i18n
Then the plugin detail page is rendered
```

### STORE-016-AC3 , Browse lives at /plugins
```gherkin
Given a visitor requests GET /plugins
Then the response is 200 HTML
And the browse discovery index is rendered
```

### STORE-016-AC4 , A non-scope catch-all path 404s
```gherkin
Given a visitor requests GET /not-a-scope
When the catch-all loader runs
Then a not-found state is rendered (the splat does not start with "@")
```
