---
id: STORE-005
title: "Discovery: search endpoint"
status: done
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.search.ts
    - apps/web/src/lib/registry.ts
  tests:
    - apps/web/src/lib/registry.test.ts
---

## Description

`GET /v1/search` is the machine-readable search contract. It validates the query
against `SearchQuery`, returns a list of plugin summaries plus a total, and is
cacheable. It supports free-text queries and field-qualified queries such as
`q=maintainer:<login>`.

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

### STORE-005-AC3 , A maintainer-qualified query scopes results to that maintainer
```gherkin
Given a request GET /v1/search?q=maintainer:<login>
When the handler runs
Then the response status is 200
And the returned plugins are limited to those published by <login>
```

### STORE-005-AC4 , limit and offset paginate the results
```gherkin
Given a request GET /v1/search?q=<term>&limit=<n>&offset=<m>
When the handler runs
Then at most <n> plugins are returned
And the page begins at offset <m>
```
