---
id: REG-008
title: "Catalog list with pagination and text search"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/catalog.ts
    - packages/db/src/adapters/d1-catalog.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

`GET /-/v1/packages` is Brika's addition to the npm protocol (which has no list
endpoint), so the storefront can enumerate plugins. It returns each package's
latest visible version with its publisher and download stats, paginated and
optionally filtered by free text.

## Acceptance criteria

### REG-008-AC1 , 200 with packages array and total count
```gherkin
Given two published packages exist
When a client sends GET /-/v1/packages
Then the response status is 200
And the body has a "packages" array and a numeric "total"
And each "packages" entry has "name", "version", "manifest", and "publishedAt"
```

### REG-008-AC2 , entries carry verified publisher and download stats
```gherkin
Given a published package owned by a claimed, verified scope
When a client reads its entry in the catalog response
Then the entry has "publisher" with "id", "name", and "verified" equal to true
And the entry has "downloads" with numeric "total" and "weekly"
```

### REG-008-AC3 , limit defaults to 50 and is clamped to 1..250
```gherkin
Given more than 250 published packages exist
When a client sends GET /-/v1/packages with no limit
Then at most 50 entries are returned
When a client sends GET /-/v1/packages?limit=1000
Then at most 250 entries are returned
When a client sends GET /-/v1/packages?limit=0
Then at least 1 entry is returned
```

### REG-008-AC4 , offset paginates and total is the unpaginated match count
```gherkin
Given 3 published packages match the query
When a client sends GET /-/v1/packages?limit=2&offset=2
Then the "packages" array contains the 3rd matching entry only
And "total" equals 3
```

### REG-008-AC5 , text search matches name, displayName, description, and keywords
```gherkin
Given a package whose manifest description contains "weather"
And a package with no "weather" in any searched field
When a client sends GET /-/v1/packages?text=WEATHER
Then only the weather package appears in "packages"
And the match is case-insensitive across name, displayName, description, and keywords
```
