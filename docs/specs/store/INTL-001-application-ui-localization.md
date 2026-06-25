---
id: INTL-001
title: "Application UI localization (en/fr)"
status: done
area: intl
group: store
test_mode: unit
traceability:
  code:
    - packages/i18n/src/index.ts
    - apps/web/src/i18n/config.ts
    - apps/web/src/server/i18n.ts
    - apps/web/src/server/locale.ts
  tests: []
---

## Description

The store UI is fully localized (English and French) by the generic `@brika/i18n`
ICU engine: one `defineI18n` call assembles the runtime from per-locale JSON folders.
All locale strings live in `apps/web/locales/<code>/`; the package itself stays
string-free. The request locale is resolved server-side and injected (`ServerT`,
`RequestLocale`) so SSR renders in the right language with no client round-trip.

## Acceptance criteria

### INTL-001-AC1 , default locale when nothing is specified
```gherkin
Given a request with no locale cookie and no Accept-Language header
When the page is rendered
Then the resolved locale is the default "en"
And the UI text is English
```

### INTL-001-AC2 , the locale cookie selects the language
```gherkin
Given a request carrying the "brika-locale=fr" cookie
When the page is rendered
Then the resolved locale is "fr"
And the UI text is French
```

### INTL-001-AC3 , Accept-Language is negotiated when no cookie is set
```gherkin
Given a request with no locale cookie and an "Accept-Language: fr" header
When the page is rendered
Then the resolved locale is "fr"
```

### INTL-001-AC4 , SSR renders in the resolved locale via the injected translator
```gherkin
Given a request resolved to locale "fr"
When a backend handler injects the per-request translator (ServerT)
Then translating a "namespace:key" returns the French message for that request
And a concurrent request in "en" is unaffected
```

### INTL-001-AC5 , an unsupported locale falls back to the default
```gherkin
Given a request asking for a locale with no "locales/<code>" folder
When the page is rendered
Then the resolved locale falls back to the default "en"
And no untranslated key placeholder is shown
```
