---
id: REG-001
title: "Fetch full packument"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/packument.ts
    - apps/registry/src/controllers/packages.ts
  tests:
    - packages/registry-core/src/packument.test.ts
---

## Description

`GET /:name` (scoped or unscoped) returns the npm-shaped full packument: every
visible version, dist-tags, publish times, and per-version `dist` (tarball URL,
integrity, shasum). Unknown packages are a clean 404.

## Acceptance criteria

### REG-001-AC1 , 200 with full packument document
```gherkin
Given a published package "@brika/plugin-weather" with versions 1.0.0 and 1.1.0
When a client sends GET /@brika/plugin-weather with no special Accept header
Then the response status is 200
And the Content-Type is "application/json"
And the body "name" equals "@brika/plugin-weather"
And the body has a "dist-tags" object and a "versions" object keyed by version string
And "versions" contains keys "1.0.0" and "1.1.0"
```

### REG-001-AC2 , each version carries a complete dist block
```gherkin
Given the full packument for "@brika/plugin-weather"
When the client reads versions["1.1.0"].dist
Then "dist.tarball" is an absolute URL ending "/@brika/plugin-weather/-/plugin-weather-1.1.0.tgz"
And "dist.integrity" is a string of the form "sha512-<base64>"
And "dist.shasum" is a SHA-1 hex string
```

### REG-001-AC3 , publish times are present
```gherkin
Given the full packument for "@brika/plugin-weather"
When the client reads the "time" object
Then "time.created" is an ISO 8601 timestamp
And "time.modified" is an ISO 8601 timestamp
And "time" contains an ISO 8601 timestamp keyed by each visible version
```

### REG-001-AC4 , unknown package is 404
```gherkin
Given no package named "@brika/does-not-exist" exists
When a client sends GET /@brika/does-not-exist
Then the response status is 404
```
