---
id: STORE-017
title: "Legal and policy pages"
status: done
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/legal/index.tsx
    - apps/web/src/routes/legal/terms.tsx
    - apps/web/src/routes/legal/privacy.tsx
    - apps/web/src/routes/legal/cookies.tsx
    - apps/web/src/routes/legal/acceptable-use.tsx
    - apps/web/src/routes/legal/licenses.tsx
  tests: []
---

## Description

The store publishes its legal and policy pages: terms of service, privacy policy,
cookie policy, acceptable-use policy, and third-party licenses, plus a legal index.
They are public (no session required) and localized like the rest of the UI.

## Acceptance criteria

### STORE-017-AC1 , the legal pages are publicly reachable
```gherkin
Given a visitor with no session
When they open any legal page (terms, privacy, cookies, acceptable-use, licenses)
Then the page renders its policy content
```

### STORE-017-AC2 , the legal content is localized
```gherkin
Given the UI locale is "fr"
When a legal page is opened
Then its content is shown in French
```
