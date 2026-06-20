---
id: REG-007
title: "Yanked and taken-down versions hidden from resolve"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/packument.ts
    - packages/db/src/adapters/d1-metadata.ts
  tests:
    - packages/registry-core/src/packument.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Yanked versions (publisher action) and taken-down versions (operator action) do
not appear in the packument's `versions` map, so clients cannot resolve or install
them. A taken-down version's reason is surfaced under a non-standard `takedowns`
field for transparency.

## Acceptance criteria

### REG-007-AC1 , a yanked version is absent from the packument
```gherkin
Given "@brika/plugin-weather" has versions 1.0.0 and 1.1.0 and 1.1.0 is yanked
When a client fetches the packument
Then "versions" contains "1.0.0"
And "versions" does not contain "1.1.0"
```

### REG-007-AC2 , a taken-down version is hidden but its reason is disclosed
```gherkin
Given "@brika/plugin-weather@1.0.0" has been taken down with reason "malware"
When a client fetches the packument
Then "versions" does not contain "1.0.0"
And "takedowns"["1.0.0"] equals "malware"
```

### REG-007-AC3 , a package with no visible versions still resolves with empty versions
```gherkin
Given every version of "@brika/plugin-weather" is yanked or taken down
When a client fetches the packument
Then the response status is 200
And "versions" is an empty object
```
