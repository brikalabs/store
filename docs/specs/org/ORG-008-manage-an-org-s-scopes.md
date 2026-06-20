---
id: ORG-008
title: "Manage an org's scopes"
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

> **Superseded by the org->scope merge:** there is no separate org that owns and
> attaches scopes, so "manage an org's scopes" (list/attach/transfer) is gone. A scope
> is claimed directly and standalone (`ScopeService.claim`, see ORG-004/005/006); the
> attach machinery (`d1-org-scopes`) was removed. See
> [ADR 0001](../../adr/0001-organisation-1n-model.md). Retained for history;
> coverage-exempt.

This spec proposed an admin listing/attaching/transferring the scopes an org owns;
with no org->scope relationship there is nothing to attach.

## Acceptance criteria

### ORG-008-AC1 , list an org's scopes
```gherkin
Given I am a member of org "acme" which owns "@acme" and "@acme-labs"
When I view the org's scopes
Then I see both "@acme" and "@acme-labs"
```

### ORG-008-AC2 , attach a new scope (admin only)
```gherkin
Given I am an admin of org "acme"
And scope "@acme-labs" is unclaimed and is verifiably mine
When I attach "@acme-labs" to org "acme"
Then org "acme" owns "@acme-labs"
```

### ORG-008-AC3 , non-admin cannot attach a scope
```gherkin
Given I am a non-admin member of org "acme"
When I attempt to attach a scope
Then I get 403 forbidden
```
