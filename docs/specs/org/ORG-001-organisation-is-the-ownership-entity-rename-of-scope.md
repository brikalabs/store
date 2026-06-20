---
id: ORG-001
title: "Organisation is the ownership entity (rename of \"scope\")"
status: gone
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

> **Superseded by the org->scope merge:** the separate "organisation" layer was
> collapsed back into the scope. The **scope (`@brika`) is the ownership entity
> itself** (npm/JSR model) - there is no distinct org entity to rename `scope` into,
> so this spec no longer describes anything real. Ownership + membership live directly
> on the scope (`ScopeService`, `reg_scopes`, `reg_scope_members`). See
> [ADR 0001](../../adr/0001-organisation-1n-model.md) for the reversal. Retained for
> history; coverage-exempt.

This spec proposed renaming the ownership/membership entity to **organisation**,
keeping "scope" only for the npm namespace string. That distinction is gone: the
scope is the account.

## Acceptance criteria

### ORG-001-AC1 , org owns a scope
```gherkin
Given an organisation "brika"
When I read its record
Then it owns the npm scope "@brika"
And packages published under "@brika" are governed by org "brika" membership
```

### ORG-001-AC2 , npm read surface is unchanged by the rename
```gherkin
Given the rename has shipped
When a client runs "bun add @brika/plugin-x"
Then the packument and tarball resolve exactly as before
And no client-visible npm path changed from "scope" to "org"
```

### ORG-001-AC3 , management API moves to /-/org
```gherkin
Given the rename has shipped
When an authenticated client manages an org
Then it uses "/-/org/:org" endpoints
And the prior "SCOPE-*" ownership behaviour is preserved under the new names
```
