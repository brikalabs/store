---
id: REG-009
title: "Catalog excludes yanked and taken-down packages"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/d1-catalog.ts
    - apps/registry/src/controllers/catalog.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

The catalog lists each package's latest visible version only. A package whose
latest is yanked or taken down does not appear, so the storefront never surfaces a
package a client cannot install.

## Acceptance criteria

### REG-009-AC1 , a package whose only version is yanked is absent
```gherkin
Given "@brika/plugin-weather" has a single version that is yanked
When a client sends GET /-/v1/packages
Then "@brika/plugin-weather" does not appear in "packages"
```

### REG-009-AC2 , a package whose only version is taken down is absent
```gherkin
Given "@brika/plugin-weather" has a single version that is taken down
When a client sends GET /-/v1/packages
Then "@brika/plugin-weather" does not appear in "packages"
```
