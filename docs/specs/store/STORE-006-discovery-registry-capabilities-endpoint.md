---
id: STORE-006
title: "Discovery: registry capabilities endpoint"
status: done
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.registry.ts
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

`GET /v1/registry` is the contract handshake: a consumer reads it to discover the
store name, contract version, and the set of supported features before calling
other endpoints.

## Acceptance criteria

### STORE-006-AC1 , Capabilities advertise the contract version and feature set
```gherkin
Given a request GET /v1/registry
When the handler runs
Then the response status is 200
And the JSON body has a "name", a "contractVersion", and a "features" array
And "features" includes search, plugins, versions, readme, icon, verified, profiles, reviews, and comments
And the cache-control header is "public, max-age=300"
```
