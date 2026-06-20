---
id: STORE-005
title: "Discovery: search endpoint"
status: done
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1/search.ts
    - apps/web/src/lib/registry/registry.ts
  tests:
    - apps/web/src/lib/registry.test.ts
---

## Description

`GET /v1/search` is the machine-readable search contract. It validates the query
against `SearchQuery`, returns a list of plugin summaries plus a total, and is
cacheable. It is registry-only: the free-text query is matched against the Brika
registry catalog (`searchPlugins` -> `listRegistryPlugins`), which searches the
published `@scope/name` packages; npm is not a source.

## Acceptance criteria

### STORE-005-AC1 , Search returns plugins and a total with a cache header
```gherkin
Given a valid request GET /v1/search?q=icon
When the handler runs
Then the response status is 200
And the JSON body has a "plugins" array and a numeric "total"
And the cache-control header is "public, max-age=300"
```

### STORE-005-AC2 , An invalid query is rejected
```gherkin
Given a request GET /v1/search with parameters that fail SearchQuery validation
When the handler runs
Then the response status is 400
And the JSON body is { "error": "Invalid search query" }
```

### STORE-005-AC3 , A free-text query matches published registry packages
```gherkin
Given a request GET /v1/search?q=<term>
When the handler runs
Then the response status is 200
And the returned plugins are drawn only from the Brika registry catalog (no npm results)
And they are limited to packages matching <term>
```

### STORE-005-AC4 , limit and offset paginate the results
```gherkin
Given a request GET /v1/search?q=<term>&limit=<n>&offset=<m>
When the handler runs
Then at most <n> plugins are returned
And the page begins at offset <m>
```
