---
id: STORE-010
title: "Localized store copy, readme, and changelog"
status: done
area: store
group: store
test_mode: e2e
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.readme.ts
    - apps/web/src/lib/registry-source.ts
    - apps/web/src/lib/manifest-mapping.ts
    - @brika/schema
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

Store copy (title, description, screenshot captions via StoreLocaleSchema) plus the
readme and changelog are served per-locale, with English as the fallback. The
detail page exposes a locale switcher driven by the `?lang=` parameter; the readme
endpoint accepts `?lang=` and resolves the closest available doc.

## Acceptance criteria

### STORE-010-AC1 , Localized copy renders for a requested locale
```gherkin
Given @brika/plugin-i18n ships a French store locale
When a visitor requests GET /plugins/@brika/plugin-i18n?lang=fr
Then the rendered page shows the French localized title
```

### STORE-010-AC2 , Locale resolution falls back to English then the first available
```gherkin
Given a plugin declares localized docs as a locale-to-path map
When pickDocPath resolves a requested locale that is not present
Then the English (en) doc path is chosen if present
And otherwise the first declared locale's path is chosen
```

### STORE-010-AC3 , The readme endpoint serves the requested locale
```gherkin
Given @brika/plugin-i18n ships a localized readme
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/readme?lang=fr
Then the response status is 200
And the JSON body has "readme" (the French markdown, or null if absent) and "filename": "README.md"
And the cache-control header is "public, max-age=300"
```
