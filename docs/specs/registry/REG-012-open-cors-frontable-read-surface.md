---
id: REG-012
title: "Open, CORS-frontable read surface"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/packages.ts
    - apps/registry/src/controllers/catalog.ts
    - apps/registry/src/controllers/stats.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

All read endpoints (packument, tarball, catalog, stats) are anonymous: no
authentication is required and no rate limit applies to reads, and responses carry
public cache headers so they are CDN- and edge-cacheable.

## Acceptance criteria

### REG-012-AC1 , reads require no authentication
```gherkin
Given a request carries no Authorization header
When a client sends GET for a packument, tarball, catalog, or stats endpoint
Then the response is served normally (200 or a content-based 404), never 401 or 403
```

### REG-012-AC2 , read responses are publicly cacheable
```gherkin
Given a successful packument, catalog, or stats response
When the client inspects the Cache-Control header
Then it is "public, max-age=60"
```

### REG-012-AC3 , reads are not rate limited
```gherkin
Given many successive read requests from one client
When the client repeatedly sends GET for a packument, tarball, catalog, or stats endpoint
Then no request is rejected with 429
```
