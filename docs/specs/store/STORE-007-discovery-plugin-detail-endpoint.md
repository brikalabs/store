---
id: STORE-007
title: "Discovery: plugin detail endpoint"
status: done
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.ts
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/src/lib/registry.test.ts
---

## Description

`GET /v1/plugins/<name>` returns the machine-readable `PluginDetail`. The name is
URL-encoded and may be scoped (`@org/name`). Registry packages resolve first; npm
is the fallback.

## Acceptance criteria

### STORE-007-AC1 , Detail returns PluginDetail for a known plugin
```gherkin
Given the plugin @brika/plugin-i18n exists
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n
Then the response status is 200
And the JSON body is a PluginDetail object for that plugin
And the cache-control header is "public, max-age=300"
```

### STORE-007-AC2 , An unknown plugin returns 404
```gherkin
Given no plugin named @brika/does-not-exist exists in the registry or npm
When a client requests GET /v1/plugins/%40brika%2Fdoes-not-exist
Then the response status is 404
And the JSON body is { "error": "Not found" }
```
