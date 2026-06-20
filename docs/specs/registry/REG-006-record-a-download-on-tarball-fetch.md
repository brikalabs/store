---
id: REG-006
title: "Record a download on tarball fetch"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/packages.ts
    - packages/db/src/adapters/d1-downloads.ts
  tests:
    - apps/registry/src/controllers/packages.test.ts
---

## Description

A served tarball is an install signal. The count is incremented off the response
path (via `waitUntil`), so the download never waits on or fails from the counter,
and edge-cached repeats that skip the Worker are uncounted (counts are a lower
bound, as on npm). Counts bucket per UTC day.

## Acceptance criteria

### REG-006-AC1 , a successful download increments today's count
```gherkin
Given the download count for "@brika/plugin-weather" on the current UTC day is N
When a client successfully downloads a tarball for that package
Then the count for that package on the current UTC day becomes N + 1
```

### REG-006-AC2 , counting never blocks or fails the download
```gherkin
Given the download counter would error or be slow
When a client downloads a tarball
Then the response status is still 200 and the bytes are still served
```

### REG-006-AC3 , a 404 download does not record a count
```gherkin
Given a tarball request that resolves to 404
When the request completes
Then no download count is recorded for that package
```
