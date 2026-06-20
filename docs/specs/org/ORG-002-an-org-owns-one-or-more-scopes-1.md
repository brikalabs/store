---
id: ORG-002
title: "An org owns one or more scopes (1:N)"
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

> **Superseded by the org->scope merge:** the 1:N "an org owns many scopes" model was
> removed. A scope is now a standalone account (npm/JSR model): membership lives
> directly on the scope, there is no separate org slug, and a scope does not "belong to"
> anything. The `reg_orgs`/`reg_org_members` tables and the scope->org foreign key were
> dropped (migration `drizzle/0015_*`). See
> [ADR 0001](../../adr/0001-organisation-1n-model.md) for the reversal. Retained for
> history; coverage-exempt.

This spec proposed a distinct org entity owning multiple npm scopes via a foreign key.
That relationship no longer exists.

## Acceptance criteria

### ORG-002-AC1 , create an org
```gherkin
Given I am authenticated
When I create organisation "acme"
Then the org exists with me as its admin
And its public page lives at "/org/acme"
```

### ORG-002-AC2 , an org owns multiple scopes
```gherkin
Given I admin organisation "acme"
When I attach scope "@acme" and scope "@acme-labs" to it
Then both scopes are owned by org "acme"
And org membership governs publishing to both
```

### ORG-002-AC3 , a scope belongs to exactly one org
```gherkin
Given scope "@acme" is owned by org "acme"
When anyone attempts to attach "@acme" to a different org
Then it is refused (a scope cannot belong to two orgs)
```
