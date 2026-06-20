---
id: ORG-008
title: "Manage an org's scopes"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/org.ts
    - packages/db/src/adapters/d1-org-scopes.ts
    - apps/registry/src/controllers/org.ts
    - apps/web/src/routes/api.orgs.$org.scopes.ts
  tests:
    - packages/registry-core/src/org.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

An org admin lists, attaches, and transfers the scopes their org owns. Attaching a
scope is subject to the anti-squat policy (`ORG-004..006`).

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
