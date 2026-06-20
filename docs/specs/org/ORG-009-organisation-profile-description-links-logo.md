---
id: ORG-009
title: "Scope profile: description, links, and logo"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/profile.ts
    - packages/registry-core/src/scope.ts
    - packages/db/src/adapters/d1-scope-store.ts
    - apps/registry/src/controllers/scope.ts
    - apps/web/src/routes/api/scopes
    - apps/web/src/components/plugin/scope-page.tsx
  tests:
    - packages/registry-core/src/profile.test.ts
    - packages/registry-core/src/scope.test.ts
    - packages/db/src/adapters/d1-scope-store.test.ts
---

## Description

A scope has an editable public profile: a free-text description, an arbitrary set
of labelled external links (X, LinkedIn, npm, a docs site, ...), and an uploaded logo.
All are admin-only to edit and render on the public scope page (`/@scope`, STORE-015);
links, description, and `display_name` live on `reg_scopes`, while the logo's bytes live
in object storage (R2) keyed by `icon_key`.

## Acceptance criteria

### ORG-009-AC1 , an admin sets the description + links; they show publicly
```gherkin
Given I am an admin of scope "@acme"
When I save a description and one or more links
Then the description and links are stored on the scope
And they render on the public page "/@acme"
And each link shows an icon inferred from its URL (a generic globe when unknown)
```

### ORG-009-AC2 , links are arbitrary, http(s)-only, and bounded
```gherkin
Given I am editing scope "@acme" links
When I add a link
Then any label and any https or http URL is accepted
And a non-http(s) URL (e.g. "javascript:") is refused
And the number of links is capped
```

### ORG-009-AC3 , an admin uploads a logo; otherwise a generated avatar is used
```gherkin
Given I am an admin of scope "@acme"
When I upload a PNG, JPEG, or WebP image up to 512 KiB
Then it is stored and served as the scope's logo on "/@acme"
And clearing it falls back to the deterministic generated avatar
And a non-image or oversized upload is refused
```

### ORG-009-AC4 , only admins may edit the profile or logo
```gherkin
Given I am a non-admin member of scope "@acme"
When I attempt to set the profile or upload a logo
Then I get 403 forbidden
```
