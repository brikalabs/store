---
id: REG-010
title: "Per-package download stats"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/stats.ts
    - packages/registry-core/src/downloads.ts
    - packages/db/src/adapters/d1-downloads.ts
  tests:
    - packages/registry-core/src/downloads.test.ts
    - packages/db/src/adapters/d1-downloads.test.ts
---

## Description

`GET /-/v1/downloads/:name` returns install counts for one package: an all-time
total, a trailing 7-day weekly count, and a trailing 30-day per-day series
(oldest first, zero-filled) for the detail-page sparkline.

## Acceptance criteria

### REG-010-AC1 , 200 with total, weekly, and a 30-element series
```gherkin
Given "@brika/plugin-weather" has recorded downloads
When a client sends GET /-/v1/downloads/@brika/plugin-weather
Then the response status is 200
And the body "name" equals "@brika/plugin-weather"
And the body has numeric "total" and "weekly"
And "series" is an array of 30 numbers ordered oldest day first
```

### REG-010-AC2 , weekly is the trailing 7-day sum
```gherkin
Given per-day download counts exist for the package over the last 30 days
When a client reads "weekly"
Then "weekly" equals the sum of the counts for the trailing 7 days
And "total" equals the sum of all recorded days
```

### REG-010-AC3 , a package with no downloads returns zeros
```gherkin
Given "@brika/plugin-weather" has no recorded downloads
When a client sends GET /-/v1/downloads/@brika/plugin-weather
Then the response status is 200
And "total" equals 0 and "weekly" equals 0
And "series" is an array of 30 zeros
```
