---
id: OPERATOR-002
title: "Operator package-version moderation (takedown, restore, bulk)"
status: done
area: operator
group: operator
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api/operator/packages/takedown.ts
    - apps/web/src/routes/api/operator/packages/restore.ts
    - apps/web/src/routes/api/operator/packages/bulk-takedown.ts
    - apps/web/src/routes/api/operator/packages/versions.ts
    - apps/web/src/routes/operator/packages.tsx
  tests: []
---

## Description

From the console an operator can take down a published package version (hide it from
new installs while keeping the bytes for pinned lockfiles, surfacing a public reason),
restore a taken-down version, or sweep many packages at once with a single bulk
takedown. Every action is operator-gated and audited. This is the console surface
over the registry admin capability (see MANAGE-008/009).

## Acceptance criteria

### OPERATOR-002-AC1 , takedown hides a version and records the reason
```gherkin
Given an operator and a live package version
When they POST /api/operator/packages/takedown with name, version, and a reason
Then the version is hidden from new installs but its bytes remain for pinned installs
And the reason is surfaced on the version
And an audit "takedown" entry is written
```

### OPERATOR-002-AC2 , restore reverses a takedown
```gherkin
Given an operator and a taken-down version
When they POST /api/operator/packages/restore with name and version
Then the version is installable again
And an audit "restore" entry is written
```

### OPERATOR-002-AC3 , bulk takedown sweeps many packages in one action
```gherkin
Given an operator and a list of up to 100 package names plus a reason
When they POST /api/operator/packages/bulk-takedown
Then every still-live version of each existing package is taken down
And a package that no longer exists is skipped, not failed
And one audit entry is written per package actually acted on
```

### OPERATOR-002-AC4 , moderation endpoints reject non-operators
```gherkin
Given a request that is not an authenticated operator
When it calls any package moderation endpoint
Then the response is 404
```
