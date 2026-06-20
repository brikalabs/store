---
id: ORG-003
title: "Public organisation page"
status: done
area: org
group: org
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/orgs.$org.tsx
    - apps/web/src/lib/registry.ts
    - apps/registry/src/controllers/org.ts
  tests: []
---

## Description

A public SSR page at `store.brika.dev/orgs/:org` listing the org's published
plugins aggregated across all of its scopes, with its verified display name,
profile (description, links, logo; ORG-009), and verified-domain badges (ORG-010).

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
