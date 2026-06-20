---
id: STORE-008
title: "Discovery: version history endpoint"
status: done
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.versions.ts
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/src/lib/registry.test.ts
---

## Description

`GET /v1/plugins/<name>/versions` returns the full release history, newest first,
each entry carrying its published date, Brika engine constraint, and deprecation
message (if any).

## Acceptance criteria

### STORE-008-AC1 , Versions returns the release history newest-first
```gherkin
Given @brika/plugin-managed has multiple published versions
When a client requests GET /v1/plugins/%40brika%2Fplugin-managed/versions
Then the response status is 200
And the JSON body is an array of versions ordered newest-first
And the cache-control header is "public, max-age=300"
```

### STORE-008-AC2 , Versions for an unknown plugin returns 404
```gherkin
Given no plugin named @brika/does-not-exist exists
When a client requests GET /v1/plugins/%40brika%2Fdoes-not-exist/versions
Then the response status is 404
And the JSON body is { "error": "Not found" }
```
