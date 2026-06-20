---
id: STORE-009
title: "Hybrid npm + registry federation"
status: gone
area: store
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/lib/registry.ts
    - apps/web/src/lib/registry-source.ts
    - apps/web/src/lib/npm.ts
  tests:
    - apps/web/src/lib/registry.test.ts
    - apps/web/src/lib/registry-source.test.ts
---

## Description

> **Superseded/removed: the storefront is now registry-only.** npm is no longer a listing or discovery source; the store lists only verified, scoped plugins published to the Brika registry (npm `bun/npm install` *consumption* still resolves, but it is never read for discovery). `apps/web/src/lib/registry/npm.ts` was deleted and the read model now reads only the hosted catalog (`searchPlugins` -> `listRegistryPlugins`). Retained for history.

Discovery merged two sources: the Brika registry (`@brika/*`, read from
registry.brika.dev) and npm (packages tagged with the `brika` keyword). Registry
plugins were placed first and the merged list deduplicated by name. Registry was
only consulted for the first page of plain (non field-qualified) queries.

## Acceptance criteria

### STORE-009-AC1 , Registry plugins are merged ahead of npm and deduplicated by name
```gherkin
Given a plain query whose first page would return both registry and npm hits
When searchPlugins runs at offset 0
Then registry (@brika/*) plugins appear before npm plugins in the merged list
And a plugin name that appears in both sources appears only once
And the total reflects both sources
```

### STORE-009-AC2 , Field-qualified and paginated queries skip the registry merge
```gherkin
Given a query containing a field qualifier (a ":" such as maintainer:foo) or offset greater than 0
When searchPlugins runs
Then the registry catalog is not merged in for that request
And results come from npm only
```

### STORE-009-AC3 , Registry resolves before npm for a single plugin
```gherkin
Given a name that starts with @brika/
When getPluginPage resolves the plugin
Then the Brika registry is consulted first
And npm is used only as a fallback when the name is not a registry name or is not found there
```
