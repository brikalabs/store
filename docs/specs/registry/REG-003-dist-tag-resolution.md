---
id: REG-003
title: "Dist-tag resolution"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/packument.ts
    - packages/registry-core/src/resolve.ts
  tests:
    - packages/registry-core/src/packument.test.ts
---

## Description

The packument's `dist-tags` object maps tag names to version strings, so a client
can resolve `latest` (and any custom tag) to a concrete version.

## Acceptance criteria

### REG-003-AC1 , latest resolves to the published latest version
```gherkin
Given "@brika/plugin-weather" has 1.0.0 and 1.1.0 with the "latest" tag on 1.1.0
When a client reads "dist-tags" from the packument
Then "dist-tags.latest" equals "1.1.0"
```

### REG-003-AC2 , custom tags are surfaced
```gherkin
Given "@brika/plugin-weather" has a "next" tag pointing at 1.0.0
When a client reads "dist-tags" from the packument
Then "dist-tags.next" equals "1.0.0"
```
