---
id: ORG-003
title: "Public organisation page"
status: gone
area: org
group: org
test_mode: manual
traceability:
  code:
    - apps/web/src/components/plugin/scope-page.tsx
  tests: []
---

## Description

> **Superseded by the org->scope merge:** the public per-org page (`/orgs/:org`
> aggregating plugins across an org's many scopes) no longer makes sense once a scope
> is the account itself. The public publisher surface is now the **scope page**,
> `STORE-015` (`GET /@scope`), which renders one scope's plugins, profile (ORG-009),
> and verified-domain badges (ORG-010). The old `/orgs/:slug` route was retired. See
> [ADR 0001](../../adr/0001-organisation-1n-model.md). Retained for history;
> coverage-exempt.

This spec proposed an aggregate org page across multiple scopes; with no 1:N model
there is nothing to aggregate.

## Acceptance criteria

### ORG-003-AC1 , lists the org's public plugins across all its scopes
```gherkin
Given org "acme" owns scopes "@acme" and "@acme-labs" with published plugins
When I visit "/orgs/acme"
Then I see the org's verified display name
And I see plugins from both "@acme" and "@acme-labs" in one list
```

### ORG-003-AC2 , hides withdrawn versions
```gherkin
Given a plugin in the org has only yanked or taken-down versions
When I visit the org page
Then that plugin is not listed (consistent with the catalog rules)
```

### ORG-003-AC3 , unknown org
```gherkin
Given no org "nope" exists
When I visit "/orgs/nope"
Then I get a 404 page
```
